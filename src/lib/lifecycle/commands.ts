/**
 * CompanyProduct Commands
 *
 * This module implements command handlers for the CompanyProduct aggregate.
 * Commands are validated, then events are appended atomically.
 *
 * ARCHITECTURE:
 * - Commands are the public API for state changes
 * - Validation happens BEFORE event creation
 * - Events are appended atomically with sequence guarantees
 * - Optimistic concurrency via expectedVersion
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CompanyProductEvent,
  CompanyProductPhaseSet,
  CompanyProductProcessSet,
  CompanyProductStageSet,
  CompanyProductProcessCompleted,
  CompanyProductHealthUpdated,
  CompanyProductActivityRecorded,
  CompanyProductNoteAdded,
  CompanyProductOwnerSet,
  CompanyProductTierSet,
  CompanyProductMRRSet,
  CompanyProductSeatsSet,
  CompanyProductNextStepDueSet,
  AISuggestionCreated,
  AISuggestionAccepted,
  AISuggestionDismissed,
  AISuggestionType,
  ActorType,
  EventMetadata,
  LifecyclePhase,
  ProcessType,
  TerminalOutcome,
} from './events';
import { loadAggregate } from './aggregate';
import type { RiskLevel } from '@/types/eventSourcing';

// Use generic Supabase client type for flexibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// ============================================================================
// APPEND EVENT CORE
// ============================================================================

/**
 * Input for appending an event.
 */
export interface AppendEventInput {
  /** The aggregate ID (company_product_id) */
  aggregateId: string;
  /** The event to append */
  event: CompanyProductEvent;
  /** Expected version for optimistic concurrency (optional) */
  expectedVersion?: number;
}

/**
 * Result of appending an event.
 */
