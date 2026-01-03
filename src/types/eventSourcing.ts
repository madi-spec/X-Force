/**
 * Event Sourcing Types
 *
 * Core types for the event-sourced lifecycle engine.
 * All lifecycle state is derived from immutable events.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ProcessType = 'sales' | 'onboarding' | 'engagement';
export type ProcessStatus = 'draft' | 'published' | 'archived';
export type ActorType = 'user' | 'system' | 'ai';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type TerminalType = 'won' | 'lost' | 'completed' | 'churned' | 'cancelled';
export type ExitReason = 'progressed' | 'regressed' | 'completed' | 'cancelled';
export type ProjectorStatus = 'active' | 'paused' | 'rebuilding' | 'error';

// ============================================================================
// EVENT STORE
// ============================================================================

export interface EventStore {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  sequence_number: number;
  global_sequence: number;
  event_type: string;
  event_data: Record<string, unknown>;
  metadata: EventMetadata;
  actor_type: ActorType;
  actor_id: string | null;
  occurred_at: string;
  recorded_at: string;
}

export interface EventMetadata {
  correlation_id?: string;
  causation_id?: string;
  request_id?: string;
  source?: string;
  [key: string]: unknown;
}

// Type-safe event creation
export interface CreateEventInput {
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  actor_type: ActorType;
  actor_id?: string | null;
  metadata?: EventMetadata;
}

// ============================================================================
// LIFECYCLE EVENTS
// ============================================================================

// Base event interface
export interface LifecycleEvent<T extends string = string, D = Record<string, unknown>> {
  event_type: T;
  event_data: D;
}

// Company Product Lifecycle Events
export interface StageTransitionedEvent extends LifecycleEvent<'StageTransitioned'> {
  event_data: {
    from_stage_id: string | null;
    from_stage_name: string | null;
    to_stage_id: string;
    to_stage_name: string;
    process_id: string;
    process_type: ProcessType;
    reason?: string;
    triggered_by?: 'manual' | 'automation' | 'ai';
  };
}

export interface ProcessStartedEvent extends LifecycleEvent<'ProcessStarted'> {
  event_data: {
    process_id: string;
    process_type: ProcessType;
    initial_stage_id: string;
    initial_stage_name: string;
  };
}

export interface ProcessCompletedEvent extends LifecycleEvent<'ProcessCompleted'> {
  event_data: {
    process_id: string;
    process_type: ProcessType;
    terminal_stage_id: string;
    terminal_type: TerminalType;
    duration_days: number;
  };
}

export interface SLABreachedEvent extends LifecycleEvent<'SLABreached'> {
  event_data: {
    stage_id: string;
    stage_name: string;
    sla_days: number;
    actual_days: number;
    days_over: number;
  };
}

export interface HealthScoreUpdatedEvent extends LifecycleEvent<'HealthScoreUpdated'> {
  event_data: {
    previous_score: number | null;
    new_score: number;
    risk_level: RiskLevel;
    risk_factors: string[];
    calculation_method: string;
  };
}

export interface TaskCompletedEvent extends LifecycleEvent<'TaskCompleted'> {
  event_data: {
    task_id: string;
    task_type: string;
    stage_id: string;
    completed_by: string;
    completion_data?: Record<string, unknown>;
  };
}

export interface NoteAddedEvent extends LifecycleEvent<'NoteAdded'> {
  event_data: {
    note_id: string;
    content: string;
    note_type: 'general' | 'sales' | 'support' | 'internal';
    visibility: 'private' | 'team' | 'company';
  };
}

export interface ActivityRecordedEvent extends LifecycleEvent<'ActivityRecorded'> {
  event_data: {
    activity_type: 'call' | 'email' | 'meeting' | 'demo' | 'other';
    activity_id?: string;
    summary?: string;
    outcome?: string;
    contact_id?: string;
  };
}

// Union of all lifecycle event types
export type CompanyProductEvent =
  | StageTransitionedEvent
  | ProcessStartedEvent
  | ProcessCompletedEvent
  | SLABreachedEvent
  | HealthScoreUpdatedEvent
  | TaskCompletedEvent
  | NoteAddedEvent
  | ActivityRecordedEvent;

// ============================================================================
// USER PREFERENCE EVENTS
// ============================================================================

export type FocusLensType = 'sales' | 'onboarding' | 'customer_success' | 'support';

export interface UserPreferenceFocusSetEvent extends LifecycleEvent<'UserPreferenceFocusSet'> {
  event_data: {
    previous_lens: FocusLensType | null;
    new_lens: FocusLensType;
    source: 'manual' | 'role_default' | 'admin_override';
  };
}

export interface UserPreferenceUpdatedEvent extends LifecycleEvent<'UserPreferenceUpdated'> {
  event_data: {
    preference_key: string;
    previous_value: unknown;
    new_value: unknown;
  };
}

// Union of user preference events
export type UserPreferenceEvent =
  | UserPreferenceFocusSetEvent
  | UserPreferenceUpdatedEvent;

// ============================================================================
// RBAC EVENTS
// ============================================================================

export type UserRoleType =
  | 'sales_rep'
  | 'onboarding_specialist'
  | 'customer_success_manager'
  | 'support_agent'
  | 'sales_manager'
  | 'cs_manager'
  | 'support_manager'
  | 'admin';

export interface RoleAssignedEvent extends LifecycleEvent<'RoleAssigned'> {
  event_data: {
    user_id: string;
    previous_role: UserRoleType | null;
    new_role: UserRoleType;
    assigned_by: string;
    reason?: string;
  };
}

export interface PermissionGrantedEvent extends LifecycleEvent<'PermissionGranted'> {
  event_data: {
    user_id: string;
    permission_type: 'lens_access' | 'navigation_access' | 'feature_access';
    permission_value: string;
    granted_by: string;
    expires_at?: string;
  };
}

export interface PermissionRevokedEvent extends LifecycleEvent<'PermissionRevoked'> {
  event_data: {
    user_id: string;
    permission_type: 'lens_access' | 'navigation_access' | 'feature_access';
    permission_value: string;
    revoked_by: string;
    reason?: string;
  };
}

export interface LensAccessOverrideEvent extends LifecycleEvent<'LensAccessOverride'> {
  event_data: {
    user_id: string;
    added_lenses: FocusLensType[];
    removed_lenses: FocusLensType[];
    modified_by: string;
    reason?: string;
  };
}

// Union of RBAC events
export type RBACEvent =
  | RoleAssignedEvent
  | PermissionGrantedEvent
  | PermissionRevokedEvent
  | LensAccessOverrideEvent;

// ============================================================================
// PRODUCT PROCESSES
// ============================================================================

export interface ProductProcess {
  id: string;
  product_id: string;
  process_type: ProcessType;
  version: number;
  status: ProcessStatus;
  name: string;
  description: string | null;
  config: ProcessConfig;
  created_by: string | null;
  created_at: string;
  published_at: string | null;
  archived_at: string | null;
}

export interface ProcessConfig {
  auto_progress?: boolean;
  require_exit_criteria?: boolean;
  sla_calculation_method?: 'calendar' | 'business_days';
  [key: string]: unknown;
}

export interface CreateProcessInput {
  product_id: string;
  process_type: ProcessType;
  name: string;
  description?: string;
  config?: ProcessConfig;
}

// ============================================================================
// PRODUCT PROCESS STAGES
// ============================================================================

export interface ProductProcessStage {
  id: string;
  process_id: string;
  name: string;
  slug: string;
  description: string | null;
  stage_order: number;
  sla_days: number | null;
  sla_warning_days: number | null;
  exit_criteria: ExitCriteria[];
  is_terminal: boolean;
  terminal_type: TerminalType | null;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExitCriteria {
  id: string;
  type: 'task' | 'field' | 'approval' | 'custom';
  name: string;
  description?: string;
  required: boolean;
  config?: Record<string, unknown>;
}

export interface CreateStageInput {
  process_id: string;
  name: string;
  slug: string;
  description?: string;
  stage_order: number;
  sla_days?: number;
  sla_warning_days?: number;
  exit_criteria?: ExitCriteria[];
  is_terminal?: boolean;
  terminal_type?: TerminalType;
  color?: string;
  icon?: string;
}

// ============================================================================
// COMPANY PRODUCT READ MODEL (PROJECTION)
// ============================================================================

export interface CompanyProductReadModel {
  company_product_id: string;
  company_id: string;
  product_id: string;
  current_process_type: ProcessType | null;
  current_process_id: string | null;
  current_stage_id: string | null;
  current_stage_name: string | null;
  current_stage_slug: string | null;
  stage_entered_at: string | null;
  stage_sla_deadline: string | null;
  stage_sla_warning_at: string | null;
  is_sla_breached: boolean;
  is_sla_warning: boolean;
  process_started_at: string | null;
  process_completed_at: string | null;
  days_in_current_stage: number | null;
  total_process_days: number | null;
  stage_transition_count: number;
  health_score: number | null;
  risk_level: RiskLevel | null;
  risk_factors: string[];
  last_event_at: string | null;
  last_event_type: string | null;
  last_event_sequence: number | null;
  projected_at: string;
  projection_version: number;
}

// ============================================================================
// COMPANY PRODUCT STAGE FACTS (PROJECTION)
// ============================================================================

export interface CompanyProductStageFact {
  id: string;
  company_product_id: string;
  company_id: string;
  product_id: string;
  process_id: string;
  process_type: ProcessType;
  stage_id: string;
  stage_name: string;
  stage_slug: string;
  stage_order: number;
  entered_at: string;
  exited_at: string | null;
  duration_seconds: number | null;
  duration_business_days: number | null;
  sla_days: number | null;
  sla_met: boolean | null;
  days_over_sla: number | null;
  exit_reason: ExitReason | null;
  exit_event_id: string | null;
  entry_event_id: string | null;
  projected_at: string;
}

// ============================================================================
// PRODUCT PIPELINE STAGE COUNTS (PROJECTION)
// ============================================================================

export interface ProductPipelineStageCount {
  id: string;
  product_id: string;
  process_id: string;
  process_type: ProcessType;
  stage_id: string;
  stage_name: string;
  stage_order: number;
  total_count: number;
  active_count: number;
  stalled_count: number;
  breached_count: number;
  total_value: number;
  weighted_value: number;
  avg_days_in_stage: number | null;
  median_days_in_stage: number | null;
  projected_at: string;
}

// ============================================================================
// PROJECTOR CHECKPOINTS
// ============================================================================

export interface ProjectorCheckpoint {
  projector_name: string;
  last_processed_global_sequence: number;
  last_processed_event_id: string | null;
  last_processed_at: string | null;
  events_processed_count: number;
  errors_count: number;
  last_error: string | null;
  last_error_at: string | null;
  status: ProjectorStatus;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// AGGREGATE TYPES
// ============================================================================

export interface CompanyProductAggregate {
  id: string;
  company_id: string;
  product_id: string;
  events: EventStore[];
  current_state: CompanyProductReadModel | null;
}

// ============================================================================
// COMMAND TYPES
// ============================================================================

export interface TransitionStageCommand {
  company_product_id: string;
  to_stage_id: string;
  reason?: string;
  actor: {
    type: ActorType;
    id?: string;
  };
  metadata?: EventMetadata;
}

export interface StartProcessCommand {
  company_product_id: string;
  process_id: string;
  actor: {
    type: ActorType;
    id?: string;
  };
  metadata?: EventMetadata;
}

export interface CompleteProcessCommand {
  company_product_id: string;
  terminal_type: TerminalType;
  reason?: string;
  actor: {
    type: ActorType;
    id?: string;
  };
  metadata?: EventMetadata;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface PipelineQuery {
  product_id: string;
  process_type: ProcessType;
  include_archived?: boolean;
}

export interface StageVelocityQuery {
  product_id?: string;
  process_type?: ProcessType;
  stage_id?: string;
  from_date?: string;
  to_date?: string;
}

export interface EventStreamQuery {
  aggregate_type: string;
  aggregate_id: string;
  from_sequence?: number;
  to_sequence?: number;
  event_types?: string[];
}

// ============================================================================
// PROJECTOR TYPES
// ============================================================================

export interface Projector<TState> {
  name: string;
  apply(state: TState | null, event: EventStore): TState;
  getInitialState(): TState;
}

export interface ProjectorResult {
  success: boolean;
  events_processed: number;
  errors: ProjectorError[];
  new_checkpoint: number;
}

export interface ProjectorError {
  event_id: string;
  global_sequence: number;
  error: string;
  timestamp: string;
}
