/**
 * CompanyProduct Lifecycle Event Catalog
 *
 * This module defines the complete catalog of events for the CompanyProduct aggregate.
 * All lifecycle state changes are represented as immutable events.
 *
 * ARCHITECTURE:
 * - Events are the ONLY source of truth for lifecycle state
 * - State is computed by replaying events in order
 * - Events are immutable once written
 * - All validation happens BEFORE emitting events
 *
 * EVENT VERSIONING:
 * - Each event type has an explicit version field
 * - New versions can add optional fields
 * - Old events are still valid and can be replayed
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

/**
 * Lifecycle phases represent the high-level journey of a CompanyProduct.
 * A company can be in sales, onboarding, or active engagement.
 */
export type LifecyclePhase = 'prospect' | 'in_sales' | 'onboarding' | 'active' | 'churned';

/**
 * Process types correspond to the phases and define the workflow.
 */
export type ProcessType = 'sales' | 'onboarding' | 'engagement';

/**
 * Terminal outcomes for a process.
 */
export type TerminalOutcome = 'won' | 'lost' | 'completed' | 'churned' | 'cancelled';

/**
 * Actor types for event attribution.
 */
export type ActorType = 'user' | 'system' | 'ai';

// ============================================================================
// BASE EVENT TYPES
// ============================================================================

/**
 * Base metadata for all events.
 */
export interface EventMetadata {
  /** Correlation ID for tracing related events */
  correlationId?: string;
  /** Causation ID - the event that caused this one */
  causationId?: string;
  /** Request ID from the original API call */
  requestId?: string;
  /** Source system or component */
  source?: string;
  /** Additional context */
  [key: string]: unknown;
}

/**
 * Base structure for all lifecycle events.
 */
export interface BaseEvent<TType extends string, TData, TVersion extends number = 1> {
  /** Discriminator for the event type */
  readonly type: TType;
  /** Event version for schema evolution */
  readonly version: TVersion;
  /** Event-specific payload */
  readonly data: TData;
  /** When the event occurred (ISO string) */
  readonly occurredAt: string;
  /** Who/what caused the event */
  readonly actor: {
    type: ActorType;
    id?: string;
  };
  /** Optional metadata */
  readonly metadata?: EventMetadata;
}

// ============================================================================
// PHASE EVENTS
// ============================================================================

/**
 * CompanyProductPhaseSet - Sets the high-level lifecycle phase.
 *
 * Phases are:
 * - prospect: Initial interest, no active sales process
 * - in_sales: Active sales process underway
 * - onboarding: Won, now implementing
 * - active: Fully onboarded and engaged
 * - churned: Lost or cancelled
 */
export interface CompanyProductPhaseSetData {
  /** Previous phase (null if first event) */
  fromPhase: LifecyclePhase | null;
  /** New phase */
  toPhase: LifecyclePhase;
  /** Reason for the phase change */
  reason?: string;
  /** If churned, the reason */
  churnReason?: string;
}

export type CompanyProductPhaseSetV1 = BaseEvent<
  'CompanyProductPhaseSet',
  CompanyProductPhaseSetData,
  1
>;

// Current version alias
export type CompanyProductPhaseSet = CompanyProductPhaseSetV1;

// ============================================================================
// PROCESS EVENTS
// ============================================================================

/**
 * CompanyProductProcessSet - Associates a process with the company product.
 *
 * A process defines the workflow (stages, SLAs, exit criteria) for a phase.
 */
export interface CompanyProductProcessSetData {
  /** Previous process ID (null if first) */
  fromProcessId: string | null;
  /** Previous process type */
  fromProcessType: ProcessType | null;
  /** New process ID */
  toProcessId: string;
  /** New process type */
  toProcessType: ProcessType;
  /** Process version being used */
  processVersion: number;
  /** Initial stage ID (if setting process also sets stage) */
  initialStageId?: string;
  /** Initial stage name */
  initialStageName?: string;
}

export type CompanyProductProcessSetV1 = BaseEvent<
  'CompanyProductProcessSet',
  CompanyProductProcessSetData,
  1
>;

// Current version alias
export type CompanyProductProcessSet = CompanyProductProcessSetV1;

// ============================================================================
// STAGE EVENTS
// ============================================================================

