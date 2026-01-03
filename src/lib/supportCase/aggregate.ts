/**
 * SupportCase Aggregate
 *
 * This module implements the aggregate root for SupportCase.
 * State is computed by replaying events in order - never stored directly.
 *
 * ARCHITECTURE:
 * - loadSupportCaseAggregate() replays all events to compute current state
 * - State is immutable and deterministic
 * - No database writes happen during replay
 * - Projections are separate from aggregate state
 *
 * AGGREGATE_TYPE: 'support_case'
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventStore } from '@/types/eventSourcing';
import type {
  SupportCaseStatus,
  SupportCaseSeverity,
  SupportCaseSource,
  SLAType,
} from '@/types/supportCase';
import { SUPPORT_CASE_AGGREGATE_TYPE, type CloseReason } from './events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// ============================================================================
// AGGREGATE STATE
// ============================================================================

/**
 * SLA tracking state for a single SLA type.
 */
export interface SlaState {
  slaType: SLAType;
  targetHours: number;
  dueAt: string;
  warningAt?: string;
  metAt?: string;
  breachedAt?: string;
  isBreached: boolean;
}

/**
 * In-memory state of a SupportCase aggregate.
 * This is computed by replaying events - never stored directly.
 */
export interface SupportCaseState {
  /** Aggregate ID (support_case_id) */
  readonly id: string;
  /** Company ID */
  readonly companyId: string;
  /** Company Product ID (optional) */
  readonly companyProductId: string | null;

  // === Case Information ===
  readonly title: string | null;
  readonly description: string | null;
  readonly externalId: string | null;
  readonly source: SupportCaseSource | null;

  // === Status ===
  readonly status: SupportCaseStatus;
  readonly severity: SupportCaseSeverity;
  readonly isResolved: boolean;
  readonly isClosed: boolean;

  // === Category ===
  readonly category: string | null;
  readonly subcategory: string | null;
  readonly tags: string[];

  // === Assignment ===
  readonly ownerId: string | null;
  readonly ownerName: string | null;
  readonly assignedTeam: string | null;

  // === SLA Tracking ===
  readonly firstResponseSla: SlaState | null;
  readonly resolutionSla: SlaState | null;
  readonly firstResponseAt: string | null;
  readonly resolvedAt: string | null;
  readonly closedAt: string | null;

  // === Timing ===
  readonly openedAt: string | null;
  readonly lastCustomerContactAt: string | null;
  readonly lastAgentResponseAt: string | null;

  // === Next Action ===
  readonly nextAction: string | null;
  readonly nextActionDueAt: string | null;
  readonly nextActionAssignedToId: string | null;

  // === Metrics ===
  readonly customerMessageCount: number;
  readonly agentResponseCount: number;
  readonly internalNoteCount: number;
  readonly escalationLevel: number;
  readonly reopenCount: number;

  // === Resolution ===
  readonly resolutionSummary: string | null;
  readonly rootCause: string | null;
  readonly closeReason: CloseReason | null;

  // === Customer Satisfaction ===
  readonly csatScore: number | null;
  readonly csatComment: string | null;

  // === Contact Info ===
  readonly contactId: string | null;
  readonly contactEmail: string | null;
  readonly contactName: string | null;

  // === Event Tracking ===
  readonly lastEventSequence: number;
  readonly lastEventAt: string | null;
  readonly version: number;
}

/**
 * Creates initial empty state for a new aggregate.
 */
export function createInitialState(
  id: string,
  companyId: string,
  companyProductId: string | null
): SupportCaseState {
  return {
    id,
    companyId,
    companyProductId,
    title: null,
    description: null,
    externalId: null,
    source: null,
    status: 'open',
    severity: 'medium',
    isResolved: false,
    isClosed: false,
    category: null,
    subcategory: null,
    tags: [],
    ownerId: null,
    ownerName: null,
    assignedTeam: null,
    firstResponseSla: null,
    resolutionSla: null,
    firstResponseAt: null,
    resolvedAt: null,
    closedAt: null,
    openedAt: null,
    lastCustomerContactAt: null,
    lastAgentResponseAt: null,
    nextAction: null,
    nextActionDueAt: null,
    nextActionAssignedToId: null,
    customerMessageCount: 0,
    agentResponseCount: 0,
    internalNoteCount: 0,
    escalationLevel: 0,
    reopenCount: 0,
    resolutionSummary: null,
    rootCause: null,
    closeReason: null,
    csatScore: null,
    csatComment: null,
    contactId: null,
    contactEmail: null,
    contactName: null,
    lastEventSequence: 0,
    lastEventAt: null,
    version: 0,
  };
}

// ============================================================================
// EVENT APPLICATION (REDUCER)
// ============================================================================

