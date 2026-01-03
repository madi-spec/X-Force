/**
 * SupportCase Commands
 *
 * This module implements command handlers for the SupportCase aggregate.
 * Commands are validated, then events are appended atomically.
 *
 * ARCHITECTURE:
 * - Commands are the public API for state changes
 * - Validation happens BEFORE event creation
 * - Events are appended atomically with sequence guarantees
 * - Optimistic concurrency via expectedVersion
 *
 * RULES:
 * - All writes are commands -> events
 * - Projections are NEVER mutated in command handlers
 * - All state derived from events
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SupportCaseStatus,
  SupportCaseSeverity,
  SupportCaseSource,
  SLAType,
} from '@/types/supportCase';
import {
  type SupportCaseEvent,
  type SupportCaseCreated,
  type SupportCaseAssigned,
  type SupportCaseStatusChanged,
  type SupportCaseSeverityChanged,
  type SupportCaseResolved,
  type SupportCaseClosed,
  type SupportCaseReopened,
  type NextActionSet,
  type SlaConfigured,
  type EventMetadata,
  type ActorType,
  type CloseReason,
  SUPPORT_CASE_AGGREGATE_TYPE,
} from './events';
import {
  loadSupportCaseAggregate,
  isValidStatusTransition,
  canClose,
  canReopen,
} from './aggregate';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// ============================================================================
// APPEND EVENT CORE
// ============================================================================

export interface AppendEventInput {
  aggregateId: string;
  event: SupportCaseEvent;
  expectedVersion?: number;
}

export interface AppendEventResult {
  success: boolean;
  eventId?: string;
  sequenceNumber?: number;
  error?: string;
}

/**
 * Appends an event to the event store atomically.
 */
export async function appendEvent(
  supabase: AnySupabaseClient,
  input: AppendEventInput
): Promise<AppendEventResult> {
  const { aggregateId, event, expectedVersion } = input;

  // If expectedVersion provided, verify it matches
  if (expectedVersion !== undefined) {
    const { data: currentMax, error: seqError } = await supabase.rpc(
      'get_next_event_sequence',
      {
        p_aggregate_type: SUPPORT_CASE_AGGREGATE_TYPE,
        p_aggregate_id: aggregateId,
      }
    );

    if (seqError) {
      return {
        success: false,
        error: `Failed to get sequence: ${seqError.message}`,
      };
    }

    const currentVersion = (currentMax as number) - 1;
    if (currentVersion !== expectedVersion) {
      return {
        success: false,
        error: `Concurrency conflict: expected version ${expectedVersion}, current is ${currentVersion}`,
      };
    }
  }

  // Use the atomic append_event function
  const { data: eventId, error } = await supabase.rpc('append_event', {
    p_aggregate_type: SUPPORT_CASE_AGGREGATE_TYPE,
    p_aggregate_id: aggregateId,
    p_event_type: event.type,
    p_event_data: event.data,
    p_actor_type: event.actor.type,
    p_actor_id: event.actor.id ?? null,
    p_metadata: event.metadata ?? null,
  });

  if (error) {
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      return {
        success: false,
        error: 'Concurrent modification detected. Please retry.',
      };
    }
    return {
      success: false,
      error: `Failed to append event: ${error.message}`,
    };
  }

  // Get the sequence number of the created event
  const { data: createdEvent, error: fetchError } = await supabase
    .from('event_store')
    .select('sequence_number')
    .eq('id', eventId)
    .single();

  if (fetchError) {
    return {
      success: true,
      eventId: eventId as string,
    };
  }

  return {
    success: true,
    eventId: eventId as string,
    sequenceNumber: createdEvent.sequence_number,
  };
}

// ============================================================================
// COMMAND: CREATE SUPPORT CASE
// ============================================================================