/**
 * CompanyProductStageSet - Moves to a specific stage within the current process.
 */
export interface CompanyProductStageSetData {
  /** Previous stage ID (null if first stage) */
  fromStageId: string | null;
  /** Previous stage name */
  fromStageName: string | null;
  /** Previous stage order */
  fromStageOrder: number | null;
  /** New stage ID */
  toStageId: string;
  /** New stage name */
  toStageName: string;
  /** New stage order */
  toStageOrder: number;
  /** Whether this is a forward progression */
  isProgression: boolean;
  /** Reason for stage change */
  reason?: string;
  /** Trigger type */
  trigger?: 'manual' | 'automation' | 'ai' | 'exit_criteria_met';
}

export type CompanyProductStageSetV1 = BaseEvent<
  'CompanyProductStageSet',
  CompanyProductStageSetData,
  1
>;

// Current version alias
export type CompanyProductStageSet = CompanyProductStageSetV1;

// ============================================================================
// PROCESS COMPLETION EVENTS
// ============================================================================

/**
 * CompanyProductProcessCompleted - Marks a process as completed.
 */
export interface CompanyProductProcessCompletedData {
  /** Process ID that was completed */
  processId: string;
  /** Process type */
  processType: ProcessType;
  /** Terminal stage ID */
  terminalStageId: string;
  /** Terminal stage name */
  terminalStageName: string;
  /** Outcome type */
  outcome: TerminalOutcome;
  /** Total duration in days */
  durationDays: number;
  /** Number of stage transitions */
  stageTransitionCount: number;
  /** Completion notes */
  notes?: string;
}

export type CompanyProductProcessCompletedV1 = BaseEvent<
  'CompanyProductProcessCompleted',
  CompanyProductProcessCompletedData,
  1
>;

// Current version alias
export type CompanyProductProcessCompleted = CompanyProductProcessCompletedV1;

// ============================================================================
// SLA EVENTS
// ============================================================================

/**
 * CompanyProductSLAWarning - SLA warning threshold reached.
 */
export interface CompanyProductSLAWarningData {
  /** Stage ID */
  stageId: string;
  /** Stage name */
  stageName: string;
  /** SLA days configured */
  slaDays: number;
  /** Warning threshold days */
  warningDays: number;
  /** Actual days in stage */
  actualDays: number;
}

export type CompanyProductSLAWarningV1 = BaseEvent<
  'CompanyProductSLAWarning',
  CompanyProductSLAWarningData,
  1
>;

export type CompanyProductSLAWarning = CompanyProductSLAWarningV1;

/**
 * CompanyProductSLABreached - SLA has been breached.
 */
export interface CompanyProductSLABreachedData {
  /** Stage ID */
  stageId: string;
  /** Stage name */
  stageName: string;
  /** SLA days configured */
  slaDays: number;
  /** Actual days in stage */
  actualDays: number;
  /** Days over SLA */
  daysOver: number;
}

export type CompanyProductSLABreachedV1 = BaseEvent<
  'CompanyProductSLABreached',
  CompanyProductSLABreachedData,
  1
>;

export type CompanyProductSLABreached = CompanyProductSLABreachedV1;

// ============================================================================
// HEALTH EVENTS
// ============================================================================

/**
 * CompanyProductHealthUpdated - Health score recalculated.
 */
export interface CompanyProductHealthUpdatedData {
  /** Previous health score */
  fromScore: number | null;
  /** New health score */
  toScore: number;
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Factors contributing to the score */
  factors: Array<{
    name: string;
    score: number;
    weight: number;
  }>;
  /** Calculation method/version */
  calculationMethod: string;
}

export type CompanyProductHealthUpdatedV1 = BaseEvent<
  'CompanyProductHealthUpdated',
  CompanyProductHealthUpdatedData,
  1
>;

export type CompanyProductHealthUpdated = CompanyProductHealthUpdatedV1;

/**
 * Health reason - explains why health score changed.
 */
export interface HealthReason {
  /** Reason code for categorization */
  code: string;
  /** Human-readable description */
  description: string;
  /** Impact on health score (negative = reduces health) */
  impact: number;
  /** Source of the reason (e.g., support_case, sla, communication) */
  source: 'support_case' | 'sla' | 'communication' | 'activity' | 'stage' | 'other';
  /** Optional reference ID (e.g., case_id, comm_id) */
  referenceId?: string;
}

