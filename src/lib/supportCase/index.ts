/**
 * SupportCase Domain Module
 *
 * Event-sourced aggregate for support case management.
 * All state is derived from events - never stored directly.
 *
 * Usage:
 * ```typescript
 * import {
 *   createSupportCase,
 *   assignSupportCase,
 *   resolveSupportCase,
 *   closeSupportCase,
 *   loadSupportCaseAggregate,
 * } from '@/lib/supportCase';
 * ```
 */

// Events
export {
  // Constants
  SUPPORT_CASE_AGGREGATE_TYPE,
  SUPPORT_CASE_EVENT_TYPES,

  // Event types
  type SupportCaseEvent,
  type SupportCaseEventType,
  type SupportCaseCreated,
  type SupportCaseAssigned,
  type SupportCaseStatusChanged,
  type SupportCaseSeverityChanged,
  type SupportCaseCategoryChanged,
  type CustomerMessageLogged,
  type InternalNoteAdded,
  type AgentResponseSent,
  type NextActionSet,
  type SlaConfigured,
  type SlaBreached,
  type SupportCaseResolved,
  type SupportCaseClosed,
  type SupportCaseReopened,
  type SupportCaseEscalated,
  type CsatSubmitted,
  type TagAdded,
  type TagRemoved,

  // Data types
  type SupportCaseCreatedData,
  type SupportCaseAssignedData,
  type SupportCaseStatusChangedData,
  type SupportCaseSeverityChangedData,
  type NextActionSetData,
  type SlaConfiguredData,
  type SlaBreachedData,
  type SupportCaseResolvedData,
  type SupportCaseClosedData,
  type SupportCaseReopenedData,
  type CloseReason,

  // Base types
  type ActorType,
  type EventMetadata,
  type BaseEvent,

  // Event builders
  createSupportCaseCreatedEvent,
  createSupportCaseAssignedEvent,
  createSupportCaseStatusChangedEvent,
  createSupportCaseSeverityChangedEvent,
  createNextActionSetEvent,
  createSlaConfiguredEvent,
  createSlaBreachedEvent,
  createSupportCaseResolvedEvent,
  createSupportCaseClosedEvent,
  createSupportCaseReopenedEvent,

  // Type guards
  isSupportCaseCreatedEvent,
  isSupportCaseStatusChangedEvent,
  isSupportCaseResolvedEvent,
  isSupportCaseClosedEvent,
  isSupportCaseReopenedEvent,
} from './events';

// Aggregate
export {
  // State types
  type SupportCaseState,
  type SlaState,
  type LoadedSupportCaseAggregate,

  // State functions
  createInitialState,
  applyEvent,
  replayEvents,

  // Aggregate loading
  loadSupportCaseAggregate,
  loadSupportCaseAggregateAtSequence,

  // Invariant checks
  VALID_STATUS_TRANSITIONS,
  isValidStatusTransition,
  canClose,
  canReopen,
} from './aggregate';

// Commands
export {
  // Core append
  type AppendEventInput,
  type AppendEventResult,
  appendEvent,

  // Command types
  type CreateSupportCaseCommand,
  type AssignSupportCaseCommand,
  type ChangeSupportCaseStatusCommand,
  type ChangeSupportCaseSeverityCommand,
  type SetSupportCaseNextActionCommand,
  type ConfigureSupportCaseSlaCommand,
  type ResolveSupportCaseCommand,
  type CloseSupportCaseCommand,
  type ReopenSupportCaseCommand,

  // Command handlers
  createSupportCase,
  assignSupportCase,
  changeSupportCaseStatus,
  changeSupportCaseSeverity,
  setSupportCaseNextAction,
  configureSupportCaseSla,
  resolveSupportCase,
  closeSupportCase,
  reopenSupportCase,
} from './commands';
