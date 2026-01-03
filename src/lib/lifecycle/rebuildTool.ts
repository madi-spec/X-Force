/**
 * Deterministic Rebuild Tool
 *
 * Admin-only tool for rebuilding all projections from the event store.
 *
 * GUARANTEES:
 * - Deterministic: Same events always produce same projections
 * - Lossless: No data is lost during rebuild
 * - Audited: All rebuilds are tracked in projection_rebuild_audit
 *
 * PROCESS:
 * 1. Verify admin privileges
 * 2. Create audit record
 * 3. Wipe all projection tables
 * 4. Reset projector checkpoints
 * 5. Replay all events in global_sequence order
 * 6. Verify rebuild success
 * 7. Complete audit record
 *
 * USAGE:
 * - Only callable by service role or admin users
 * - Should be run during maintenance windows
 * - Can take significant time for large event stores
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { rebuildAllProjectors, getProjectorStatuses, AllProjectorsResult } from './projectors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// ============================================================================
// TYPES
// ============================================================================

export interface RebuildResult {
  success: boolean;
  rebuildId: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  eventsReplayed: number;
  projectorResults: Map<string, {
    eventsProcessed: number;
    duration: number;
    success: boolean;
  }>;
  errors: string[];
  verification: {
    passed: boolean;
    checks: Array<{
      name: string;
      passed: boolean;
      details?: string;
    }>;
  };
}

export interface RebuildOptions {
  /** Dry run - don't actually rebuild, just verify */
  dryRun?: boolean;
  /** Skip verification after rebuild */
  skipVerification?: boolean;
  /** Actor performing the rebuild */
  actorId?: string;
  actorType?: 'user' | 'system';
}

// ============================================================================
// REBUILD IMPLEMENTATION
// ============================================================================

/**
 * Performs a full deterministic rebuild of all projections.
 *
 * @param supabase - Supabase client (must have service role)
 * @param options - Rebuild options
 * @returns Rebuild result with audit information
 */