/**
 * CompanyProductHealthComputed - Engagement health score computed from signals.
 *
 * This event is emitted by the health evaluator when it recomputes health
 * based on support cases, SLA status, communications, and other signals.
 * Contains detailed reasons for auditability.
 */
export interface CompanyProductHealthComputedData {
  /** Previous health score (null if first computation) */
  fromScore: number | null;
  /** Computed health score (0-100) */
  toScore: number;
  /** Risk level derived from score and signals */
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  /** Previous risk level */
  fromRiskLevel: 'none' | 'low' | 'medium' | 'high' | null;
  /** Detailed reasons explaining the score */
  reasons: HealthReason[];
  /** Hash of input signals for idempotency */
  inputHash: string;
  /** Version of the scoring algorithm */
  scoringVersion: string;
  /** Timestamp of computation */
  computedAt: string;
}

export type CompanyProductHealthComputedV1 = BaseEvent<
  'CompanyProductHealthComputed',
  CompanyProductHealthComputedData,
  1
>;

export type CompanyProductHealthComputed = CompanyProductHealthComputedV1;

/**
 * CompanyProductRiskLevelSet - Explicit risk level change with reasons.
 *
 * Emitted when risk level changes due to support cases, SLA breaches, etc.
 * Separate from HealthComputed to allow targeted subscriptions.
 */
export interface CompanyProductRiskLevelSetData {
  /** Previous risk level */
  fromRiskLevel: 'none' | 'low' | 'medium' | 'high' | null;
  /** New risk level */
  toRiskLevel: 'none' | 'low' | 'medium' | 'high';
  /** Primary reason for the risk level */
  primaryReason: string;
  /** Detailed reasons */
  reasons: HealthReason[];
  /** Whether this was triggered by support case signals */
  triggeredBySupportCases: boolean;
  /** Whether this was triggered by SLA breach */
  triggeredBySlaBreach: boolean;
}

export type CompanyProductRiskLevelSetV1 = BaseEvent<
  'CompanyProductRiskLevelSet',
  CompanyProductRiskLevelSetData,
  1
>;

export type CompanyProductRiskLevelSet = CompanyProductRiskLevelSetV1;

// ============================================================================
// ACTIVITY EVENTS
// ============================================================================

/**
 * CompanyProductActivityRecorded - An activity was recorded.
 */
export interface CompanyProductActivityRecordedData {
  /** Activity type */
  activityType: 'call' | 'email' | 'meeting' | 'demo' | 'note' | 'other';
  /** Activity ID (if stored separately) */
  activityId?: string;
  /** Summary of the activity */
  summary?: string;
  /** Outcome of the activity */
  outcome?: string;
  /** Associated contact ID */
  contactId?: string;
  /** Duration in minutes (for calls/meetings) */
  durationMinutes?: number;
}

export type CompanyProductActivityRecordedV1 = BaseEvent<
  'CompanyProductActivityRecorded',
  CompanyProductActivityRecordedData,
  1
>;

export type CompanyProductActivityRecorded = CompanyProductActivityRecordedV1;

// ============================================================================
// NOTE EVENTS
// ============================================================================

/**
 * CompanyProductNoteAdded - A note was added.
 */
export interface CompanyProductNoteAddedData {
  /** Note ID */
  noteId: string;
  /** Note content */
  content: string;
  /** Note type */
  noteType: 'general' | 'sales' | 'support' | 'internal';
  /** Visibility */
  visibility: 'private' | 'team' | 'company';
}

export type CompanyProductNoteAddedV1 = BaseEvent<
  'CompanyProductNoteAdded',
  CompanyProductNoteAddedData,
  1
>;

export type CompanyProductNoteAdded = CompanyProductNoteAddedV1;

// ============================================================================
// OWNER EVENTS
// ============================================================================

/**
 * CompanyProductOwnerSet - Assigns or changes the owner.
 */
export interface CompanyProductOwnerSetData {
  /** Previous owner ID (null if first assignment) */
  fromOwnerId: string | null;
  /** Previous owner name */
  fromOwnerName: string | null;
  /** New owner ID */
  toOwnerId: string;
  /** New owner name */
  toOwnerName: string;
  /** Reason for the change */
  reason?: string;
}

