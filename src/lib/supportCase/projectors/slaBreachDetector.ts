/**
 * SLA Breach Detector Job
 *
 * Scans for support cases that have breached their SLA deadlines
 * and emits SlaBreached events for any that haven't been recorded yet.
 *
 * This runs as a scheduled job (e.g., every 5 minutes) and:
 * 1. Finds cases with first_response_due_at in the past but no first response
 * 2. Finds cases with resolution_due_at in the past but not resolved
 * 3. Emits SlaBreached events for cases not already breached
 *
 * IDEMPOTENCY:
 * - Checks breach flags before emitting events
 * - Same job run twice produces no duplicate events
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { appendEvent } from '../commands';
import { createSlaBreachedEvent, type SlaBreachedData } from '../events';
import { SUPPORT_CASE_AGGREGATE_TYPE } from '../events';

// ============================================================================
// TYPES
// ============================================================================

export interface SlaBreachDetectorResult {
  firstResponseBreaches: number;
  resolutionBreaches: number;
  errors: string[];
  processedAt: string;
}

export interface SlaBreachDetectorOptions {
  /** Only process cases for specific company */
  companyId?: string;
  /** Only process cases for specific product */
  companyProductId?: string;
  /** Dry run - don't emit events */
  dryRun?: boolean;
  /** Batch size for processing */
  batchSize?: number;
}

// ============================================================================
// BREACH DETECTION
// ============================================================================

/**
 * Detects and records SLA breaches for support cases.
 */
export async function detectSlaBreaches(
  options: SlaBreachDetectorOptions = {}
): Promise<SlaBreachDetectorResult> {
  const supabase = createAdminClient();
  const now = new Date();
  const result: SlaBreachDetectorResult = {
    firstResponseBreaches: 0,
    resolutionBreaches: 0,
    errors: [],
    processedAt: now.toISOString(),
  };

  const { dryRun = false, batchSize = 100 } = options;

  try {
    // Find first response breaches
    const firstResponseBreaches = await findFirstResponseBreaches(supabase, options, batchSize);
    for (const breach of firstResponseBreaches) {
      try {
        if (!dryRun) {
          await emitSlaBreachedEvent(supabase, breach, 'first_response', now);
        }
        result.firstResponseBreaches++;
      } catch (err) {
        result.errors.push(
          `Failed to emit first_response breach for ${breach.support_case_id}: ${err}`
        );
      }
    }

    // Find resolution breaches
    const resolutionBreaches = await findResolutionBreaches(supabase, options, batchSize);
    for (const breach of resolutionBreaches) {
      try {
        if (!dryRun) {
          await emitSlaBreachedEvent(supabase, breach, 'resolution', now);
        }
        result.resolutionBreaches++;
      } catch (err) {
        result.errors.push(
          `Failed to emit resolution breach for ${breach.support_case_id}: ${err}`
        );
      }
    }
  } catch (err) {
    result.errors.push(`Fatal error in SLA breach detection: ${err}`);
  }

  return result;
}

// ============================================================================
// BREACH FINDERS
// ============================================================================

interface BreachCandidate {
  support_case_id: string;
  company_id: string;
  company_product_id: string | null;
  severity: string;
  due_at: string;
  opened_at: string;
}

