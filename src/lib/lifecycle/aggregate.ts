/**
 * CompanyProduct Aggregate
 *
 * This module implements the aggregate root for CompanyProduct lifecycle.
 * State is computed by replaying events in order - never stored directly.
 *
 * ARCHITECTURE:
 * - loadAggregate() replays all events to compute current state
 * - State is immutable and deterministic
 * - No database writes happen during replay
 * - Projections are separate from aggregate state
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CompanyProductEvent,
  LifecyclePhase,
  ProcessType,
  TerminalOutcome,
} from './events';
import type { EventStore, RiskLevel } from '@/types/eventSourcing';

// Use generic Supabase client type for flexibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// ============================================================================
// AGGREGATE STATE
// ============================================================================

/**
 * In-memory state of a CompanyProduct aggregate.
 * This is computed by replaying events - never stored directly.
 */
export interface CompanyProductState {
  /** Aggregate ID (company_product_id) */
  readonly id: string;
  /** Company ID */
  readonly companyId: string;
  /** Product ID */
  readonly productId: string;
  /** Current lifecycle phase */
  readonly phase: LifecyclePhase | null;
  /** Current process ID */
  readonly processId: string | null;
  /** Current process type */
  readonly processType: ProcessType | null;
  /** Current stage ID */
  readonly stageId: string | null;
  /** Current stage name */
  readonly stageName: string | null;
  /** Current stage order */
  readonly stageOrder: number | null;
  /** When the current stage was entered */
  readonly stageEnteredAt: string | null;
  /** When the current process started */
  readonly processStartedAt: string | null;
  /** Whether the process is completed */
  readonly isProcessCompleted: boolean;
  /** Terminal outcome if completed */
  readonly terminalOutcome: TerminalOutcome | null;
  /** When process was completed */
  readonly processCompletedAt: string | null;
  /** Total stage transitions in current process */
  readonly stageTransitionCount: number;
  /** Current health score */
  readonly healthScore: number | null;
  /** Current risk level */
  readonly riskLevel: RiskLevel | null;
  /** Current owner ID */
  readonly ownerId: string | null;
  /** Current owner name */
  readonly ownerName: string | null;
  /** Current tier */
  readonly tier: number | null;
  /** Current MRR */
  readonly mrr: number | null;
  /** MRR currency */
  readonly mrrCurrency: string | null;
  /** Current seat count */
  readonly seats: number | null;
  /** Next step description */
  readonly nextStep: string | null;
  /** Next step due date */
  readonly nextStepDueDate: string | null;
  /** Last event sequence number */
  readonly lastEventSequence: number;
  /** Last event timestamp */
  readonly lastEventAt: string | null;
  /** Version for optimistic concurrency */
  readonly version: number;
}

/**
 * Creates initial empty state for a new aggregate.
 */
export function createInitialState(
  id: string,
  companyId: string,
  productId: string
): CompanyProductState {
  return {
    id,
    companyId,
    productId,
    phase: null,
    processId: null,
    processType: null,
    stageId: null,
    stageName: null,
    stageOrder: null,
    stageEnteredAt: null,
    processStartedAt: null,
    isProcessCompleted: false,
    terminalOutcome: null,
    processCompletedAt: null,
    stageTransitionCount: 0,
    healthScore: null,
    riskLevel: null,
    ownerId: null,
    ownerName: null,
    tier: null,
    mrr: null,
    mrrCurrency: null,
    seats: null,
    nextStep: null,
    nextStepDueDate: null,
    lastEventSequence: 0,
    lastEventAt: null,
    version: 0,
  };
}

// ============================================================================
// EVENT APPLICATION (REDUCER)
// ============================================================================

// Event data type helpers for type-safe extraction
interface PhaseSetEventData {
  toPhase: LifecyclePhase;
}

interface ProcessSetEventData {
  toProcessId: string;
  toProcessType: ProcessType;
  initialStageId?: string;
  initialStageName?: string;
}

interface StageSetEventData {
  toStageId: string;
  toStageName: string;
  toStageOrder: number;
}

interface ProcessCompletedEventData {
  outcome: TerminalOutcome;
}

interface HealthUpdatedEventData {
  toScore: number;
  riskLevel: RiskLevel;
}

interface OwnerSetEventData {
  toOwnerId: string;
  toOwnerName: string;
}