export type CompanyProductOwnerSetV1 = BaseEvent<
  'CompanyProductOwnerSet',
  CompanyProductOwnerSetData,
  1
>;

export type CompanyProductOwnerSet = CompanyProductOwnerSetV1;

// ============================================================================
// TIER EVENTS
// ============================================================================

/**
 * CompanyProductTierSet - Sets the tier/priority level.
 */
export interface CompanyProductTierSetData {
  /** Previous tier (null if first) */
  fromTier: number | null;
  /** New tier */
  toTier: number;
  /** Reason for the change */
  reason?: string;
}

export type CompanyProductTierSetV1 = BaseEvent<
  'CompanyProductTierSet',
  CompanyProductTierSetData,
  1
>;

export type CompanyProductTierSet = CompanyProductTierSetV1;

// ============================================================================
// MRR EVENTS
// ============================================================================

/**
 * CompanyProductMRRSet - Sets the monthly recurring revenue.
 */
export interface CompanyProductMRRSetData {
  /** Previous MRR (null if first) */
  fromMRR: number | null;
  /** New MRR */
  toMRR: number;
  /** Currency code (default USD) */
  currency: string;
  /** Reason for the change */
  reason?: string;
}

export type CompanyProductMRRSetV1 = BaseEvent<
  'CompanyProductMRRSet',
  CompanyProductMRRSetData,
  1
>;

export type CompanyProductMRRSet = CompanyProductMRRSetV1;

// ============================================================================
// SEATS EVENTS
// ============================================================================

/**
 * CompanyProductSeatsSet - Sets the number of seats/licenses.
 */
export interface CompanyProductSeatsSetData {
  /** Previous seat count (null if first) */
  fromSeats: number | null;
  /** New seat count */
  toSeats: number;
  /** Reason for the change */
  reason?: string;
}

export type CompanyProductSeatsSetV1 = BaseEvent<
  'CompanyProductSeatsSet',
  CompanyProductSeatsSetData,
  1
>;

export type CompanyProductSeatsSet = CompanyProductSeatsSetV1;

// ============================================================================
// NEXT STEP EVENTS
// ============================================================================

/**
 * CompanyProductNextStepDueSet - Sets the next step and due date.
 */
export interface CompanyProductNextStepDueSetData {
  /** Previous next step (null if first) */
  fromNextStep: string | null;
  /** Previous due date */
  fromDueDate: string | null;
  /** New next step description */
  toNextStep: string;
  /** New due date (ISO string) */
  toDueDate: string;
  /** Whether this is overdue */
  isOverdue?: boolean;
}

export type CompanyProductNextStepDueSetV1 = BaseEvent<
  'CompanyProductNextStepDueSet',
  CompanyProductNextStepDueSetData,
  1
>;

export type CompanyProductNextStepDueSet = CompanyProductNextStepDueSetV1;

// ============================================================================
// AGGREGATE EVENT UNION
// ============================================================================

/**
 * Discriminated union of all CompanyProduct events.
 * Use this type for event handlers and replay logic.
 */
export type CompanyProductEvent =
  | CompanyProductPhaseSet
  | CompanyProductProcessSet
  | CompanyProductStageSet
  | CompanyProductProcessCompleted
  | CompanyProductSLAWarning
  | CompanyProductSLABreached
  | CompanyProductHealthUpdated
  | CompanyProductHealthComputed
  | CompanyProductRiskLevelSet
  | CompanyProductActivityRecorded
  | CompanyProductNoteAdded
  | CompanyProductOwnerSet
  | CompanyProductTierSet
  | CompanyProductMRRSet
  | CompanyProductSeatsSet
  | CompanyProductNextStepDueSet
  | AISuggestionCreated
  | AISuggestionAccepted
  | AISuggestionDismissed;

/**
 * Event type discriminator values.
 */
export type CompanyProductEventType = CompanyProductEvent['type'];

/**
 * All supported event types.
 */