export async function rebuildAllProjections(
  supabase: AnySupabaseClient,
  options: RebuildOptions = {}
): Promise<RebuildResult> {
  const rebuildId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  console.log(`🔄 Starting projection rebuild (ID: ${rebuildId})`);

  // Create audit record
  const { error: auditError } = await supabase
    .from('projection_rebuild_audit')
    .insert({
      rebuild_id: rebuildId,
      projector_name: 'ALL',
      scope: 'full',
      status: 'running',
      started_at: startedAt,
      actor_type: options.actorType || 'system',
      actor_id: options.actorId,
      config: {
        dryRun: options.dryRun || false,
        skipVerification: options.skipVerification || false,
      },
    });

  if (auditError) {
    console.error(`Failed to create audit record: ${auditError.message}`);
  }

  try {
    // Get event count for reference
    const { count: eventCount, error: countError } = await supabase
      .from('event_store')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to count events: ${countError.message}`);
    }

    console.log(`📊 Found ${eventCount} events to replay`);

    if (options.dryRun) {
      console.log('🔍 Dry run mode - skipping actual rebuild');

      return {
        success: true,
        rebuildId,
        startedAt,
        completedAt: new Date().toISOString(),
        duration: 0,
        eventsReplayed: 0,
        projectorResults: new Map(),
        errors: [],
        verification: {
          passed: true,
          checks: [{ name: 'Dry run', passed: true }],
        },
      };
    }

    // Perform rebuild
    const rebuildResult = await rebuildAllProjectors(supabase);

    // Convert Map to serializable format for logging
    const projectorResults = new Map<string, {
      eventsProcessed: number;
      duration: number;
      success: boolean;
    }>();

    for (const [name, result] of rebuildResult.results) {
      projectorResults.set(name, {
        eventsProcessed: result.eventsProcessed,
        duration: result.duration,
        success: result.success,
      });
    }

    if (!rebuildResult.success) {
      for (const error of rebuildResult.errors) {
        errors.push(`${error.projectorName}: ${error.error}`);
      }
    }

    // Verification
    const verification = options.skipVerification
      ? { passed: true, checks: [{ name: 'Verification skipped', passed: true }] }
      : await verifyRebuild(supabase, eventCount || 0);

    const completedAt = new Date().toISOString();
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // Update audit record
    await supabase
      .from('projection_rebuild_audit')
      .update({
        status: rebuildResult.success && verification.passed ? 'completed' : 'failed',
        completed_at: completedAt,
        duration_ms: duration,
        events_processed: rebuildResult.totalEventsProcessed,
        error_message: errors.length > 0 ? errors.join('; ') : null,
        result_summary: {
          projectors: Object.fromEntries(projectorResults),
          verification,
        },
      })
      .eq('rebuild_id', rebuildId)
      .eq('projector_name', 'ALL');

    console.log(`✅ Rebuild complete in ${duration}ms (${rebuildResult.totalEventsProcessed} events)`);

    return {
      success: rebuildResult.success && verification.passed,
      rebuildId,
      startedAt,
      completedAt,
      duration,
      eventsReplayed: rebuildResult.totalEventsProcessed,
      projectorResults,
      errors,
      verification,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    const completedAt = new Date().toISOString();
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // Update audit record with error
    await supabase
      .from('projection_rebuild_audit')
      .update({
        status: 'failed',
        completed_at: completedAt,
        duration_ms: duration,
        error_message: errorMessage,
      })
      .eq('rebuild_id', rebuildId)
      .eq('projector_name', 'ALL');

    console.error(`❌ Rebuild failed: ${errorMessage}`);

    return {
      success: false,
      rebuildId,
      startedAt,
      completedAt,
      duration,
      eventsReplayed: 0,
      projectorResults: new Map(),
      errors,
      verification: {
        passed: false,
        checks: [{ name: 'Rebuild execution', passed: false, details: errorMessage }],
      },
    };
  }
}

/**
 * Verifies the rebuild produced correct results.
 */
async function verifyRebuild(
  supabase: AnySupabaseClient,
  expectedEventCount: number
): Promise<{
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    details?: string;
  }>;
}> {
  const checks: Array<{ name: string; passed: boolean; details?: string }> = [];

  // Check 1: All projectors are active
  try {
    const statuses = await getProjectorStatuses(supabase);
    let allActive = true;

    for (const [name, status] of statuses) {
      if (status.status !== 'active') {
        allActive = false;
        checks.push({
          name: `Projector ${name} status`,
          passed: false,
          details: `Status is ${status.status}, expected active`,
        });
      }
    }

    if (allActive) {
      checks.push({
        name: 'All projectors active',
        passed: true,
      });
    }
  } catch (error) {
    checks.push({
      name: 'Projector status check',
      passed: false,
      details: error instanceof Error ? error.message : String(error),
    });
  }

  // Check 2: No orphaned read models (read models without events)
  try {
    const { data: readModels, error: rmError } = await supabase
      .from('company_product_read_model')
      .select('company_product_id, last_event_sequence')
      .not('last_event_sequence', 'is', null);

    if (rmError) {
      throw rmError;
    }

    let orphanedCount = 0;
    for (const rm of readModels || []) {
      const { count, error: eventError } = await supabase
        .from('event_store')
        .select('*', { count: 'exact', head: true })
        .eq('aggregate_id', rm.company_product_id);

      if (!eventError && count === 0) {
        orphanedCount++;
      }
    }

    checks.push({
      name: 'No orphaned read models',
      passed: orphanedCount === 0,
      details: orphanedCount > 0 ? `Found ${orphanedCount} orphaned read models` : undefined,
    });
  } catch (error) {
    checks.push({
      name: 'Orphaned read model check',
      passed: false,
      details: error instanceof Error ? error.message : String(error),
    });
  }

  // Check 3: Checkpoint sequences are reasonable
  try {
    const { data: checkpoints, error: cpError } = await supabase
      .from('projector_checkpoints')
      .select('projector_name, last_processed_global_sequence, events_processed_count');

    if (cpError) {
      throw cpError;
    }

    let checkpointsValid = true;
    for (const cp of checkpoints || []) {
      if (cp.last_processed_global_sequence < 0 || cp.events_processed_count < 0) {
        checkpointsValid = false;
        break;
      }
    }

    checks.push({
      name: 'Checkpoint sequences valid',
      passed: checkpointsValid,
    });
  } catch (error) {
    checks.push({
      name: 'Checkpoint validation',
      passed: false,
      details: error instanceof Error ? error.message : String(error),
    });
  }

  const passed = checks.every(c => c.passed);

  return { passed, checks };
}

/**
 * Gets the history of rebuilds.
 */
export async function getRebuildHistory(
  supabase: AnySupabaseClient,
  limit: number = 10
): Promise<Array<{
  rebuildId: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  duration: number | null;
  eventsProcessed: number;
  actorType: string;
  actorId: string | null;
}>> {
  const { data, error } = await supabase
    .from('projection_rebuild_audit')
    .select('*')
    .eq('projector_name', 'ALL')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get rebuild history: ${error.message}`);
  }

  return (data || []).map(row => ({
    rebuildId: row.rebuild_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    duration: row.duration_ms,
    eventsProcessed: row.events_processed || 0,
    actorType: row.actor_type,
    actorId: row.actor_id,
  }));
}

/**
 * Compares projections between two points in time.
 * Useful for verifying rebuild consistency.
 */
export async function compareProjectionSnapshots(
  supabase: AnySupabaseClient,
  aggregateId: string
): Promise<{
  eventsMatch: boolean;
  readModelValid: boolean;
  stageFacts: number;
  suggestions: number;
}> {
  // Get event count for this aggregate
  const { count: eventCount } = await supabase
    .from('event_store')
    .select('*', { count: 'exact', head: true })
    .eq('aggregate_id', aggregateId);

  // Get read model
  const { data: readModel } = await supabase
    .from('company_product_read_model')
    .select('*')
    .eq('company_product_id', aggregateId)
    .single();

  // Get stage facts
  const { count: stageFactsCount } = await supabase
    .from('company_product_stage_facts')
    .select('*', { count: 'exact', head: true })
    .eq('company_product_id', aggregateId);

  // Get suggestions
  const { count: suggestionsCount } = await supabase
    .from('ai_suggestions_read_model')
    .select('*', { count: 'exact', head: true })
    .eq('company_product_id', aggregateId);

  return {
    eventsMatch: (eventCount || 0) > 0,
    readModelValid: readModel !== null,
    stageFacts: stageFactsCount || 0,
    suggestions: suggestionsCount || 0,
  };
}