// Type helpers for event data extraction
interface SupportCaseCreatedEventData {
  title: string;
  description?: string;
  severity: SupportCaseSeverity;
  category?: string;
  subcategory?: string;
  source: SupportCaseSource;
  externalId?: string;
  contactId?: string;
  contactEmail?: string;
  contactName?: string;
}

interface SupportCaseAssignedEventData {
  toOwnerId: string;
  toOwnerName: string;
  team?: string;
}

interface SupportCaseStatusChangedEventData {
  toStatus: SupportCaseStatus;
}

interface SupportCaseSeverityChangedEventData {
  toSeverity: SupportCaseSeverity;
  newFirstResponseDueAt?: string;
  newResolutionDueAt?: string;
}

interface SupportCaseCategoryChangedEventData {
  toCategory: string;
  toSubcategory?: string;
}

interface CustomerMessageLoggedEventData {
  receivedAt: string;
}

interface AgentResponseSentEventData {
  isFirstResponse: boolean;
}

interface InternalNoteAddedEventData {
  noteId: string;
}

interface NextActionSetEventData {
  toAction: string;
  toDueAt: string;
  assignedToId?: string;
}

interface SlaConfiguredEventData {
  slaType: SLAType;
  targetHours: number;
  dueAt: string;
  warningAt?: string;
}

interface SlaBreachedEventData {
  slaType: SLAType;
  breachedAt: string;
}

interface SupportCaseResolvedEventData {
  resolutionSummary: string;
  rootCause?: string;
}

interface SupportCaseClosedEventData {
  closeReason: CloseReason;
}

interface SupportCaseReopenedEventData {
  reopenedFromStatus: SupportCaseStatus;
}

interface SupportCaseEscalatedEventData {
  escalationLevel: number;
  escalatedToTeam?: string;
}

interface CsatSubmittedEventData {
  score: number;
  comment?: string;
}

interface TagAddedEventData {
  tag: string;
}

interface TagRemovedEventData {
  tag: string;
}

/**
 * Applies a single event to the current state, producing new state.
 * This is a pure function - no side effects.
 */
