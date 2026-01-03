/**
 * Unified Projector Runner
 *
 * Orchestrates running all projectors in the correct order.
 *
 * ORDER MATTERS:
 * 1. CompanyProductReadModelProjector (updates current state)
 * 2. CompanyProductStageFactsProjector (uses read model for process info)
 * 3. ProductPipelineStageCountsProjector (aggregates from read model)
 *
 * USAGE:
 * - runAllProjectors(): Process pending events for all projectors
 * - rebuildAllProjectors(): Full rebuild from scratch
 * - runProjectorByName(): Run a specific projector
 */

import type { AnySupabaseClient, ProjectorResult, ProjectorOptions, Projector } from './core';
import { runProjector, runProjectorToCompletion, rebuildProjector } from './core';
import { CompanyProductReadModelProjector } from './readModelProjector';
import { CompanyProductStageFactsProjector } from './stageFactsProjector';
import { ProductPipelineStageCountsProjector } from './pipelineCountsProjector';
import { AISuggestionProjector } from './aiSuggestionProjector';
import { SLABreachFactsProjector } from './slaBreachProjector';

// ============================================================================
// PROJECTOR REGISTRY
// ============================================================================

/**
 * All projectors in execution order.
 * Order matters! Read model must run before stage facts and pipeline counts.
 * AI suggestions and SLA breach facts run independently.
 */
export const PROJECTORS: readonly Projector[] = [
  CompanyProductReadModelProjector,
  CompanyProductStageFactsProjector,
  ProductPipelineStageCountsProjector,
  AISuggestionProjector,
  SLABreachFactsProjector,
] as const;

/**
 * Map of projector names to projectors.
 */
export const PROJECTOR_MAP: ReadonlyMap<string, Projector> = new Map(
  PROJECTORS.map(p => [p.name, p])
);

// ============================================================================
// RUNNER TYPES
// ============================================================================

export interface AllProjectorsResult {
  success: boolean;
  results: Map<string, ProjectorResult>;
  totalEventsProcessed: number;
  totalDuration: number;
  errors: Array<{
    projectorName: string;
    error: string;
  }>;
}

// ============================================================================
// RUNNER FUNCTIONS
// ============================================================================

/**
 * Runs all projectors to process pending events.
 * Runs in order: read model → stage facts → pipeline counts
 */
export async function runAllProjectors(
  supabase: AnySupabaseClient,
  options: ProjectorOptions = {}
): Promise<AllProjectorsResult> {
  const results = new Map<string, ProjectorResult>();
  const errors: Array<{ projectorName: string; error: string }> = [];
  let totalEventsProcessed = 0;
  const startTime = Date.now();

  for (const projector of PROJECTORS) {
    try {
      const result = await runProjector(supabase, projector, options);
      results.set(projector.name, result);
      totalEventsProcessed += result.eventsProcessed;

      if (!result.success) {
        errors.push({
          projectorName: projector.name,
          error: result.errors[0]?.error || 'Unknown error',
        });

        if (options.stopOnError !== false) {
          break;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        projectorName: projector.name,
        error: errorMessage,
      });

      if (options.stopOnError !== false) {
        break;
      }
    }
  }

  return {
    success: errors.length === 0,
    results,
    totalEventsProcessed,
    totalDuration: Date.now() - startTime,
    errors,
  };
}

/**
 * Runs all projectors until all events are processed.
 */
export async function runAllProjectorsToCompletion(
  supabase: AnySupabaseClient,
  options: ProjectorOptions = {}
): Promise<AllProjectorsResult> {
  const results = new Map<string, ProjectorResult>();
  const errors: Array<{ projectorName: string; error: string }> = [];
  let totalEventsProcessed = 0;
  const startTime = Date.now();

  for (const projector of PROJECTORS) {
    try {
      const result = await runProjectorToCompletion(supabase, projector, options);
      results.set(projector.name, result);
      totalEventsProcessed += result.eventsProcessed;

      if (!result.success) {
        errors.push({
          projectorName: projector.name,
          error: result.errors[0]?.error || 'Unknown error',
        });

        if (options.stopOnError !== false) {
          break;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        projectorName: projector.name,
        error: errorMessage,
      });

      if (options.stopOnError !== false) {
        break;
      }
    }
  }

  return {
    success: errors.length === 0,
    results,
    totalEventsProcessed,
    totalDuration: Date.now() - startTime,
    errors,
  };
}

/**
 * Rebuilds all projectors from scratch.
 * Clears all projection data and reprocesses all events.
 */