export interface CreateSupportCaseCommand {
  supportCaseId: string;
  companyId: string;
  companyProductId?: string | null;
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
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Creates a new support case.
 * Emits: SupportCaseCreated
 */
export async function createSupportCase(
  supabase: AnySupabaseClient,
  command: CreateSupportCaseCommand
): Promise<AppendEventResult> {
  // Validate title
  if (!command.title || command.title.trim().length === 0) {
    return {
      success: false,
      error: 'Title is required',
    };
  }

  // Check if aggregate already exists
  const { exists } = await loadSupportCaseAggregate(
    supabase,
    command.supportCaseId,
    command.companyId,
    command.companyProductId ?? null
  );

  if (exists) {
    return {
      success: false,
      error: 'Support case already exists',
    };
  }

  // Create identity row in support_cases table
  const { error: insertError } = await supabase
    .from('support_cases')
    .insert({
      id: command.supportCaseId,
      company_id: command.companyId,
      company_product_id: command.companyProductId ?? null,
    });

  if (insertError) {
    return {
      success: false,
      error: `Failed to create support case identity: ${insertError.message}`,
    };
  }

  // Create event
  const event: SupportCaseCreated = {
    type: 'SupportCaseCreated',
    version: 1,
    data: {
      title: command.title,
      description: command.description,
      severity: command.severity,
      category: command.category,
      subcategory: command.subcategory,
      source: command.source,
      externalId: command.externalId,
      contactId: command.contactId,
      contactEmail: command.contactEmail,
      contactName: command.contactName,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.supportCaseId,
    event,
  });
}

// ============================================================================
// COMMAND: ASSIGN SUPPORT CASE
// ============================================================================

export interface AssignSupportCaseCommand {
  supportCaseId: string;
  companyId: string;
  companyProductId?: string | null;
  ownerId: string;
  ownerName: string;
  team?: string;
  reason?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Assigns a support case to an owner.
 * Emits: SupportCaseAssigned
 */
export async function assignSupportCase(
  supabase: AnySupabaseClient,
  command: AssignSupportCaseCommand
): Promise<AppendEventResult> {
  const { state, exists } = await loadSupportCaseAggregate(
    supabase,
    command.supportCaseId,
    command.companyId,
    command.companyProductId ?? null
  );

  if (!exists) {
    return {
      success: false,
      error: 'Support case not found',
    };
  }

  if (state.isClosed) {
    return {
      success: false,
      error: 'Cannot assign a closed case',
    };
  }

  const event: SupportCaseAssigned = {
    type: 'SupportCaseAssigned',
    version: 1,
    data: {
      fromOwnerId: state.ownerId,
      fromOwnerName: state.ownerName,
      toOwnerId: command.ownerId,
      toOwnerName: command.ownerName,
      team: command.team,
      reason: command.reason,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.supportCaseId,
    event,
    expectedVersion: state.version,
  });
}

// ============================================================================
// COMMAND: CHANGE STATUS
// ============================================================================

export interface ChangeSupportCaseStatusCommand {
  supportCaseId: string;
  companyId: string;
  companyProductId?: string | null;
  toStatus: SupportCaseStatus;
  reason?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Changes the status of a support case.
 * Emits: SupportCaseStatusChanged
 */
export async function changeSupportCaseStatus(
  supabase: AnySupabaseClient,
  command: ChangeSupportCaseStatusCommand
): Promise<AppendEventResult> {
  const { state, exists } = await loadSupportCaseAggregate(
    supabase,
    command.supportCaseId,
    command.companyId,
    command.companyProductId ?? null
  );

  if (!exists) {
    return {
      success: false,
      error: 'Support case not found',
    };
  }

  // Validate status transition
  if (!isValidStatusTransition(state.status, command.toStatus)) {
    return {
      success: false,
      error: `Invalid status transition: ${state.status} -> ${command.toStatus}`,
    };
  }

  const event: SupportCaseStatusChanged = {
    type: 'SupportCaseStatusChanged',
    version: 1,
    data: {
      fromStatus: state.status,
      toStatus: command.toStatus,
      reason: command.reason,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.supportCaseId,
    event,
    expectedVersion: state.version,
  });
}

// ============================================================================
// COMMAND: CHANGE SEVERITY
// ============================================================================

export interface ChangeSupportCaseSeverityCommand {
  supportCaseId: string;
  companyId: string;
  companyProductId?: string | null;
  toSeverity: SupportCaseSeverity;
  reason?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Changes the severity of a support case.
 * Emits: SupportCaseSeverityChanged
 */
export async function changeSupportCaseSeverity(
  supabase: AnySupabaseClient,
  command: ChangeSupportCaseSeverityCommand
): Promise<AppendEventResult> {
  const { state, exists } = await loadSupportCaseAggregate(
    supabase,
    command.supportCaseId,
    command.companyId,
    command.companyProductId ?? null
  );

  if (!exists) {
    return {
      success: false,
      error: 'Support case not found',
    };
  }

  if (state.isClosed) {
    return {
      success: false,
      error: 'Cannot change severity of a closed case',
    };
  }

  if (state.severity === command.toSeverity) {
    return {
      success: false,
      error: 'Severity is already set to this value',
    };
  }

  // TODO: Calculate new SLA deadlines based on new severity
  // For now, we just emit the event without recalculating SLAs

  const event: SupportCaseSeverityChanged = {
    type: 'SupportCaseSeverityChanged',
    version: 1,
    data: {
      fromSeverity: state.severity,
      toSeverity: command.toSeverity,
      reason: command.reason,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.supportCaseId,
    event,
    expectedVersion: state.version,
  });
}

// ============================================================================
// COMMAND: SET NEXT ACTION
// ============================================================================

export interface SetSupportCaseNextActionCommand {
  supportCaseId: string;
  companyId: string;
  companyProductId?: string | null;
  action: string;
  dueAt: string;
  assignedToId?: string;
  assignedToName?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Sets the next action for a support case.
 * Emits: NextActionSet
 */
export async function setSupportCaseNextAction(
  supabase: AnySupabaseClient,
  command: SetSupportCaseNextActionCommand
): Promise<AppendEventResult> {
  const { state, exists } = await loadSupportCaseAggregate(
    supabase,
    command.supportCaseId,
    command.companyId,
    command.companyProductId ?? null
  );

  if (!exists) {
    return {
      success: false,
      error: 'Support case not found',
    };
  }

  if (state.isClosed) {
    return {
      success: false,
      error: 'Cannot set next action on a closed case',
    };
  }

  if (!command.action || command.action.trim().length === 0) {
    return {
      success: false,
      error: 'Action description is required',
    };
  }

  // Validate due date
  const dueAt = new Date(command.dueAt);
  if (isNaN(dueAt.getTime())) {
    return {
      success: false,
      error: 'Invalid due date format',
    };
  }

  const event: NextActionSet = {
    type: 'NextActionSet',
    version: 1,
    data: {
      fromAction: state.nextAction,
      fromDueAt: state.nextActionDueAt,
      toAction: command.action,
      toDueAt: command.dueAt,
      assignedToId: command.assignedToId,
      assignedToName: command.assignedToName,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.supportCaseId,
    event,
    expectedVersion: state.version,
  });
}

// ============================================================================
// COMMAND: CONFIGURE SLA
// ============================================================================

export interface ConfigureSupportCaseSlaCommand {
  supportCaseId: string;
  companyId: string;
  companyProductId?: string | null;
  slaType: SLAType;
  targetHours: number;
  configSource?: 'default' | 'product' | 'manual';
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Configures SLA for a support case.
 * Emits: SlaConfigured
 */
export async function configureSupportCaseSla(
  supabase: AnySupabaseClient,
  command: ConfigureSupportCaseSlaCommand
): Promise<AppendEventResult> {
  const { state, exists } = await loadSupportCaseAggregate(
    supabase,
    command.supportCaseId,
    command.companyId,
    command.companyProductId ?? null
  );

  if (!exists) {
    return {
      success: false,
      error: 'Support case not found',
    };
  }

  if (state.isClosed) {
    return {
      success: false,
      error: 'Cannot configure SLA on a closed case',
    };
  }

  // Calculate due date
  const now = new Date();
  const dueAt = new Date(now.getTime() + command.targetHours * 60 * 60 * 1000);
  const warningAt = new Date(now.getTime() + command.targetHours * 0.75 * 60 * 60 * 1000);

  const event: SlaConfigured = {
    type: 'SlaConfigured',
    version: 1,
    data: {
      slaType: command.slaType,
      targetHours: command.targetHours,
      dueAt: dueAt.toISOString(),
      warningAt: warningAt.toISOString(),
      configSource: command.configSource ?? 'manual',
    },
    occurredAt: now.toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.supportCaseId,
    event,
    expectedVersion: state.version,
  });
}

// ============================================================================
// COMMAND: RESOLVE SUPPORT CASE
// ============================================================================

export interface ResolveSupportCaseCommand {
  supportCaseId: string;
  companyId: string;
  companyProductId?: string | null;
  resolutionSummary: string;
  rootCause?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Resolves a support case.
 * Emits: SupportCaseResolved
 */
export async function resolveSupportCase(
  supabase: AnySupabaseClient,
  command: ResolveSupportCaseCommand
): Promise<AppendEventResult> {
  const { state, exists } = await loadSupportCaseAggregate(
    supabase,
    command.supportCaseId,
    command.companyId,
    command.companyProductId ?? null
  );

  if (!exists) {
    return {
      success: false,
      error: 'Support case not found',
    };
  }

  if (state.isResolved) {
    return {
      success: false,
      error: 'Support case is already resolved',
    };
  }

  if (state.isClosed) {
    return {
      success: false,
      error: 'Cannot resolve a closed case',
    };
  }

  if (!command.resolutionSummary || command.resolutionSummary.trim().length === 0) {
    return {
      success: false,
      error: 'Resolution summary is required',
    };
  }

  // Calculate resolution time
  const openedAt = state.openedAt ? new Date(state.openedAt) : new Date();
  const now = new Date();
  const resolutionTimeHours = (now.getTime() - openedAt.getTime()) / (1000 * 60 * 60);

  // Check if SLA was met
  const slaHours = state.resolutionSla?.targetHours ?? 0;
  const slaMet = slaHours === 0 || resolutionTimeHours <= slaHours;

  const event: SupportCaseResolved = {
    type: 'SupportCaseResolved',
    version: 1,
    data: {
      resolutionSummary: command.resolutionSummary,
      rootCause: command.rootCause,
      resolutionTimeHours: Math.round(resolutionTimeHours * 100) / 100,
      slaHours,
      slaMet,
    },
    occurredAt: now.toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.supportCaseId,
    event,
    expectedVersion: state.version,
  });
}

// ============================================================================
// COMMAND: CLOSE SUPPORT CASE
// ============================================================================

export interface CloseSupportCaseCommand {
  supportCaseId: string;
  companyId: string;
  companyProductId?: string | null;
  closeReason: CloseReason;
  notes?: string;
  forceClose?: boolean;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Closes a support case.
 * By default, requires the case to be resolved first.
 * Use forceClose to close without resolution.
 * Emits: SupportCaseClosed
 */
export async function closeSupportCase(
  supabase: AnySupabaseClient,
  command: CloseSupportCaseCommand
): Promise<AppendEventResult> {
  const { state, exists } = await loadSupportCaseAggregate(
    supabase,
    command.supportCaseId,
    command.companyId,
    command.companyProductId ?? null
  );

  if (!exists) {
    return {
      success: false,
      error: 'Support case not found',
    };
  }

  // Check if case can be closed
  const closeCheck = canClose(state, command.forceClose ?? false);
  if (!closeCheck.canClose) {
    return {
      success: false,
      error: closeCheck.reason ?? 'Cannot close case',
    };
  }

  const event: SupportCaseClosed = {
    type: 'SupportCaseClosed',
    version: 1,
    data: {
      closeReason: command.closeReason,
      notes: command.notes,
      forcedClose: !state.isResolved && (command.forceClose ?? false),
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.supportCaseId,
    event,
    expectedVersion: state.version,
  });
}

// ============================================================================
// COMMAND: REOPEN SUPPORT CASE
// ============================================================================

export interface ReopenSupportCaseCommand {
  supportCaseId: string;
  companyId: string;
  companyProductId?: string | null;
  reason: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Reopens a closed or resolved support case.
 * Emits: SupportCaseReopened
 */
export async function reopenSupportCase(
  supabase: AnySupabaseClient,
  command: ReopenSupportCaseCommand
): Promise<AppendEventResult> {
  const { state, exists } = await loadSupportCaseAggregate(
    supabase,
    command.supportCaseId,
    command.companyId,
    command.companyProductId ?? null
  );

  if (!exists) {
    return {
      success: false,
      error: 'Support case not found',
    };
  }

  // Check if case can be reopened
  const reopenCheck = canReopen(state);
  if (!reopenCheck.canReopen) {
    return {
      success: false,
      error: reopenCheck.reason ?? 'Cannot reopen case',
    };
  }

  if (!command.reason || command.reason.trim().length === 0) {
    return {
      success: false,
      error: 'Reason for reopening is required',
    };
  }

  const event: SupportCaseReopened = {
    type: 'SupportCaseReopened',
    version: 1,
    data: {
      reason: command.reason,
      previousCloseReason: state.closeReason ?? undefined,
      reopenedFromStatus: state.status,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.supportCaseId,
    event,
    expectedVersion: state.version,
  });
}