interface TierSetEventData {
  toTier: number;
}

interface MRRSetEventData {
  toMRR: number;
  currency: string;
}

interface SeatsSetEventData {
  toSeats: number;
}

interface NextStepDueSetEventData {
  toNextStep: string;
  toDueDate: string;
}

/**
 * Applies a single event to the current state, producing new state.
 * This is a pure function - no side effects.
 */
export function applyEvent(
  state: CompanyProductState,
  event: EventStore
): CompanyProductState {
  // Cast to unknown first for safe type narrowing
  const eventData = event.event_data as unknown;
  const baseUpdate = {
    lastEventSequence: event.sequence_number,
    lastEventAt: event.occurred_at,
    version: state.version + 1,
  };

  switch (event.event_type) {
    case 'CompanyProductPhaseSet': {
      const data = eventData as PhaseSetEventData;
      return {
        ...state,
        ...baseUpdate,
        phase: data.toPhase,
      };
    }

    case 'CompanyProductProcessSet': {
      const data = eventData as ProcessSetEventData;
      return {
        ...state,
        ...baseUpdate,
        processId: data.toProcessId,
        processType: data.toProcessType,
        processStartedAt: event.occurred_at,
        isProcessCompleted: false,
        terminalOutcome: null,
        processCompletedAt: null,
        stageTransitionCount: 0,
        // If initial stage is set, apply it
        stageId: data.initialStageId ?? state.stageId,
        stageName: data.initialStageName ?? state.stageName,
        stageEnteredAt: data.initialStageId ? event.occurred_at : state.stageEnteredAt,
      };
    }

    case 'CompanyProductStageSet': {
      const data = eventData as StageSetEventData;
      return {
        ...state,
        ...baseUpdate,
        stageId: data.toStageId,
        stageName: data.toStageName,
        stageOrder: data.toStageOrder,
        stageEnteredAt: event.occurred_at,
        stageTransitionCount: state.stageTransitionCount + 1,
      };
    }

    case 'CompanyProductProcessCompleted': {
      const data = eventData as ProcessCompletedEventData;
      return {
        ...state,
        ...baseUpdate,
        isProcessCompleted: true,
        terminalOutcome: data.outcome,
        processCompletedAt: event.occurred_at,
      };
    }

    case 'CompanyProductHealthUpdated': {
      const data = eventData as HealthUpdatedEventData;
      return {
        ...state,
        ...baseUpdate,
        healthScore: data.toScore,
        riskLevel: data.riskLevel,
      };
    }

    case 'CompanyProductOwnerSet': {
      const data = eventData as OwnerSetEventData;
      return {
        ...state,
        ...baseUpdate,
        ownerId: data.toOwnerId,
        ownerName: data.toOwnerName,
      };
    }

    case 'CompanyProductTierSet': {
      const data = eventData as TierSetEventData;
      return {
        ...state,
        ...baseUpdate,
        tier: data.toTier,
      };
    }

    case 'CompanyProductMRRSet': {
      const data = eventData as MRRSetEventData;
      return {
        ...state,
        ...baseUpdate,
        mrr: data.toMRR,
        mrrCurrency: data.currency,
      };
    }

    case 'CompanyProductSeatsSet': {
      const data = eventData as SeatsSetEventData;
      return {
        ...state,
        ...baseUpdate,
        seats: data.toSeats,
      };
    }

    case 'CompanyProductNextStepDueSet': {
      const data = eventData as NextStepDueSetEventData;
      return {
        ...state,
        ...baseUpdate,
        nextStep: data.toNextStep,
        nextStepDueDate: data.toDueDate,
      };
    }

    case 'CompanyProductSLAWarning':
    case 'CompanyProductSLABreached':
    case 'CompanyProductActivityRecorded':
    case 'CompanyProductNoteAdded':
      // These events don't change core state, just update sequence
      return {
        ...state,
        ...baseUpdate,
      };

    default:
      // Unknown event type - log warning but don't break replay
      console.warn(`Unknown event type: ${event.event_type}`);
      return {
        ...state,
        ...baseUpdate,
      };
  }
}

/**
 * Replays a sequence of events to produce final state.
 * Events MUST be in sequence order.
 */
