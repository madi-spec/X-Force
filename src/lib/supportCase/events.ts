/**
 * SupportCase Event Catalog
 *
 * This module defines the complete catalog of events for the SupportCase aggregate.
 * All support case state changes are represented as immutable events.
 *
 * ARCHITECTURE:
 * - Events are the ONLY source of truth for support case state
 * - State is computed by replaying events in order
 * - Events are immutable once written
 * - All validation happens BEFORE emitting events
 *
 * AGGREGATE_TYPE: 'support_case'
 */

import type {
  SupportCaseStatus,
  SupportCaseSeverity,
  SupportCaseSource,
  SLAType,
} from '@/types/supportCase';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type ActorType = 'user' | 'system' | 'ai';

export const SUPPORT_CASE_AGGREGATE_TYPE = 'support_case';

// ============================================================================
// BASE EVENT TYPES
// ============================================================================

/**
 * Base metadata for all events.
 */
export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  requestId?: string;
  source?: string;
  [key: string]: unknown;
}

/**
 * Base structure for all support case events.
 */
export interface BaseEvent<TType extends string, TData, TVersion extends number = 1> {
  readonly type: TType;
  readonly version: TVersion;
  readonly data: TData;
  readonly occurredAt: string;
  readonly actor: {
    type: ActorType;
    id?: string;
  };
  readonly metadata?: EventMetadata;
}

// ============================================================================
// SUPPORT CASE CREATED EVENT
// ============================================================================

