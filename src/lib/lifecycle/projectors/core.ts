/**
 * Projector Core Infrastructure
 *
 * Provides the foundation for event projectors that derive read models from events.
 *
 * ARCHITECTURE:
 * - Projectors consume events in strict global_sequence order
 * - Checkpoints track progress for restartability
 * - All projection updates are transactional
 * - Projectors are idempotent - safe to re-run
 *
 * RULES:
 * - Never skip events
 * - Never make business decisions in projectors
 * - Always use transactions for multi-table updates
 * - Always update checkpoint after successful processing
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventStore, ProjectorCheckpoint, ProjectorStatus } from '@/types/eventSourcing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabaseClient = SupabaseClient<any, any, any>;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of processing a batch of events.
 */
export interface ProjectorResult {
  success: boolean;
  eventsProcessed: number;
  lastProcessedSequence: number;
  errors: ProjectorError[];
  duration: number;
}

/**
 * Error that occurred during event processing.
 */
export interface ProjectorError {
  eventId: string;
  globalSequence: number;
  eventType: string;
  error: string;
  timestamp: string;
}

/**
 * Options for running a projector.
 */
export interface ProjectorOptions {
  /** Maximum events to process in one batch */
  batchSize?: number;
  /** Whether to stop on first error */
  stopOnError?: boolean;
  /** Whether to use transactions */
  useTransactions?: boolean;
}

const DEFAULT_OPTIONS: Required<ProjectorOptions> = {
  batchSize: 100,
  stopOnError: true,
  useTransactions: true,
};

// ============================================================================
// CHECKPOINT MANAGEMENT
// ============================================================================

/**
 * Gets the current checkpoint for a projector.
 */
export async function getCheckpoint(
  supabase: AnySupabaseClient,
  projectorName: string
): Promise<ProjectorCheckpoint | null> {
  const { data, error } = await supabase
    .from('projector_checkpoints')
    .select('*')
    .eq('projector_name', projectorName)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found - will be created on first run
      return null;
    }
    throw new Error(`Failed to get checkpoint: ${error.message}`);
  }

  return data as ProjectorCheckpoint;
}

/**
 * Updates the checkpoint after successful processing.
 */
export async function updateCheckpoint(
  supabase: AnySupabaseClient,
  projectorName: string,
  lastProcessedSequence: number,
  lastProcessedEventId: string,
  eventsProcessedIncrement: number
): Promise<void> {
  // First, try to get current count
  const { data: current } = await supabase
    .from('projector_checkpoints')
    .select('events_processed_count')
    .eq('projector_name', projectorName)
    .single();

  const newCount = (current?.events_processed_count || 0) + eventsProcessedIncrement;

  const { error } = await supabase
    .from('projector_checkpoints')
    .upsert({
      projector_name: projectorName,
      last_processed_global_sequence: lastProcessedSequence,
      last_processed_event_id: lastProcessedEventId,
      last_processed_at: new Date().toISOString(),
      events_processed_count: newCount,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'projector_name',
    });

  if (error) {
    throw new Error(`Failed to update checkpoint: ${error.message}`);
  }
}

/**
 * Records an error in the checkpoint.
 */
export async function recordCheckpointError(
  supabase: AnySupabaseClient,
  projectorName: string,
  errorMessage: string
): Promise<void> {
  // First get current error count
  const { data: current } = await supabase
    .from('projector_checkpoints')
    .select('errors_count')
    .eq('projector_name', projectorName)
    .single();

  const newErrorCount = (current?.errors_count || 0) + 1;

  const { error } = await supabase
    .from('projector_checkpoints')
    .update({
      errors_count: newErrorCount,
      last_error: errorMessage,
      last_error_at: new Date().toISOString(),
      status: 'error',
      updated_at: new Date().toISOString(),
    })
    .eq('projector_name', projectorName);

  if (error) {
    console.error(`Failed to record checkpoint error: ${error.message}`);
  }
}

/**
 * Sets the projector status.
 */
export async function setProjectorStatus(
  supabase: AnySupabaseClient,
  projectorName: string,
  status: ProjectorStatus
): Promise<void> {
  const { error } = await supabase
    .from('projector_checkpoints')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('projector_name', projectorName);

  if (error) {
    throw new Error(`Failed to set projector status: ${error.message}`);
  }
}

// ============================================================================
// EVENT FETCHING
// ============================================================================

/**
 * Fetches events after a given global sequence.
 */