export function replayEvents(
  initialState: CompanyProductState,
  events: EventStore[]
): CompanyProductState {
  // Verify events are in order
  for (let i = 1; i < events.length; i++) {
    if (events[i].sequence_number <= events[i - 1].sequence_number) {
      throw new Error(
        `Events out of order: sequence ${events[i].sequence_number} after ${events[i - 1].sequence_number}`
      );
    }
  }

  return events.reduce((state, event) => applyEvent(state, event), initialState);
}

// ============================================================================
// AGGREGATE LOADING
// ============================================================================

/**
 * Loaded aggregate with state and metadata.
 */
export interface LoadedAggregate {
  /** Computed state from event replay */
  state: CompanyProductState;
  /** Raw events for audit/debugging */
  events: EventStore[];
  /** Whether the aggregate exists (has events) */
  exists: boolean;
}

/**
 * Loads an aggregate by replaying all its events.
 * This is a READ-ONLY operation - no database writes.
 *
 * @param supabase - Supabase client
 * @param companyProductId - The aggregate ID (company_product_id)
 * @param companyId - Company ID for initial state
 * @param productId - Product ID for initial state
 * @returns Loaded aggregate with computed state
 */
export async function loadAggregate(
  supabase: AnySupabaseClient,
  companyProductId: string,
  companyId: string,
  productId: string
): Promise<LoadedAggregate> {
  // Fetch all events for this aggregate in order
  const { data: events, error } = await supabase
    .from('event_store')
    .select('*')
    .eq('aggregate_type', 'CompanyProduct')
    .eq('aggregate_id', companyProductId)
    .order('sequence_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to load events: ${error.message}`);
  }

  const typedEvents = (events || []) as EventStore[];
  const initialState = createInitialState(companyProductId, companyId, productId);

  if (typedEvents.length === 0) {
    return {
      state: initialState,
      events: [],
      exists: false,
    };
  }

  // Replay all events to compute current state
  const state = replayEvents(initialState, typedEvents);

  return {
    state,
    events: typedEvents,
    exists: true,
  };
}

/**
 * Loads aggregate state from a specific point in time.
 * Useful for debugging and time-travel queries.
 *
 * @param supabase - Supabase client
 * @param companyProductId - The aggregate ID
 * @param companyId - Company ID for initial state
 * @param productId - Product ID for initial state
 * @param upToSequence - Replay events up to this sequence number
 * @returns Loaded aggregate at the specified point
 */
export async function loadAggregateAtSequence(
  supabase: AnySupabaseClient,
  companyProductId: string,
  companyId: string,
  productId: string,
  upToSequence: number
): Promise<LoadedAggregate> {
  const { data: events, error } = await supabase
    .from('event_store')
    .select('*')
    .eq('aggregate_type', 'CompanyProduct')
    .eq('aggregate_id', companyProductId)
    .lte('sequence_number', upToSequence)
    .order('sequence_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to load events: ${error.message}`);
  }

  const typedEvents = (events || []) as EventStore[];
  const initialState = createInitialState(companyProductId, companyId, productId);

  if (typedEvents.length === 0) {
    return {
      state: initialState,
      events: [],
      exists: false,
    };
  }

  const state = replayEvents(initialState, typedEvents);

  return {
    state,
    events: typedEvents,
    exists: true,
  };
}

/**
 * Loads aggregate state at a specific point in time.
 *
 * @param supabase - Supabase client
 * @param companyProductId - The aggregate ID
 * @param companyId - Company ID for initial state
 * @param productId - Product ID for initial state
 * @param asOf - ISO timestamp - replay events up to this time
 * @returns Loaded aggregate at the specified time
 */
export async function loadAggregateAsOf(
  supabase: AnySupabaseClient,
  companyProductId: string,
  companyId: string,
  productId: string,
  asOf: string
): Promise<LoadedAggregate> {
  const { data: events, error } = await supabase
    .from('event_store')
    .select('*')
    .eq('aggregate_type', 'CompanyProduct')
    .eq('aggregate_id', companyProductId)
    .lte('occurred_at', asOf)
    .order('sequence_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to load events: ${error.message}`);
  }

  const typedEvents = (events || []) as EventStore[];
  const initialState = createInitialState(companyProductId, companyId, productId);

  if (typedEvents.length === 0) {
    return {
      state: initialState,
      events: [],
      exists: false,
    };
  }

  const state = replayEvents(initialState, typedEvents);

  return {
    state,
    events: typedEvents,
    exists: true,
  };
}