export function applyEvent(
  state: SupportCaseState,
  event: EventStore
): SupportCaseState {
  const eventData = event.event_data as unknown;
  const baseUpdate = {
    lastEventSequence: event.sequence_number,
    lastEventAt: event.occurred_at,
    version: state.version + 1,
  };

  switch (event.event_type) {
    case 'SupportCaseCreated': {
      const data = eventData as SupportCaseCreatedEventData;
      return {
        ...state,
        ...baseUpdate,
        title: data.title,
        description: data.description ?? null,
        severity: data.severity,
        category: data.category ?? null,
        subcategory: data.subcategory ?? null,
        source: data.source,
        externalId: data.externalId ?? null,
        contactId: data.contactId ?? null,
        contactEmail: data.contactEmail ?? null,
        contactName: data.contactName ?? null,
        status: 'open',
        openedAt: event.occurred_at,
      };
    }

    case 'SupportCaseAssigned': {
      const data = eventData as SupportCaseAssignedEventData;
      return {
        ...state,
        ...baseUpdate,
        ownerId: data.toOwnerId,
        ownerName: data.toOwnerName,
        assignedTeam: data.team ?? state.assignedTeam,
      };
    }

    case 'SupportCaseStatusChanged': {
      const data = eventData as SupportCaseStatusChangedEventData;
      return {
        ...state,
        ...baseUpdate,
        status: data.toStatus,
      };
    }

    case 'SupportCaseSeverityChanged': {
      const data = eventData as SupportCaseSeverityChangedEventData;
      let newFirstResponseSla = state.firstResponseSla;
      let newResolutionSla = state.resolutionSla;

      // Update SLA deadlines if provided
      if (data.newFirstResponseDueAt && state.firstResponseSla) {
        newFirstResponseSla = {
          ...state.firstResponseSla,
          dueAt: data.newFirstResponseDueAt,
        };
      }
      if (data.newResolutionDueAt && state.resolutionSla) {
        newResolutionSla = {
          ...state.resolutionSla,
          dueAt: data.newResolutionDueAt,
        };
      }

      return {
        ...state,
        ...baseUpdate,
        severity: data.toSeverity,
        firstResponseSla: newFirstResponseSla,
        resolutionSla: newResolutionSla,
      };
    }

    case 'SupportCaseCategoryChanged': {
      const data = eventData as SupportCaseCategoryChangedEventData;
      return {
        ...state,
        ...baseUpdate,
        category: data.toCategory,
        subcategory: data.toSubcategory ?? null,
      };
    }

    case 'CustomerMessageLogged': {
      const data = eventData as CustomerMessageLoggedEventData;
      return {
        ...state,
        ...baseUpdate,
        customerMessageCount: state.customerMessageCount + 1,
        lastCustomerContactAt: data.receivedAt,
      };
    }

    case 'AgentResponseSent': {
      const data = eventData as AgentResponseSentEventData;
      return {
        ...state,
        ...baseUpdate,
        agentResponseCount: state.agentResponseCount + 1,
        lastAgentResponseAt: event.occurred_at,
        firstResponseAt: data.isFirstResponse ? event.occurred_at : state.firstResponseAt,
        // Mark first response SLA as met if this is first response
        firstResponseSla: data.isFirstResponse && state.firstResponseSla
          ? { ...state.firstResponseSla, metAt: event.occurred_at }
          : state.firstResponseSla,
      };
    }

    case 'InternalNoteAdded': {
      return {
        ...state,
        ...baseUpdate,
        internalNoteCount: state.internalNoteCount + 1,
      };
    }

    case 'NextActionSet': {
      const data = eventData as NextActionSetEventData;
      return {
        ...state,
        ...baseUpdate,
        nextAction: data.toAction,
        nextActionDueAt: data.toDueAt,
        nextActionAssignedToId: data.assignedToId ?? null,
      };
    }

    case 'SlaConfigured': {
      const data = eventData as SlaConfiguredEventData;
      const slaState: SlaState = {
        slaType: data.slaType,
        targetHours: data.targetHours,
        dueAt: data.dueAt,
        warningAt: data.warningAt,
        isBreached: false,
      };

      if (data.slaType === 'first_response') {
        return {
          ...state,
          ...baseUpdate,
          firstResponseSla: slaState,
        };
      } else if (data.slaType === 'resolution') {
        return {
          ...state,
          ...baseUpdate,
          resolutionSla: slaState,
        };
      }
      return { ...state, ...baseUpdate };
    }

    case 'SlaBreached': {
      const data = eventData as SlaBreachedEventData;

      if (data.slaType === 'first_response' && state.firstResponseSla) {
        return {
          ...state,
          ...baseUpdate,
          firstResponseSla: {
            ...state.firstResponseSla,
            breachedAt: data.breachedAt,
            isBreached: true,
          },
        };
      } else if (data.slaType === 'resolution' && state.resolutionSla) {
        return {
          ...state,
          ...baseUpdate,
          resolutionSla: {
            ...state.resolutionSla,
            breachedAt: data.breachedAt,
            isBreached: true,
          },
        };
      }
      return { ...state, ...baseUpdate };
    }

    case 'SupportCaseResolved': {
      const data = eventData as SupportCaseResolvedEventData;
      return {
        ...state,
        ...baseUpdate,
        status: 'resolved',
        isResolved: true,
        resolvedAt: event.occurred_at,
        resolutionSummary: data.resolutionSummary,
        rootCause: data.rootCause ?? null,
        // Mark resolution SLA as met
        resolutionSla: state.resolutionSla
          ? { ...state.resolutionSla, metAt: event.occurred_at }
          : null,
      };
    }

    case 'SupportCaseClosed': {
      const data = eventData as SupportCaseClosedEventData;
      return {
        ...state,
        ...baseUpdate,
        status: 'closed',
        isClosed: true,
        closedAt: event.occurred_at,
        closeReason: data.closeReason,
      };
    }

    case 'SupportCaseReopened': {
      return {
        ...state,
        ...baseUpdate,
        status: 'open',
        isResolved: false,
        isClosed: false,
        resolvedAt: null,
        closedAt: null,
        closeReason: null,
        reopenCount: state.reopenCount + 1,
      };
    }

    case 'SupportCaseEscalated': {
      const data = eventData as SupportCaseEscalatedEventData;
      return {
        ...state,
        ...baseUpdate,
        status: 'escalated',
        escalationLevel: data.escalationLevel,
        assignedTeam: data.escalatedToTeam ?? state.assignedTeam,
      };
    }

    case 'CsatSubmitted': {
      const data = eventData as CsatSubmittedEventData;
      return {
        ...state,
        ...baseUpdate,
        csatScore: data.score,
        csatComment: data.comment ?? null,
      };
    }

    case 'TagAdded': {
      const data = eventData as TagAddedEventData;
      if (state.tags.includes(data.tag)) {
        return { ...state, ...baseUpdate };
      }
      return {
        ...state,
        ...baseUpdate,
        tags: [...state.tags, data.tag],
      };
    }

    case 'TagRemoved': {
      const data = eventData as TagRemovedEventData;
      return {
        ...state,
        ...baseUpdate,
        tags: state.tags.filter(t => t !== data.tag),
      };
    }

    default:
      console.warn(`Unknown event type: ${event.event_type}`);
      return { ...state, ...baseUpdate };
  }
}

/**
 * Replays a sequence of events to produce final state.
 * Events MUST be in sequence order.
 *
 * @throws Error if events are not in monotonic sequence order
 */