export async function fetchEventsAfter(
  supabase: AnySupabaseClient,
  afterSequence: number,
  limit: number,
  aggregateType?: string
): Promise<EventStore[]> {
  let query = supabase
    .from('event_store')
    .select('*')
    .gt('global_sequence', afterSequence)
    .order('global_sequence', { ascending: true })
    .limit(limit);

  if (aggregateType) {
    query = query.eq('aggregate_type', aggregateType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  return (data || []) as EventStore[];
}

/**
 * Fetches all events for rebuilding projections.
 */
export async function* fetchAllEvents(
  supabase: AnySupabaseClient,
  aggregateType?: string,
  batchSize: number = 1000
): AsyncGenerator<EventStore[], void, unknown> {
  let afterSequence = 0;
  let hasMore = true;

  while (hasMore) {
    const events = await fetchEventsAfter(supabase, afterSequence, batchSize, aggregateType);

    if (events.length === 0) {
      hasMore = false;
    } else {
      yield events;
      afterSequence = events[events.length - 1].global_sequence;
      hasMore = events.length === batchSize;
    }
  }
}

// ============================================================================
// PROJECTOR BASE CLASS
// ============================================================================

/**
 * Base interface for all projectors.
 */
export interface Projector {
  /** Unique name for this projector */
  readonly name: string;

  /** Aggregate types this projector handles (empty = all) */
  readonly aggregateTypes: string[];

  /**
   * Process a single event.
   * Must be idempotent - safe to call multiple times with same event.
   */
  processEvent(supabase: AnySupabaseClient, event: EventStore): Promise<void>;

  /**
   * Called before a batch of events is processed.
   * Optional - for setup/transaction management.
   */
  beforeBatch?(supabase: AnySupabaseClient): Promise<void>;

  /**
   * Called after a batch of events is processed successfully.
   * Optional - for cleanup/transaction commit.
   */
  afterBatch?(supabase: AnySupabaseClient): Promise<void>;

  /**
   * Clears all projection data for this projector.
   * Used for full rebuilds.
   */
  clear(supabase: AnySupabaseClient): Promise<void>;
}

// ============================================================================
// PROJECTOR RUNNER
// ============================================================================

/**
 * Runs a projector to process pending events.
 */
export async function runProjector(
  supabase: AnySupabaseClient,
  projector: Projector,
  options: ProjectorOptions = {}
): Promise<ProjectorResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  const errors: ProjectorError[] = [];
  let eventsProcessed = 0;
  let lastProcessedSequence = 0;
  let lastProcessedEventId = '';

  try {
    // Get current checkpoint
    const checkpoint = await getCheckpoint(supabase, projector.name);
    const startSequence = checkpoint?.last_processed_global_sequence ?? 0;

    // Fetch pending events
    const events = await fetchEventsAfter(
      supabase,
      startSequence,
      opts.batchSize,
      projector.aggregateTypes.length === 1 ? projector.aggregateTypes[0] : undefined
    );

    if (events.length === 0) {
      return {
        success: true,
        eventsProcessed: 0,
        lastProcessedSequence: startSequence,
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    // Filter events by aggregate type if multiple types specified
    const filteredEvents = projector.aggregateTypes.length > 0
      ? events.filter(e => projector.aggregateTypes.includes(e.aggregate_type))
      : events;

    // Before batch hook
    if (projector.beforeBatch) {
      await projector.beforeBatch(supabase);
    }

    // Process each event
    for (const event of filteredEvents) {
      try {
        await projector.processEvent(supabase, event);
        eventsProcessed++;
        lastProcessedSequence = event.global_sequence;
        lastProcessedEventId = event.id;
      } catch (error) {
        const errorObj: ProjectorError = {
          eventId: event.id,
          globalSequence: event.global_sequence,
          eventType: event.event_type,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        };
        errors.push(errorObj);

        if (opts.stopOnError) {
          await recordCheckpointError(supabase, projector.name, errorObj.error);
          break;
        }
      }
    }

    // After batch hook
    if (projector.afterBatch && errors.length === 0) {
      await projector.afterBatch(supabase);
    }

    // Update checkpoint if we processed any events
    if (eventsProcessed > 0) {
      // Update to the last event in the batch, not just processed events
      // This ensures we don't re-process filtered events
      const actualLastSequence = events[events.length - 1].global_sequence;
      await updateCheckpoint(
        supabase,
        projector.name,
        actualLastSequence,
        events[events.length - 1].id,
        eventsProcessed
      );
      lastProcessedSequence = actualLastSequence;
    }

    return {
      success: errors.length === 0,
      eventsProcessed,
      lastProcessedSequence,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await recordCheckpointError(supabase, projector.name, errorMessage);

    return {
      success: false,
      eventsProcessed,
      lastProcessedSequence,
      errors: [{
        eventId: '',
        globalSequence: 0,
        eventType: 'SYSTEM',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }],
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Runs a projector until all events are processed.
 */
export async function runProjectorToCompletion(
  supabase: AnySupabaseClient,
  projector: Projector,
  options: ProjectorOptions = {}
): Promise<ProjectorResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let totalEventsProcessed = 0;
  const allErrors: ProjectorError[] = [];
  let lastSequence = 0;
  const startTime = Date.now();

  while (true) {
    const result = await runProjector(supabase, projector, opts);

    totalEventsProcessed += result.eventsProcessed;
    allErrors.push(...result.errors);
    lastSequence = result.lastProcessedSequence;

    // Stop if no events were processed or if there were errors
    if (result.eventsProcessed === 0 || !result.success) {
      break;
    }
  }

  return {
    success: allErrors.length === 0,
    eventsProcessed: totalEventsProcessed,
    lastProcessedSequence: lastSequence,
    errors: allErrors,
    duration: Date.now() - startTime,
  };
}

/**
 * Rebuilds a projector from scratch.
 * Clears all data and reprocesses all events.
 */
export async function rebuildProjector(
  supabase: AnySupabaseClient,
  projector: Projector,
  options: ProjectorOptions = {}
): Promise<ProjectorResult> {
  // Set status to rebuilding
  await setProjectorStatus(supabase, projector.name, 'rebuilding');

  try {
    // Clear existing data
    await projector.clear(supabase);

    // Reset checkpoint
    const { error: resetError } = await supabase
      .from('projector_checkpoints')
      .update({
        last_processed_global_sequence: 0,
        last_processed_event_id: null,
        last_processed_at: null,
        events_processed_count: 0,
        errors_count: 0,
        last_error: null,
        last_error_at: null,
        status: 'rebuilding',
        updated_at: new Date().toISOString(),
      })
      .eq('projector_name', projector.name);

    if (resetError) {
      throw new Error(`Failed to reset checkpoint: ${resetError.message}`);
    }

    // Run to completion
    const result = await runProjectorToCompletion(supabase, projector, options);

    // Set final status
    await setProjectorStatus(supabase, projector.name, result.success ? 'active' : 'error');

    return result;
  } catch (error) {
    await setProjectorStatus(supabase, projector.name, 'error');
    throw error;
  }
}