export const COMPANY_PRODUCT_EVENT_TYPES: CompanyProductEventType[] = [
  'CompanyProductPhaseSet',
  'CompanyProductProcessSet',
  'CompanyProductStageSet',
  'CompanyProductProcessCompleted',
  'CompanyProductSLAWarning',
  'CompanyProductSLABreached',
  'CompanyProductHealthUpdated',
  'CompanyProductHealthComputed',
  'CompanyProductRiskLevelSet',
  'CompanyProductActivityRecorded',
  'CompanyProductNoteAdded',
  'CompanyProductOwnerSet',
  'CompanyProductTierSet',
  'CompanyProductMRRSet',
  'CompanyProductSeatsSet',
  'CompanyProductNextStepDueSet',
  'AISuggestionCreated',
  'AISuggestionAccepted',
  'AISuggestionDismissed',
];

// ============================================================================
// EVENT BUILDERS
// ============================================================================

/**
 * Creates a PhaseSet event.
 */
export function createPhaseSetEvent(
  data: CompanyProductPhaseSetData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): CompanyProductPhaseSet {
  return {
    type: 'CompanyProductPhaseSet',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

/**
 * Creates a ProcessSet event.
 */
export function createProcessSetEvent(
  data: CompanyProductProcessSetData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): CompanyProductProcessSet {
  return {
    type: 'CompanyProductProcessSet',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

/**
 * Creates a StageSet event.
 */
export function createStageSetEvent(
  data: CompanyProductStageSetData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): CompanyProductStageSet {
  return {
    type: 'CompanyProductStageSet',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

/**
 * Creates a ProcessCompleted event.
 */
export function createProcessCompletedEvent(
  data: CompanyProductProcessCompletedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): CompanyProductProcessCompleted {
  return {
    type: 'CompanyProductProcessCompleted',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

/**
 * Creates an OwnerSet event.
 */
export function createOwnerSetEvent(
  data: CompanyProductOwnerSetData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): CompanyProductOwnerSet {
  return {
    type: 'CompanyProductOwnerSet',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

/**
 * Creates a TierSet event.
 */
export function createTierSetEvent(
  data: CompanyProductTierSetData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): CompanyProductTierSet {
  return {
    type: 'CompanyProductTierSet',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

/**
 * Creates an MRRSet event.
 */
export function createMRRSetEvent(
  data: CompanyProductMRRSetData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): CompanyProductMRRSet {
  return {
    type: 'CompanyProductMRRSet',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

/**
 * Creates a SeatsSet event.
 */
export function createSeatsSetEvent(
  data: CompanyProductSeatsSetData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): CompanyProductSeatsSet {
  return {
    type: 'CompanyProductSeatsSet',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

/**
 * Creates a NextStepDueSet event.
 */
export function createNextStepDueSetEvent(
  data: CompanyProductNextStepDueSetData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): CompanyProductNextStepDueSet {
  return {
    type: 'CompanyProductNextStepDueSet',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

/**
 * Creates a HealthComputed event.
 */
export function createHealthComputedEvent(
  data: CompanyProductHealthComputedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): CompanyProductHealthComputed {
  return {
    type: 'CompanyProductHealthComputed',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

/**
 * Creates a RiskLevelSet event.
 */
export function createRiskLevelSetEvent(
  data: CompanyProductRiskLevelSetData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): CompanyProductRiskLevelSet {
  return {
    type: 'CompanyProductRiskLevelSet',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

// ============================================================================
// AI SUGGESTION EVENTS
// ============================================================================

/**
 * Suggestion types that AI can generate.
 */
export type AISuggestionType =
  | 'advance_stage'
  | 'set_tier'
  | 'set_owner'
  | 'add_task'
  | 'schedule_followup'
  | 'flag_risk'
  | 'other';

/**
 * AISuggestionCreated - AI generates a suggestion for human review.
 *
 * GUARDRAIL: AI never auto-executes. All suggestions require human acceptance.
 */
export interface AISuggestionCreatedData {
  /** Unique suggestion ID */
  suggestionId: string;
  /** Type of suggestion */
  suggestionType: AISuggestionType;
  /** Human-readable title */
  title: string;
  /** Detailed description/reasoning */
  description: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Source that triggered the suggestion (e.g., transcript_id, email_id) */
  sourceType: 'transcript' | 'email' | 'activity' | 'sla_scan' | 'health_score' | 'manual';
  /** Source ID */
  sourceId?: string;
  /** Suggested action payload (JSON) */
  suggestedAction: {
    /** Command to execute if accepted */
    command: string;
    /** Command parameters */
    params: Record<string, unknown>;
  };
  /** Expiration time (ISO string) - suggestions expire */
  expiresAt?: string;
}

export type AISuggestionCreatedV1 = BaseEvent<
  'AISuggestionCreated',
  AISuggestionCreatedData,
  1
>;

export type AISuggestionCreated = AISuggestionCreatedV1;

/**
 * AISuggestionAccepted - Human accepts an AI suggestion.
 *
 * After acceptance, the suggested command should be executed.
 */
export interface AISuggestionAcceptedData {
  /** Suggestion ID being accepted */
  suggestionId: string;
  /** Type of suggestion */
  suggestionType: AISuggestionType;
  /** Optional modification to the suggestion */
  modification?: string;
  /** Whether to execute the suggested action automatically */
  executeAction: boolean;
}

export type AISuggestionAcceptedV1 = BaseEvent<
  'AISuggestionAccepted',
  AISuggestionAcceptedData,
  1
>;

export type AISuggestionAccepted = AISuggestionAcceptedV1;

/**
 * AISuggestionDismissed - Human dismisses an AI suggestion.
 */
export interface AISuggestionDismissedData {
  /** Suggestion ID being dismissed */
  suggestionId: string;
  /** Type of suggestion */
  suggestionType: AISuggestionType;
  /** Reason for dismissal */
  dismissReason?: 'not_relevant' | 'already_done' | 'incorrect' | 'deferred' | 'other';
  /** Additional feedback */
  feedback?: string;
}

export type AISuggestionDismissedV1 = BaseEvent<
  'AISuggestionDismissed',
  AISuggestionDismissedData,
  1
>;

export type AISuggestionDismissed = AISuggestionDismissedV1;

// ============================================================================
// AI SUGGESTION EVENT BUILDERS
// ============================================================================

/**
 * Creates an AISuggestionCreated event.
 */
export function createAISuggestionCreatedEvent(
  data: AISuggestionCreatedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): AISuggestionCreated {
  return {
    type: 'AISuggestionCreated',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

/**
 * Creates an AISuggestionAccepted event.
 */
export function createAISuggestionAcceptedEvent(
  data: AISuggestionAcceptedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): AISuggestionAccepted {
  return {
    type: 'AISuggestionAccepted',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

/**
 * Creates an AISuggestionDismissed event.
 */
export function createAISuggestionDismissedEvent(
  data: AISuggestionDismissedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): AISuggestionDismissed {
  return {
    type: 'AISuggestionDismissed',
    version: 1,
    data,
    occurredAt: new Date().toISOString(),
    actor,
    metadata,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for PhaseSet events.
 */
export function isPhaseSetEvent(event: CompanyProductEvent): event is CompanyProductPhaseSet {
  return event.type === 'CompanyProductPhaseSet';
}

/**
 * Type guard for ProcessSet events.
 */
export function isProcessSetEvent(event: CompanyProductEvent): event is CompanyProductProcessSet {
  return event.type === 'CompanyProductProcessSet';
}

/**
 * Type guard for StageSet events.
 */
export function isStageSetEvent(event: CompanyProductEvent): event is CompanyProductStageSet {
  return event.type === 'CompanyProductStageSet';
}

/**
 * Type guard for ProcessCompleted events.
 */
export function isProcessCompletedEvent(
  event: CompanyProductEvent
): event is CompanyProductProcessCompleted {
  return event.type === 'CompanyProductProcessCompleted';
}

/**
 * Type guard for AISuggestionCreated events.
 */
export function isAISuggestionCreatedEvent(
  event: CompanyProductEvent
): event is AISuggestionCreated {
  return event.type === 'AISuggestionCreated';
}

/**
 * Type guard for AISuggestionAccepted events.
 */
export function isAISuggestionAcceptedEvent(
  event: CompanyProductEvent
): event is AISuggestionAccepted {
  return event.type === 'AISuggestionAccepted';
}

/**
 * Type guard for AISuggestionDismissed events.
 */
export function isAISuggestionDismissedEvent(
  event: CompanyProductEvent
): event is AISuggestionDismissed {
  return event.type === 'AISuggestionDismissed';
}