async function findFirstResponseBreaches(
  supabase: ReturnType<typeof createAdminClient>,
  options: SlaBreachDetectorOptions,
  batchSize: number
): Promise<BreachCandidate[]> {
  let query = supabase
    .from('support_case_read_model')
    .select(
      `
      support_case_id,
      company_id,
      company_product_id,
      severity,
      first_response_due_at,
      opened_at
    `
    )
    .not('first_response_due_at', 'is', null) // Has SLA set
    .is('first_response_at', null) // No response yet
    .eq('first_response_breached', false) // Not already marked breached
    .not('status', 'in', '("resolved","closed")') // Still active
    .lt('first_response_due_at', new Date().toISOString()) // Past due
    .limit(batchSize);

  if (options.companyId) {
    query = query.eq('company_id', options.companyId);
  }
  if (options.companyProductId) {
    query = query.eq('company_product_id', options.companyProductId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to query first response breaches: ${error.message}`);
  }

  return (data || []).map((row) => ({
    support_case_id: row.support_case_id,
    company_id: row.company_id,
    company_product_id: row.company_product_id,
    severity: row.severity,
    due_at: row.first_response_due_at,
    opened_at: row.opened_at,
  }));
}

async function findResolutionBreaches(
  supabase: ReturnType<typeof createAdminClient>,
  options: SlaBreachDetectorOptions,
  batchSize: number
): Promise<BreachCandidate[]> {
  let query = supabase
    .from('support_case_read_model')
    .select(
      `
      support_case_id,
      company_id,
      company_product_id,
      severity,
      resolution_due_at,
      opened_at
    `
    )
    .not('resolution_due_at', 'is', null) // Has SLA set
    .is('resolved_at', null) // Not resolved yet
    .eq('resolution_breached', false) // Not already marked breached
    .not('status', 'in', '("resolved","closed")') // Still active
    .lt('resolution_due_at', new Date().toISOString()) // Past due
    .limit(batchSize);

  if (options.companyId) {
    query = query.eq('company_id', options.companyId);
  }
  if (options.companyProductId) {
    query = query.eq('company_product_id', options.companyProductId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to query resolution breaches: ${error.message}`);
  }

  return (data || []).map((row) => ({
    support_case_id: row.support_case_id,
    company_id: row.company_id,
    company_product_id: row.company_product_id,
    severity: row.severity,
    due_at: row.resolution_due_at,
    opened_at: row.opened_at,
  }));
}

// ============================================================================
// EVENT EMISSION
// ============================================================================

async function emitSlaBreachedEvent(
  supabase: ReturnType<typeof createAdminClient>,
  breach: BreachCandidate,
  slaType: 'first_response' | 'resolution',
  now: Date
): Promise<void> {
  const dueAt = new Date(breach.due_at);
  const openedAt = new Date(breach.opened_at);

  // Calculate hours
  const targetHours = (dueAt.getTime() - openedAt.getTime()) / (1000 * 60 * 60);
  const actualHours = (now.getTime() - openedAt.getTime()) / (1000 * 60 * 60);
  const hoursOver = (now.getTime() - dueAt.getTime()) / (1000 * 60 * 60);

  const eventData: SlaBreachedData = {
    slaType,
    targetHours: Math.round(targetHours * 100) / 100,
    actualHours: Math.round(actualHours * 100) / 100,
    hoursOver: Math.round(hoursOver * 100) / 100,
    dueAt: breach.due_at,
    breachedAt: now.toISOString(),
  };

  const event = createSlaBreachedEvent(
    eventData,
    { type: 'system' },
    { source: 'sla_breach_detector' }
  );

  // Get next sequence number
  const { data: lastEvent } = await supabase
    .from('event_store')
    .select('sequence_number')
    .eq('aggregate_type', SUPPORT_CASE_AGGREGATE_TYPE)
    .eq('aggregate_id', breach.support_case_id)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .single();

  const nextSequence = (lastEvent?.sequence_number || 0) + 1;

  // Append the event
  const appendResult = await appendEvent(supabase, {
    aggregateId: breach.support_case_id,
    event,
    expectedVersion: nextSequence - 1,
  });

  if (!appendResult.success) {
    throw new Error(`Failed to append SlaBreached event: ${appendResult.error}`);
  }
}

// ============================================================================
// SCHEDULED JOB ENTRY POINT
// ============================================================================

/**
 * Entry point for scheduled cron job.
 * Called by /api/cron/detect-sla-breaches
 */
export async function runSlaBreachDetectorJob(): Promise<SlaBreachDetectorResult> {
  console.log('[SlaBreachDetector] Starting breach detection job');

  const result = await detectSlaBreaches({
    batchSize: 100,
  });

  console.log(
    `[SlaBreachDetector] Completed: ${result.firstResponseBreaches} first response breaches, ${result.resolutionBreaches} resolution breaches, ${result.errors.length} errors`
  );

  if (result.errors.length > 0) {
    console.error('[SlaBreachDetector] Errors:', result.errors);
  }

  return result;
}