export function replayEvents(
  initialState: SupportCaseState,
  events: EventStore[]
): SupportCaseState {
  // Verify events are in strict monotonic order
  for (let i = 1; i < events.length; i++) {
    if (events[i].sequence_number <= events[i - 1].sequence_number) {
      throw new Error(
        `Events out of order: sequence ${events[i].sequence_number} after ${events[i - 1].sequence_number}. ` +
        `Sequence numbers must be strictly monotonic.`
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
export interface LoadedSupportCaseAggregate {
  /** Computed state from event replay */
  state: SupportCaseState;
  /** Raw events for audit/debugging */
  events: EventStore[];
  /** Whether the aggregate exists (has events) */
  exists: boolean;
}

/**
 * Loads a SupportCase aggregate by replaying all its events.
 * This is a READ-ONLY operation - no database writes.
 *
 * @param supabase - Supabase client
 * @param supportCaseId - The aggregate ID
 * @param companyId - Company ID for initial state
 * @param companyProductId - Optional company product ID
 * @returns Loaded aggregate with computed state
 */
export async function loadSupportCaseAggregate(
  supabase: AnySupabaseClient,
  supportCaseId: string,
  companyId: string,
  companyProductId: string | null = null
): Promise<LoadedSupportCaseAggregate> {
  // Fetch all events for this aggregate in order
  const { data: events, error } = await supabase
    .from('event_store')
    .select('*')
    .eq('aggregate_type', SUPPORT_CASE_AGGREGATE_TYPE)
    .eq('aggregate_id', supportCaseId)
    .order('sequence_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to load events: ${error.message}`);
  }

  const typedEvents = (events || []) as EventStore[];
  const initialState = createInitialState(supportCaseId, companyId, companyProductId);

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
 * Loads aggregate state at a specific sequence number.
 * Useful for debugging and time-travel queries.
 */
export async function loadSupportCaseAggregateAtSequence(
  supabase: AnySupabaseClient,
  supportCaseId: string,
  companyId: string,
  companyProductId: string | null,
  upToSequence: number
): Promise<LoadedSupportCaseAggregate> {
  const { data: events, error } = await supabase
    .from('event_store')
    .select('*')
    .eq('aggregate_type', SUPPORT_CASE_AGGREGATE_TYPE)
    .eq('aggregate_id', supportCaseId)
    .lte('sequence_number', upToSequence)
    .order('sequence_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to load events: ${error.message}`);
  }

  const typedEvents = (events || []) as EventStore[];
  const initialState = createInitialState(supportCaseId, companyId, companyProductId);

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

// ============================================================================
// STATE INVARIANT CHECKS
// ============================================================================

/**
 * Status transition rules for support cases.
 * Key: current status, Value: allowed target statuses
 */
export const VALID_STATUS_TRANSITIONS: Record<SupportCaseStatus, SupportCaseStatus[]> = {
  open: ['in_progress', 'waiting_on_customer', 'waiting_on_internal', 'escalated', 'resolved', 'closed'],
  in_progress: ['open', 'waiting_on_customer', 'waiting_on_internal', 'escalated', 'resolved', 'closed'],
  waiting_on_customer: ['open', 'in_progress', 'waiting_on_internal', 'escalated', 'resolved', 'closed'],
  waiting_on_internal: ['open', 'in_progress', 'waiting_on_customer', 'escalated', 'resolved', 'closed'],
  escalated: ['open', 'in_progress', 'waiting_on_customer', 'waiting_on_internal', 'resolved', 'closed'],
  resolved: ['closed', 'open'], // Can reopen from resolved
  closed: ['open'], // Can only reopen from closed
};

/**
 * Checks if a status transition is valid.
 */
export function isValidStatusTransition(
  fromStatus: SupportCaseStatus,
  toStatus: SupportCaseStatus
): boolean {
  if (fromStatus === toStatus) {
    return false; // No-op transitions not allowed
  }
  return VALID_STATUS_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

/**
 * Checks if a case can be closed.
 * By default, a case must be resolved before closing.
 * Can be overridden with forceClose flag.
 */
export function canClose(
  state: SupportCaseState,
  forceClose: boolean = false
): { canClose: boolean; reason?: string } {
  if (state.isClosed) {
    return { canClose: false, reason: 'Case is already closed' };
  }

  if (!state.isResolved && !forceClose) {
    return {
      canClose: false,
      reason: 'Case must be resolved before closing. Use forceClose to override.',
    };
  }

  return { canClose: true };
}

/**
 * Checks if a case can be reopened.
 */
export function canReopen(state: SupportCaseState): { canReopen: boolean; reason?: string } {
  if (!state.isClosed && !state.isResolved) {
    return { canReopen: false, reason: 'Case is not closed or resolved' };
  }

  return { canReopen: true };
}