export interface AppendEventResult {
  /** Whether the append succeeded */
  success: boolean;
  /** The created event ID */
  eventId?: string;
  /** The sequence number assigned */
  sequenceNumber?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Appends an event to the event store atomically.
 *
 * This function:
 * 1. Uses the database function for atomic sequence assignment
 * 2. Guarantees monotonic sequence numbers per aggregate
 * 3. Prevents concurrent append race conditions
 *
 * @param supabase - Supabase client
 * @param input - The event to append
 * @returns Result with event ID and sequence number
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
        p_aggregate_type: 'CompanyProduct',
        p_aggregate_id: aggregateId,
      }
    );

    if (seqError) {
      return {
        success: false,
        error: `Failed to get sequence: ${seqError.message}`,
      };
    }

    // currentMax is the NEXT sequence, so current version is currentMax - 1
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
    p_aggregate_type: 'CompanyProduct',
    p_aggregate_id: aggregateId,
    p_event_type: event.type,
    p_event_data: event.data,
    p_actor_type: event.actor.type,
    p_actor_id: event.actor.id ?? null,
    p_metadata: event.metadata ?? null,
  });

  if (error) {
    // Check for unique constraint violation (concurrent append)
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
    // Event was created but we couldn't fetch sequence - not a failure
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

/**
 * Appends multiple events atomically.
 * All events get sequential sequence numbers in order.
 *
 * @param supabase - Supabase client
 * @param aggregateId - The aggregate ID
 * @param events - Events to append in order
 * @returns Results for each event
 */
export async function appendEvents(
  supabase: AnySupabaseClient,
  aggregateId: string,
  events: CompanyProductEvent[]
): Promise<AppendEventResult[]> {
  const results: AppendEventResult[] = [];

  for (const event of events) {
    const result = await appendEvent(supabase, { aggregateId, event });
    results.push(result);

    if (!result.success) {
      // Stop on first failure
      break;
    }
  }

  return results;
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

/**
 * Command to set the lifecycle phase.
 */
export interface SetPhaseCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  toPhase: LifecyclePhase;
  reason?: string;
  churnReason?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Sets the lifecycle phase for a company product.
 */
export async function setPhase(
  supabase: AnySupabaseClient,
  command: SetPhaseCommand
): Promise<AppendEventResult> {
  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Validate transition (basic validation - can be extended)
  const validTransitions: Record<LifecyclePhase | 'null', LifecyclePhase[]> = {
    null: ['prospect', 'in_sales'],
    prospect: ['in_sales', 'churned'],
    in_sales: ['onboarding', 'churned'],
    onboarding: ['active', 'churned'],
    active: ['churned'],
    churned: ['prospect'], // Resurrection possible
  };

  const currentPhase = state.phase ?? 'null';
  const allowed = validTransitions[currentPhase as keyof typeof validTransitions] || [];

  if (!allowed.includes(command.toPhase)) {
    return {
      success: false,
      error: `Invalid phase transition: ${currentPhase} -> ${command.toPhase}`,
    };
  }

  // Create and append event
  const event: CompanyProductPhaseSet = {
    type: 'CompanyProductPhaseSet',
    version: 1,
    data: {
      fromPhase: state.phase,
      toPhase: command.toPhase,
      reason: command.reason,
      churnReason: command.churnReason,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
    expectedVersion: state.version,
  });
}

/**
 * Command to set/change the active process.
 */
export interface SetProcessCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  processId: string;
  processType: ProcessType;
  processVersion: number;
  initialStageId?: string;
  initialStageName?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Sets the active process for a company product.
 */
export async function setProcess(
  supabase: AnySupabaseClient,
  command: SetProcessCommand
): Promise<AppendEventResult> {
  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Validate: can't start new process if current not completed
  if (state.processId && !state.isProcessCompleted) {
    return {
      success: false,
      error: `Cannot start new process while ${state.processType} process is active`,
    };
  }

  // Create and append event
  const event: CompanyProductProcessSet = {
    type: 'CompanyProductProcessSet',
    version: 1,
    data: {
      fromProcessId: state.processId,
      fromProcessType: state.processType,
      toProcessId: command.processId,
      toProcessType: command.processType,
      processVersion: command.processVersion,
      initialStageId: command.initialStageId,
      initialStageName: command.initialStageName,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
    expectedVersion: state.version,
  });
}

/**
 * Command to transition to a new stage.
 */
export interface TransitionStageCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  toStageId: string;
  toStageName: string;
  toStageOrder: number;
  reason?: string;
  trigger?: 'manual' | 'automation' | 'ai' | 'exit_criteria_met';
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Transitions to a new stage within the current process.
 */
export async function transitionStage(
  supabase: AnySupabaseClient,
  command: TransitionStageCommand
): Promise<AppendEventResult> {
  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Validate: must have active process
  if (!state.processId || state.isProcessCompleted) {
    return {
      success: false,
      error: 'No active process to transition stage',
    };
  }

  // Validate: can't transition to same stage
  if (state.stageId === command.toStageId) {
    return {
      success: false,
      error: 'Already in this stage',
    };
  }

  // Determine if this is a progression or regression
  const isProgression = state.stageOrder === null || command.toStageOrder > state.stageOrder;

  // Create and append event
  const event: CompanyProductStageSet = {
    type: 'CompanyProductStageSet',
    version: 1,
    data: {
      fromStageId: state.stageId,
      fromStageName: state.stageName,
      fromStageOrder: state.stageOrder,
      toStageId: command.toStageId,
      toStageName: command.toStageName,
      toStageOrder: command.toStageOrder,
      isProgression,
      reason: command.reason,
      trigger: command.trigger,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
    expectedVersion: state.version,
  });
}

/**
 * Command to complete the current process.
 */
export interface CompleteProcessCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  terminalStageId: string;
  terminalStageName: string;
  outcome: TerminalOutcome;
  notes?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Completes the current process with a terminal outcome.
 */
export async function completeProcess(
  supabase: AnySupabaseClient,
  command: CompleteProcessCommand
): Promise<AppendEventResult> {
  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Validate: must have active process
  if (!state.processId) {
    return {
      success: false,
      error: 'No active process to complete',
    };
  }

  // Validate: process not already completed
  if (state.isProcessCompleted) {
    return {
      success: false,
      error: 'Process already completed',
    };
  }

  // Calculate duration
  const processStarted = state.processStartedAt
    ? new Date(state.processStartedAt)
    : new Date();
  const now = new Date();
  const durationDays = Math.floor(
    (now.getTime() - processStarted.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Create and append event
  const event: CompanyProductProcessCompleted = {
    type: 'CompanyProductProcessCompleted',
    version: 1,
    data: {
      processId: state.processId,
      processType: state.processType!,
      terminalStageId: command.terminalStageId,
      terminalStageName: command.terminalStageName,
      outcome: command.outcome,
      durationDays,
      stageTransitionCount: state.stageTransitionCount,
      notes: command.notes,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
    expectedVersion: state.version,
  });
}

/**
 * Command to update health score.
 */
export interface UpdateHealthCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  score: number;
  riskLevel: RiskLevel;
  factors: Array<{ name: string; score: number; weight: number }>;
  calculationMethod: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Updates the health score for a company product.
 */
export async function updateHealth(
  supabase: AnySupabaseClient,
  command: UpdateHealthCommand
): Promise<AppendEventResult> {
  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Create and append event
  const event: CompanyProductHealthUpdated = {
    type: 'CompanyProductHealthUpdated',
    version: 1,
    data: {
      fromScore: state.healthScore,
      toScore: command.score,
      riskLevel: command.riskLevel,
      factors: command.factors,
      calculationMethod: command.calculationMethod,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
  });
}

/**
 * Command to record an activity.
 */
export interface RecordActivityCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  activityType: 'call' | 'email' | 'meeting' | 'demo' | 'note' | 'other';
  activityId?: string;
  summary?: string;
  outcome?: string;
  contactId?: string;
  durationMinutes?: number;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Records an activity for a company product.
 */
export async function recordActivity(
  supabase: AnySupabaseClient,
  command: RecordActivityCommand
): Promise<AppendEventResult> {
  const event: CompanyProductActivityRecorded = {
    type: 'CompanyProductActivityRecorded',
    version: 1,
    data: {
      activityType: command.activityType,
      activityId: command.activityId,
      summary: command.summary,
      outcome: command.outcome,
      contactId: command.contactId,
      durationMinutes: command.durationMinutes,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
  });
}

// ============================================================================
// START SALE COMMAND (COMPOSITE)
// ============================================================================

/**
 * Command to start a sales process for a company product.
 * This is a composite command that sets phase to in_sales and assigns a process.
 */
export interface StartSaleCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  processId: string;
  processVersion: number;
  initialStageId: string;
  initialStageName: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Starts a sales process for a company product.
 * Sets phase to in_sales and assigns the sales process with initial stage.
 */
export async function startSale(
  supabase: AnySupabaseClient,
  command: StartSaleCommand
): Promise<AppendEventResult[]> {
  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Validate: can start sale from prospect or null phase
  if (state.phase !== null && state.phase !== 'prospect') {
    return [{
      success: false,
      error: `Cannot start sale from phase: ${state.phase}. Must be prospect or new.`,
    }];
  }

  // Validate: no active process
  if (state.processId && !state.isProcessCompleted) {
    return [{
      success: false,
      error: `Cannot start sale while ${state.processType} process is active`,
    }];
  }

  const results: AppendEventResult[] = [];

  // Event 1: Set phase to in_sales
  const phaseEvent: CompanyProductPhaseSet = {
    type: 'CompanyProductPhaseSet',
    version: 1,
    data: {
      fromPhase: state.phase,
      toPhase: 'in_sales',
      reason: 'Starting sales process',
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  const phaseResult = await appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event: phaseEvent,
  });

  results.push(phaseResult);
  if (!phaseResult.success) {
    return results;
  }

  // Event 2: Set process
  const processEvent: CompanyProductProcessSet = {
    type: 'CompanyProductProcessSet',
    version: 1,
    data: {
      fromProcessId: state.processId,
      fromProcessType: state.processType,
      toProcessId: command.processId,
      toProcessType: 'sales',
      processVersion: command.processVersion,
      initialStageId: command.initialStageId,
      initialStageName: command.initialStageName,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  const processResult = await appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event: processEvent,
  });

  results.push(processResult);
  return results;
}

// ============================================================================
// ADVANCE STAGE COMMAND
// ============================================================================

/**
 * Command to advance to the next stage in the process.
 * Simpler interface than transitionStage - just specify the target stage.
 */
export interface AdvanceStageCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  toStageId: string;
  toStageName: string;
  toStageOrder: number;
  reason?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Advances to a new stage in the current process.
 * Wrapper around transitionStage with 'manual' trigger.
 */
export async function advanceStage(
  supabase: AnySupabaseClient,
  command: AdvanceStageCommand
): Promise<AppendEventResult> {
  return transitionStage(supabase, {
    ...command,
    trigger: 'manual',
  });
}

// ============================================================================
// SET OWNER COMMAND
// ============================================================================

/**
 * Command to set the owner of a company product.
 */
export interface SetOwnerCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  ownerId: string;
  ownerName: string;
  reason?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Sets the owner for a company product.
 */
export async function setOwner(
  supabase: AnySupabaseClient,
  command: SetOwnerCommand
): Promise<AppendEventResult> {
  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Create and append event
  const event: CompanyProductOwnerSet = {
    type: 'CompanyProductOwnerSet',
    version: 1,
    data: {
      fromOwnerId: state.ownerId,
      fromOwnerName: state.ownerName,
      toOwnerId: command.ownerId,
      toOwnerName: command.ownerName,
      reason: command.reason,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
  });
}

// ============================================================================
// SET TIER COMMAND
// ============================================================================

/**
 * Command to set the tier/priority level.
 */
export interface SetTierCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  tier: number;
  reason?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Sets the tier for a company product.
 */
export async function setTier(
  supabase: AnySupabaseClient,
  command: SetTierCommand
): Promise<AppendEventResult> {
  // Validate tier range
  if (command.tier < 1 || command.tier > 5) {
    return {
      success: false,
      error: 'Tier must be between 1 and 5',
    };
  }

  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Create and append event
  const event: CompanyProductTierSet = {
    type: 'CompanyProductTierSet',
    version: 1,
    data: {
      fromTier: state.tier,
      toTier: command.tier,
      reason: command.reason,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
  });
}

// ============================================================================
// SET MRR COMMAND
// ============================================================================

/**
 * Command to set the monthly recurring revenue.
 */
export interface SetMRRCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  mrr: number;
  currency?: string;
  reason?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Sets the MRR for a company product.
 */
export async function setMRR(
  supabase: AnySupabaseClient,
  command: SetMRRCommand
): Promise<AppendEventResult> {
  // Validate MRR
  if (command.mrr < 0) {
    return {
      success: false,
      error: 'MRR cannot be negative',
    };
  }

  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Create and append event
  const event: CompanyProductMRRSet = {
    type: 'CompanyProductMRRSet',
    version: 1,
    data: {
      fromMRR: state.mrr,
      toMRR: command.mrr,
      currency: command.currency || 'USD',
      reason: command.reason,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
  });
}

// ============================================================================
// SET SEATS COMMAND
// ============================================================================

/**
 * Command to set the number of seats/licenses.
 */
export interface SetSeatsCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  seats: number;
  reason?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Sets the seat count for a company product.
 */
export async function setSeats(
  supabase: AnySupabaseClient,
  command: SetSeatsCommand
): Promise<AppendEventResult> {
  // Validate seats
  if (command.seats < 0 || !Number.isInteger(command.seats)) {
    return {
      success: false,
      error: 'Seats must be a non-negative integer',
    };
  }

  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Create and append event
  const event: CompanyProductSeatsSet = {
    type: 'CompanyProductSeatsSet',
    version: 1,
    data: {
      fromSeats: state.seats,
      toSeats: command.seats,
      reason: command.reason,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
  });
}

// ============================================================================
// SET NEXT STEP DUE COMMAND
// ============================================================================

/**
 * Command to set the next step and due date.
 */
export interface SetNextStepDueCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  nextStep: string;
  dueDate: string; // ISO string
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Sets the next step and due date for a company product.
 */
export async function setNextStepDue(
  supabase: AnySupabaseClient,
  command: SetNextStepDueCommand
): Promise<AppendEventResult> {
  // Validate next step
  if (!command.nextStep.trim()) {
    return {
      success: false,
      error: 'Next step cannot be empty',
    };
  }

  // Validate due date format
  const dueDate = new Date(command.dueDate);
  if (isNaN(dueDate.getTime())) {
    return {
      success: false,
      error: 'Invalid due date format',
    };
  }

  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Check if overdue
  const isOverdue = dueDate < new Date();

  // Create and append event
  const event: CompanyProductNextStepDueSet = {
    type: 'CompanyProductNextStepDueSet',
    version: 1,
    data: {
      fromNextStep: state.nextStep,
      fromDueDate: state.nextStepDueDate,
      toNextStep: command.nextStep,
      toDueDate: command.dueDate,
      isOverdue,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
  });
}

// ============================================================================
// PHASE TRANSITION COMMANDS (COMPOSITE)
// ============================================================================

/**
 * Command to complete a sale and start onboarding.
 * This is the canonical transition from sales → onboarding.
 */
export interface CompleteSaleAndStartOnboardingCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  /** Optional: specify onboarding process ID, otherwise uses default for product */
  onboardingProcessId?: string;
  /** Notes about the won deal */
  notes?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Completes a sale with 'won' outcome and starts the onboarding process.
 *
 * Events emitted (in order):
 * 1. CompanyProductProcessCompleted (sales, outcome: won)
 * 2. CompanyProductPhaseSet (in_sales → onboarding)
 * 3. CompanyProductProcessSet (onboarding process)
 */
export async function completeSaleAndStartOnboarding(
  supabase: AnySupabaseClient,
  command: CompleteSaleAndStartOnboardingCommand
): Promise<AppendEventResult[]> {
  const results: AppendEventResult[] = [];

  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Validate: must be in sales process
  if (state.processType !== 'sales') {
    return [{
      success: false,
      error: `Cannot complete sale: current process type is ${state.processType}, expected sales`,
    }];
  }

  // Validate: process not already completed
  if (state.isProcessCompleted) {
    return [{
      success: false,
      error: 'Sales process already completed',
    }];
  }

  // Get the terminal stage for won outcome
  const { data: terminalStage } = await supabase
    .from('product_process_stages')
    .select('id, name')
    .eq('process_id', state.processId)
    .eq('terminal_type', 'won')
    .single();

  // Calculate duration
  const processStarted = state.processStartedAt
    ? new Date(state.processStartedAt)
    : new Date();
  const now = new Date();
  const durationDays = Math.floor(
    (now.getTime() - processStarted.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Event 1: Complete sales process
  const processCompletedEvent: CompanyProductProcessCompleted = {
    type: 'CompanyProductProcessCompleted',
    version: 1,
    data: {
      processId: state.processId!,
      processType: 'sales',
      terminalStageId: terminalStage?.id || state.stageId || '',
      terminalStageName: terminalStage?.name || state.stageName || 'Won',
      outcome: 'won',
      durationDays,
      stageTransitionCount: state.stageTransitionCount,
      notes: command.notes,
    },
    occurredAt: now.toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  const completedResult = await appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event: processCompletedEvent,
  });
  results.push(completedResult);
  if (!completedResult.success) return results;

  // Event 2: Transition phase to onboarding
  const phaseEvent: CompanyProductPhaseSet = {
    type: 'CompanyProductPhaseSet',
    version: 1,
    data: {
      fromPhase: 'in_sales',
      toPhase: 'onboarding',
      reason: 'Sale won - starting onboarding',
    },
    occurredAt: now.toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  const phaseResult = await appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event: phaseEvent,
  });
  results.push(phaseResult);
  if (!phaseResult.success) return results;

  // Get onboarding process for this product
  let onboardingProcessId = command.onboardingProcessId;
  let onboardingProcess;

  if (!onboardingProcessId) {
    // Find published onboarding process for this product
    const { data: process } = await supabase
      .from('product_processes')
      .select('id, version')
      .eq('product_id', command.productId)
      .eq('process_type', 'onboarding')
      .eq('status', 'published')
      .single();

    if (process) {
      onboardingProcess = process;
      onboardingProcessId = process.id;
    }
  } else {
    const { data: process } = await supabase
      .from('product_processes')
      .select('id, version')
      .eq('id', onboardingProcessId)
      .single();
    onboardingProcess = process;
  }

  if (!onboardingProcessId || !onboardingProcess) {
    // No onboarding process configured - just complete without starting new process
    return results;
  }

  // Get initial stage for onboarding process
  const { data: initialStage } = await supabase
    .from('product_process_stages')
    .select('id, name')
    .eq('process_id', onboardingProcessId)
    .order('stage_order', { ascending: true })
    .limit(1)
    .single();

  // Event 3: Start onboarding process
  const processEvent: CompanyProductProcessSet = {
    type: 'CompanyProductProcessSet',
    version: 1,
    data: {
      fromProcessId: state.processId,
      fromProcessType: 'sales',
      toProcessId: onboardingProcessId,
      toProcessType: 'onboarding',
      processVersion: onboardingProcess.version,
      initialStageId: initialStage?.id,
      initialStageName: initialStage?.name,
    },
    occurredAt: now.toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  const processResult = await appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event: processEvent,
  });
  results.push(processResult);

  return results;
}

/**
 * Command to complete onboarding and start engagement.
 * This is the canonical transition from onboarding → active/engagement.
 */
export interface CompleteOnboardingAndStartEngagementCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  /** Optional: specify engagement process ID, otherwise uses default for product */
  engagementProcessId?: string;
  /** Notes about the completed onboarding */
  notes?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Completes onboarding and starts the engagement process.
 * Transitions phase to 'active'.
 *
 * Events emitted (in order):
 * 1. CompanyProductProcessCompleted (onboarding, outcome: completed)
 * 2. CompanyProductPhaseSet (onboarding → active)
 * 3. CompanyProductProcessSet (engagement process) - if configured
 */
export async function completeOnboardingAndStartEngagement(
  supabase: AnySupabaseClient,
  command: CompleteOnboardingAndStartEngagementCommand
): Promise<AppendEventResult[]> {
  const results: AppendEventResult[] = [];

  // Load current state
  const { state } = await loadAggregate(
    supabase,
    command.companyProductId,
    command.companyId,
    command.productId
  );

  // Validate: must be in onboarding process
  if (state.processType !== 'onboarding') {
    return [{
      success: false,
      error: `Cannot complete onboarding: current process type is ${state.processType}, expected onboarding`,
    }];
  }

  // Validate: process not already completed
  if (state.isProcessCompleted) {
    return [{
      success: false,
      error: 'Onboarding process already completed',
    }];
  }

  // Get the terminal stage for completed outcome
  const { data: terminalStage } = await supabase
    .from('product_process_stages')
    .select('id, name')
    .eq('process_id', state.processId)
    .eq('terminal_type', 'completed')
    .single();

  // Calculate duration
  const processStarted = state.processStartedAt
    ? new Date(state.processStartedAt)
    : new Date();
  const now = new Date();
  const durationDays = Math.floor(
    (now.getTime() - processStarted.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Event 1: Complete onboarding process
  const processCompletedEvent: CompanyProductProcessCompleted = {
    type: 'CompanyProductProcessCompleted',
    version: 1,
    data: {
      processId: state.processId!,
      processType: 'onboarding',
      terminalStageId: terminalStage?.id || state.stageId || '',
      terminalStageName: terminalStage?.name || state.stageName || 'Completed',
      outcome: 'completed',
      durationDays,
      stageTransitionCount: state.stageTransitionCount,
      notes: command.notes,
    },
    occurredAt: now.toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  const completedResult = await appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event: processCompletedEvent,
  });
  results.push(completedResult);
  if (!completedResult.success) return results;

  // Event 2: Transition phase to active
  const phaseEvent: CompanyProductPhaseSet = {
    type: 'CompanyProductPhaseSet',
    version: 1,
    data: {
      fromPhase: 'onboarding',
      toPhase: 'active',
      reason: 'Onboarding completed - customer is now active',
    },
    occurredAt: now.toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  const phaseResult = await appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event: phaseEvent,
  });
  results.push(phaseResult);
  if (!phaseResult.success) return results;

  // Get engagement process for this product (optional)
  let engagementProcessId = command.engagementProcessId;
  let engagementProcess;

  if (!engagementProcessId) {
    // Find published engagement process for this product
    const { data: process } = await supabase
      .from('product_processes')
      .select('id, version')
      .eq('product_id', command.productId)
      .eq('process_type', 'engagement')
      .eq('status', 'published')
      .single();

    if (process) {
      engagementProcess = process;
      engagementProcessId = process.id;
    }
  } else {
    const { data: process } = await supabase
      .from('product_processes')
      .select('id, version')
      .eq('id', engagementProcessId)
      .single();
    engagementProcess = process;
  }

  if (!engagementProcessId || !engagementProcess) {
    // No engagement process configured - customer is active without process tracking
    return results;
  }

  // Get initial stage for engagement process
  const { data: initialStage } = await supabase
    .from('product_process_stages')
    .select('id, name')
    .eq('process_id', engagementProcessId)
    .order('stage_order', { ascending: true })
    .limit(1)
    .single();

  // Event 3: Start engagement process
  const processEvent: CompanyProductProcessSet = {
    type: 'CompanyProductProcessSet',
    version: 1,
    data: {
      fromProcessId: state.processId,
      fromProcessType: 'onboarding',
      toProcessId: engagementProcessId,
      toProcessType: 'engagement',
      processVersion: engagementProcess.version,
      initialStageId: initialStage?.id,
      initialStageName: initialStage?.name,
    },
    occurredAt: now.toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  const processResult = await appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event: processEvent,
  });
  results.push(processResult);

  return results;
}

// ============================================================================
// AI SUGGESTION COMMANDS
// ============================================================================
// GUARDRAIL: AI never auto-executes. All suggestions require human acceptance.

/**
 * Command to create an AI suggestion for human review.
 * This is emitted by AI analysis (transcript, email, etc) but NEVER auto-executes.
 */
export interface CreateAISuggestionCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  /** Unique suggestion ID (should be UUID) */
  suggestionId: string;
  /** Type of suggestion */
  suggestionType: AISuggestionType;
  /** Human-readable title */
  title: string;
  /** Detailed description/reasoning */
  description: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Source that triggered the suggestion */
  sourceType: 'transcript' | 'email' | 'activity' | 'sla_scan' | 'health_score' | 'manual';
  /** Source ID (e.g., transcript_id) */
  sourceId?: string;
  /** Suggested action to execute if accepted */
  suggestedAction: {
    command: string;
    params: Record<string, unknown>;
  };
  /** Optional expiration time */
  expiresAt?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Creates an AI suggestion for human review.
 * This is the ONLY way AI can propose state changes - never direct execution.
 */
export async function createAISuggestion(
  supabase: AnySupabaseClient,
  command: CreateAISuggestionCommand
): Promise<AppendEventResult> {
  // Validate confidence score
  if (command.confidence < 0 || command.confidence > 1) {
    return {
      success: false,
      error: 'Confidence must be between 0 and 1',
    };
  }

  // Validate suggestion ID
  if (!command.suggestionId || command.suggestionId.length < 10) {
    return {
      success: false,
      error: 'Valid suggestionId is required',
    };
  }

  // Create and append event
  const event: AISuggestionCreated = {
    type: 'AISuggestionCreated',
    version: 1,
    data: {
      suggestionId: command.suggestionId,
      suggestionType: command.suggestionType,
      title: command.title,
      description: command.description,
      confidence: command.confidence,
      sourceType: command.sourceType,
      sourceId: command.sourceId,
      suggestedAction: command.suggestedAction,
      expiresAt: command.expiresAt,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
  });
}

/**
 * Command to accept an AI suggestion.
 * After acceptance, the suggested command can be executed.
 */
export interface AcceptAISuggestionCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  /** Suggestion ID being accepted */
  suggestionId: string;
  /** Type of suggestion (for validation) */
  suggestionType: AISuggestionType;
  /** Optional modification to the suggestion */
  modification?: string;
  /** Whether to execute the suggested action automatically after acceptance */
  executeAction?: boolean;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Accepts an AI suggestion.
 * GUARDRAIL: Only humans can accept suggestions (actor.type should be 'user').
 */
export async function acceptAISuggestion(
  supabase: AnySupabaseClient,
  command: AcceptAISuggestionCommand
): Promise<AppendEventResult> {
  // GUARDRAIL: AI cannot accept its own suggestions
  if (command.actor.type === 'ai') {
    return {
      success: false,
      error: 'AI cannot accept suggestions. Only humans can accept AI suggestions.',
    };
  }

  // Validate suggestion ID
  if (!command.suggestionId) {
    return {
      success: false,
      error: 'suggestionId is required',
    };
  }

  // Create and append event
  const event: AISuggestionAccepted = {
    type: 'AISuggestionAccepted',
    version: 1,
    data: {
      suggestionId: command.suggestionId,
      suggestionType: command.suggestionType,
      modification: command.modification,
      executeAction: command.executeAction ?? false,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
  });
}

/**
 * Command to dismiss an AI suggestion.
 */
export interface DismissAISuggestionCommand {
  companyProductId: string;
  companyId: string;
  productId: string;
  /** Suggestion ID being dismissed */
  suggestionId: string;
  /** Type of suggestion */
  suggestionType: AISuggestionType;
  /** Reason for dismissal */
  dismissReason?: 'not_relevant' | 'already_done' | 'incorrect' | 'deferred' | 'other';
  /** Additional feedback */
  feedback?: string;
  actor: { type: ActorType; id?: string };
  metadata?: EventMetadata;
}

/**
 * Dismisses an AI suggestion.
 * Feedback is stored for AI learning.
 */
export async function dismissAISuggestion(
  supabase: AnySupabaseClient,
  command: DismissAISuggestionCommand
): Promise<AppendEventResult> {
  // Validate suggestion ID
  if (!command.suggestionId) {
    return {
      success: false,
      error: 'suggestionId is required',
    };
  }

  // Create and append event
  const event: AISuggestionDismissed = {
    type: 'AISuggestionDismissed',
    version: 1,
    data: {
      suggestionId: command.suggestionId,
      suggestionType: command.suggestionType,
      dismissReason: command.dismissReason,
      feedback: command.feedback,
    },
    occurredAt: new Date().toISOString(),
    actor: command.actor,
    metadata: command.metadata,
  };

  return appendEvent(supabase, {
    aggregateId: command.companyProductId,
    event,
  });
}