export interface SupportCaseCreatedData {
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

export type SupportCaseCreatedV1 = BaseEvent<
  'SupportCaseCreated',
  SupportCaseCreatedData,
  1
>;

export type SupportCaseCreated = SupportCaseCreatedV1;

// ============================================================================
// SUPPORT CASE ASSIGNED EVENT
// ============================================================================

export interface SupportCaseAssignedData {
  fromOwnerId: string | null;
  fromOwnerName: string | null;
  toOwnerId: string;
  toOwnerName: string;
  team?: string;
  reason?: string;
}

export type SupportCaseAssignedV1 = BaseEvent<
  'SupportCaseAssigned',
  SupportCaseAssignedData,
  1
>;

export type SupportCaseAssigned = SupportCaseAssignedV1;

// ============================================================================
// SUPPORT CASE STATUS CHANGED EVENT
// ============================================================================

export interface SupportCaseStatusChangedData {
  fromStatus: SupportCaseStatus;
  toStatus: SupportCaseStatus;
  reason?: string;
}

export type SupportCaseStatusChangedV1 = BaseEvent<
  'SupportCaseStatusChanged',
  SupportCaseStatusChangedData,
  1
>;

export type SupportCaseStatusChanged = SupportCaseStatusChangedV1;

// ============================================================================
// SUPPORT CASE SEVERITY CHANGED EVENT
// ============================================================================

export interface SupportCaseSeverityChangedData {
  fromSeverity: SupportCaseSeverity;
  toSeverity: SupportCaseSeverity;
  reason?: string;
  /** New SLA deadlines may be recalculated on severity change */
  newFirstResponseDueAt?: string;
  newResolutionDueAt?: string;
}

export type SupportCaseSeverityChangedV1 = BaseEvent<
  'SupportCaseSeverityChanged',
  SupportCaseSeverityChangedData,
  1
>;

export type SupportCaseSeverityChanged = SupportCaseSeverityChangedV1;

// ============================================================================
// SUPPORT CASE CATEGORY CHANGED EVENT
// ============================================================================

export interface SupportCaseCategoryChangedData {
  fromCategory: string | null;
  fromSubcategory: string | null;
  toCategory: string;
  toSubcategory?: string;
  reason?: string;
}

export type SupportCaseCategoryChangedV1 = BaseEvent<
  'SupportCaseCategoryChanged',
  SupportCaseCategoryChangedData,
  1
>;

export type SupportCaseCategoryChanged = SupportCaseCategoryChangedV1;

// ============================================================================
// CUSTOMER MESSAGE LOGGED EVENT
// ============================================================================

export interface CustomerMessageLoggedData {
  messageId?: string;
  channel: 'email' | 'chat' | 'phone' | 'portal';
  contentPreview?: string;
  senderEmail?: string;
  senderName?: string;
  receivedAt: string;
}

export type CustomerMessageLoggedV1 = BaseEvent<
  'CustomerMessageLogged',
  CustomerMessageLoggedData,
  1
>;

export type CustomerMessageLogged = CustomerMessageLoggedV1;

// ============================================================================
// INTERNAL NOTE ADDED EVENT
// ============================================================================

export interface InternalNoteAddedData {
  noteId: string;
  content: string;
  visibility: 'private' | 'team';
  mentionedUserIds?: string[];
}

export type InternalNoteAddedV1 = BaseEvent<
  'InternalNoteAdded',
  InternalNoteAddedData,
  1
>;

export type InternalNoteAdded = InternalNoteAddedV1;

// ============================================================================
// AGENT RESPONSE SENT EVENT
// ============================================================================

export interface AgentResponseSentData {
  responseId?: string;
  channel: 'email' | 'chat' | 'phone' | 'portal';
  contentPreview?: string;
  isFirstResponse: boolean;
  responseTimeMinutes?: number;
}

export type AgentResponseSentV1 = BaseEvent<
  'AgentResponseSent',
  AgentResponseSentData,
  1
>;

export type AgentResponseSent = AgentResponseSentV1;

// ============================================================================
// NEXT ACTION SET EVENT
// ============================================================================

export interface NextActionSetData {
  fromAction: string | null;
  fromDueAt: string | null;
  toAction: string;
  toDueAt: string;
  assignedToId?: string;
  assignedToName?: string;
}

export type NextActionSetV1 = BaseEvent<
  'NextActionSet',
  NextActionSetData,
  1
>;

export type NextActionSet = NextActionSetV1;

// ============================================================================
// SLA CONFIGURED EVENT
// ============================================================================

export interface SlaConfiguredData {
  slaType: SLAType;
  targetHours: number;
  dueAt: string;
  warningAt?: string;
  configSource: 'default' | 'product' | 'manual';
}

export type SlaConfiguredV1 = BaseEvent<
  'SlaConfigured',
  SlaConfiguredData,
  1
>;

export type SlaConfigured = SlaConfiguredV1;

// ============================================================================
// SLA BREACHED EVENT (Derived - emitted by system when breach detected)
// ============================================================================

export interface SlaBreachedData {
  slaType: SLAType;
  targetHours: number;
  actualHours: number;
  hoursOver: number;
  dueAt: string;
  breachedAt: string;
}

export type SlaBreachedV1 = BaseEvent<
  'SlaBreached',
  SlaBreachedData,
  1
>;

export type SlaBreached = SlaBreachedV1;

// ============================================================================
// SUPPORT CASE RESOLVED EVENT
// ============================================================================

export interface SupportCaseResolvedData {
  resolutionSummary: string;
  rootCause?: string;
  resolutionTimeHours: number;
  slaHours: number;
  slaMet: boolean;
}

export type SupportCaseResolvedV1 = BaseEvent<
  'SupportCaseResolved',
  SupportCaseResolvedData,
  1
>;

export type SupportCaseResolved = SupportCaseResolvedV1;

// ============================================================================
// SUPPORT CASE CLOSED EVENT
// ============================================================================

export type CloseReason = 'resolved' | 'duplicate' | 'no_response' | 'cancelled' | 'other';

export interface SupportCaseClosedData {
  closeReason: CloseReason;
  notes?: string;
  /** Whether this was closed without resolution (forced close) */
  forcedClose: boolean;
}

export type SupportCaseClosedV1 = BaseEvent<
  'SupportCaseClosed',
  SupportCaseClosedData,
  1
>;

export type SupportCaseClosed = SupportCaseClosedV1;

// ============================================================================
// SUPPORT CASE REOPENED EVENT
// ============================================================================

export interface SupportCaseReopenedData {
  reason: string;
  previousCloseReason?: CloseReason;
  reopenedFromStatus: SupportCaseStatus;
}

export type SupportCaseReopenedV1 = BaseEvent<
  'SupportCaseReopened',
  SupportCaseReopenedData,
  1
>;

export type SupportCaseReopened = SupportCaseReopenedV1;

// ============================================================================
// SUPPORT CASE ESCALATED EVENT
// ============================================================================

export interface SupportCaseEscalatedData {
  escalationLevel: number;
  escalatedToTeam?: string;
  escalatedToUserId?: string;
  escalatedToUserName?: string;
  reason: string;
}

export type SupportCaseEscalatedV1 = BaseEvent<
  'SupportCaseEscalated',
  SupportCaseEscalatedData,
  1
>;

export type SupportCaseEscalated = SupportCaseEscalatedV1;

// ============================================================================
// CSAT SUBMITTED EVENT
// ============================================================================

export interface CsatSubmittedData {
  score: number;
  comment?: string;
  submittedBy?: string;
}

export type CsatSubmittedV1 = BaseEvent<
  'CsatSubmitted',
  CsatSubmittedData,
  1
>;

export type CsatSubmitted = CsatSubmittedV1;

// ============================================================================
// TAG ADDED EVENT
// ============================================================================

export interface TagAddedData {
  tag: string;
}

export type TagAddedV1 = BaseEvent<
  'TagAdded',
  TagAddedData,
  1
>;

export type TagAdded = TagAddedV1;

// ============================================================================
// TAG REMOVED EVENT
// ============================================================================

export interface TagRemovedData {
  tag: string;
}

export type TagRemovedV1 = BaseEvent<
  'TagRemoved',
  TagRemovedData,
  1
>;

export type TagRemoved = TagRemovedV1;

// ============================================================================
// AGGREGATE EVENT UNION
// ============================================================================

/**
 * Discriminated union of all SupportCase events.
 */
export type SupportCaseEvent =
  | SupportCaseCreated
  | SupportCaseAssigned
  | SupportCaseStatusChanged
  | SupportCaseSeverityChanged
  | SupportCaseCategoryChanged
  | CustomerMessageLogged
  | InternalNoteAdded
  | AgentResponseSent
  | NextActionSet
  | SlaConfigured
  | SlaBreached
  | SupportCaseResolved
  | SupportCaseClosed
  | SupportCaseReopened
  | SupportCaseEscalated
  | CsatSubmitted
  | TagAdded
  | TagRemoved;

/**
 * Event type discriminator values.
 */
export type SupportCaseEventType = SupportCaseEvent['type'];

/**
 * All supported event types.
 */
export const SUPPORT_CASE_EVENT_TYPES: SupportCaseEventType[] = [
  'SupportCaseCreated',
  'SupportCaseAssigned',
  'SupportCaseStatusChanged',
  'SupportCaseSeverityChanged',
  'SupportCaseCategoryChanged',
  'CustomerMessageLogged',
  'InternalNoteAdded',
  'AgentResponseSent',
  'NextActionSet',
  'SlaConfigured',
  'SlaBreached',
  'SupportCaseResolved',
  'SupportCaseClosed',
  'SupportCaseReopened',
  'SupportCaseEscalated',
  'CsatSubmitted',
  'TagAdded',
  'TagRemoved',
];

// ============================================================================
// EVENT BUILDERS
// ============================================================================

function now(): string {
  return new Date().toISOString();
}

export function createSupportCaseCreatedEvent(
  data: SupportCaseCreatedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): SupportCaseCreated {
  return {
    type: 'SupportCaseCreated',
    version: 1,
    data,
    occurredAt: now(),
    actor,
    metadata,
  };
}

export function createSupportCaseAssignedEvent(
  data: SupportCaseAssignedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): SupportCaseAssigned {
  return {
    type: 'SupportCaseAssigned',
    version: 1,
    data,
    occurredAt: now(),
    actor,
    metadata,
  };
}

export function createSupportCaseStatusChangedEvent(
  data: SupportCaseStatusChangedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): SupportCaseStatusChanged {
  return {
    type: 'SupportCaseStatusChanged',
    version: 1,
    data,
    occurredAt: now(),
    actor,
    metadata,
  };
}

export function createSupportCaseSeverityChangedEvent(
  data: SupportCaseSeverityChangedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): SupportCaseSeverityChanged {
  return {
    type: 'SupportCaseSeverityChanged',
    version: 1,
    data,
    occurredAt: now(),
    actor,
    metadata,
  };
}

export function createNextActionSetEvent(
  data: NextActionSetData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): NextActionSet {
  return {
    type: 'NextActionSet',
    version: 1,
    data,
    occurredAt: now(),
    actor,
    metadata,
  };
}

export function createSlaConfiguredEvent(
  data: SlaConfiguredData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): SlaConfigured {
  return {
    type: 'SlaConfigured',
    version: 1,
    data,
    occurredAt: now(),
    actor,
    metadata,
  };
}

export function createSlaBreachedEvent(
  data: SlaBreachedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): SlaBreached {
  return {
    type: 'SlaBreached',
    version: 1,
    data,
    occurredAt: now(),
    actor,
    metadata,
  };
}

export function createSupportCaseResolvedEvent(
  data: SupportCaseResolvedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): SupportCaseResolved {
  return {
    type: 'SupportCaseResolved',
    version: 1,
    data,
    occurredAt: now(),
    actor,
    metadata,
  };
}

export function createSupportCaseClosedEvent(
  data: SupportCaseClosedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): SupportCaseClosed {
  return {
    type: 'SupportCaseClosed',
    version: 1,
    data,
    occurredAt: now(),
    actor,
    metadata,
  };
}

export function createSupportCaseReopenedEvent(
  data: SupportCaseReopenedData,
  actor: { type: ActorType; id?: string },
  metadata?: EventMetadata
): SupportCaseReopened {
  return {
    type: 'SupportCaseReopened',
    version: 1,
    data,
    occurredAt: now(),
    actor,
    metadata,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isSupportCaseCreatedEvent(
  event: SupportCaseEvent
): event is SupportCaseCreated {
  return event.type === 'SupportCaseCreated';
}

export function isSupportCaseStatusChangedEvent(
  event: SupportCaseEvent
): event is SupportCaseStatusChanged {
  return event.type === 'SupportCaseStatusChanged';
}

export function isSupportCaseResolvedEvent(
  event: SupportCaseEvent
): event is SupportCaseResolved {
  return event.type === 'SupportCaseResolved';
}

export function isSupportCaseClosedEvent(
  event: SupportCaseEvent
): event is SupportCaseClosed {
  return event.type === 'SupportCaseClosed';
}

export function isSupportCaseReopenedEvent(
  event: SupportCaseEvent
): event is SupportCaseReopened {
  return event.type === 'SupportCaseReopened';
}