export async function rebuildAllProjectors(
  supabase: AnySupabaseClient,
  options: ProjectorOptions = {}
): Promise<AllProjectorsResult> {
  const results = new Map<string, ProjectorResult>();
  const errors: Array<{ projectorName: string; error: string }> = [];
  let totalEventsProcessed = 0;
  const startTime = Date.now();

  console.log('🔄 Starting full projection rebuild...');

  for (const projector of PROJECTORS) {
    console.log(`  📊 Rebuilding ${projector.name}...`);

    try {
      const result = await rebuildProjector(supabase, projector, options);
      results.set(projector.name, result);
      totalEventsProcessed += result.eventsProcessed;

      console.log(`    ✅ ${result.eventsProcessed} events processed in ${result.duration}ms`);

      if (!result.success) {
        errors.push({
          projectorName: projector.name,
          error: result.errors[0]?.error || 'Unknown error',
        });
        console.log(`    ⚠️ Errors: ${result.errors.length}`);

        if (options.stopOnError !== false) {
          break;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        projectorName: projector.name,
        error: errorMessage,
      });
      console.log(`    ❌ Fatal error: ${errorMessage}`);

      if (options.stopOnError !== false) {
        break;
      }
    }
  }

  const totalDuration = Date.now() - startTime;

  if (errors.length === 0) {
    console.log(`✅ Rebuild complete: ${totalEventsProcessed} events in ${totalDuration}ms`);
  } else {
    console.log(`⚠️ Rebuild finished with ${errors.length} errors`);
  }

  return {
    success: errors.length === 0,
    results,
    totalEventsProcessed,
    totalDuration,
    errors,
  };
}

/**
 * Runs a specific projector by name.
 */
export async function runProjectorByName(
  supabase: AnySupabaseClient,
  name: string,
  options: ProjectorOptions = {}
): Promise<ProjectorResult> {
  const projector = PROJECTOR_MAP.get(name);

  if (!projector) {
    throw new Error(`Unknown projector: ${name}. Available: ${[...PROJECTOR_MAP.keys()].join(', ')}`);
  }

  return runProjector(supabase, projector, options);
}

/**
 * Rebuilds a specific projector by name.
 */
export async function rebuildProjectorByName(
  supabase: AnySupabaseClient,
  name: string,
  options: ProjectorOptions = {}
): Promise<ProjectorResult> {
  const projector = PROJECTOR_MAP.get(name);

  if (!projector) {
    throw new Error(`Unknown projector: ${name}. Available: ${[...PROJECTOR_MAP.keys()].join(', ')}`);
  }

  return rebuildProjector(supabase, projector, options);
}

/**
 * Gets the status of all projectors.
 */
export async function getProjectorStatuses(
  supabase: AnySupabaseClient
): Promise<Map<string, {
  status: string;
  lastProcessedSequence: number;
  eventsProcessedCount: number;
  errorsCount: number;
  lastError: string | null;
  lastProcessedAt: string | null;
}>> {
  const { data, error } = await supabase
    .from('projector_checkpoints')
    .select('*')
    .in('projector_name', PROJECTORS.map(p => p.name));

  if (error) {
    throw new Error(`Failed to get projector statuses: ${error.message}`);
  }

  const statuses = new Map<string, {
    status: string;
    lastProcessedSequence: number;
    eventsProcessedCount: number;
    errorsCount: number;
    lastError: string | null;
    lastProcessedAt: string | null;
  }>();

  for (const checkpoint of data || []) {
    statuses.set(checkpoint.projector_name, {
      status: checkpoint.status,
      lastProcessedSequence: checkpoint.last_processed_global_sequence,
      eventsProcessedCount: checkpoint.events_processed_count,
      errorsCount: checkpoint.errors_count,
      lastError: checkpoint.last_error,
      lastProcessedAt: checkpoint.last_processed_at,
    });
  }

  return statuses;
}

/**
 * Gets the lag (unprocessed events) for each projector.
 */
export async function getProjectorLag(
  supabase: AnySupabaseClient
): Promise<Map<string, number>> {
  // Get max global sequence from event store
  const { data: maxSeq, error: seqError } = await supabase
    .from('event_store')
    .select('global_sequence')
    .order('global_sequence', { ascending: false })
    .limit(1)
    .single();

  if (seqError && seqError.code !== 'PGRST116') {
    throw new Error(`Failed to get max sequence: ${seqError.message}`);
  }

  const maxGlobalSequence = maxSeq?.global_sequence || 0;

  // Get checkpoint sequences
  const { data: checkpoints, error: cpError } = await supabase
    .from('projector_checkpoints')
    .select('projector_name, last_processed_global_sequence')
    .in('projector_name', PROJECTORS.map(p => p.name));

  if (cpError) {
    throw new Error(`Failed to get checkpoints: ${cpError.message}`);
  }

  const lagMap = new Map<string, number>();

  for (const projector of PROJECTORS) {
    const checkpoint = checkpoints?.find(c => c.projector_name === projector.name);
    const lastProcessed = checkpoint?.last_processed_global_sequence || 0;
    lagMap.set(projector.name, maxGlobalSequence - lastProcessed);
  }

  return lagMap;
}
