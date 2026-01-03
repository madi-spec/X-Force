/**
 * Support Case Types
 *
 * Types for the event-sourced support case system.
 * Support cases are a core engagement signal affecting health/risk.
 */

import type { ActorType, EventMetadata, EventStore } from './eventSourcing';

// ============================================================================
// ENUMS
// ============================================================================

export type SupportCaseStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_on_customer'
  | 'waiting_on_internal'
  | 'escalated'
  | 'resolved'
  | 'closed';

export type SupportCaseSeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent'
  | 'critical';

export type SupportCaseSource =
  | 'email'
  | 'phone'
  | 'chat'
  | 'portal'
  | 'internal';

export type EngagementImpact =
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'critical';

export type SLAType =
  | 'first_response'
  | 'resolution'
  | 'update';

// ============================================================================
// IDENTITY TABLE (Aggregate Root)
// ============================================================================

/**
 * SupportCase identity - thin aggregate root.
 * No mutable state - all state derived from events.
 */
export interface SupportCase {
  id: string;
  company_id: string;
  company_product_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSupportCaseInput {
  company_id: string;
  company_product_id?: string | null;
}

// ============================================================================
// READ MODEL (Projection)
// ============================================================================

/**
 * Current state of a support case.
 * PROJECTION - derived from events.
 */
export interface SupportCaseReadModel {
  support_case_id: string;
  company_id: string;
  company_product_id: string | null;

  // Case information
  title: string | null;
  description: string | null;
  external_id: string | null;
  source: SupportCaseSource | null;

  // Status
  status: SupportCaseStatus;
  severity: SupportCaseSeverity;

  // Category
  category: string | null;
  subcategory: string | null;
  tags: string[];

  // Assignment
  owner_id: string | null;
  owner_name: string | null;
  assigned_team: string | null;

  // SLA tracking
  first_response_due_at: string | null;
  first_response_at: string | null;
  first_response_breached: boolean;

  resolution_due_at: string | null;
  resolved_at: string | null;
  resolution_breached: boolean;

  // Timing
  opened_at: string;
  last_customer_contact_at: string | null;
  last_agent_response_at: string | null;
  closed_at: string | null;

  // Metrics
  response_count: number;
  customer_response_count: number;
  agent_response_count: number;
  escalation_count: number;
  reopen_count: number;

  // Customer satisfaction
  csat_score: number | null;
  csat_comment: string | null;
  csat_submitted_at: string | null;

  // Resolution
  resolution_summary: string | null;
  root_cause: string | null;

  // Impact on engagement
  engagement_impact: EngagementImpact | null;
  churn_risk_contribution: number | null;

  // Last event tracking
  last_event_at: string | null;
  last_event_type: string | null;
  last_event_sequence: number | null;

  // Projection metadata
  projected_at: string;
  projection_version: number;
}

// ============================================================================
// SLA FACTS (Projection)
// ============================================================================

/**
 * SLA tracking for a support case.
 * PROJECTION - derived from SLA events.
 */
export interface SupportCaseSLAFact {
  id: string;
  support_case_id: string;
  company_id: string;
  company_product_id: string | null;

  // SLA type
  sla_type: SLAType;

  // Target
  severity: SupportCaseSeverity;
  target_hours: number;
  due_at: string;

  // Outcome
  met_at: string | null;
  breached_at: string | null;
  is_breached: boolean;

  // Duration
  actual_hours: number | null;
  hours_over_sla: number | null;

  // Event tracking
  sla_set_event_id: string | null;
  sla_met_event_id: string | null;
  sla_breached_event_id: string | null;

  // Projection metadata
  projected_at: string;
}

// ============================================================================
// AGGREGATED COUNTS (Projection)
// ============================================================================

/**
 * Aggregated case counts per company_product.
 * PROJECTION - for dashboards and health scoring.
 */
export interface CompanyProductOpenCaseCounts {
  company_product_id: string;
  company_id: string;
  product_id: string;

  // Counts by status
  open_count: number;
  in_progress_count: number;
  waiting_count: number;
  escalated_count: number;

  // Counts by severity
  low_count: number;
  medium_count: number;
  high_count: number;
  urgent_count: number;
  critical_count: number;

  // SLA status
  first_response_breached_count: number;
  resolution_breached_count: number;
  any_breached_count: number;

  // At risk (approaching SLA)
  first_response_at_risk_count: number;
  resolution_at_risk_count: number;

  // Totals
  total_open_count: number;
  total_resolved_30d: number;

  // Impact summary
  negative_impact_count: number;
  critical_impact_count: number;

  // Averages
  avg_resolution_hours_30d: number | null;
  avg_first_response_hours_30d: number | null;
  avg_csat_30d: number | null;

  // Projection metadata
  projected_at: string;
}

/**
 * Company-level case aggregation.
 * PROJECTION - for overall health scoring.
 */
export interface CompanyOpenCaseCounts {
  company_id: string;

  // Counts
  total_open_count: number;
  unassigned_product_count: number;
  high_and_above_count: number;
  critical_count: number;

  // SLA
  any_breached_count: number;

  // Health indicator
  support_health_score: number | null;
  support_risk_level: 'low' | 'medium' | 'high' | 'critical' | null;

  // Projection metadata
  projected_at: string;
}

// ============================================================================
// SLA CONFIGURATION
// ============================================================================

export interface SupportSLAConfig {
  id: string;
  product_id: string | null;
  severity: SupportCaseSeverity;
  first_response_hours: number;
  resolution_hours: number;
  update_hours: number | null;
  warning_threshold_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// EVENTS
// ============================================================================

// Base support case event
export interface SupportCaseEvent<T extends string = string, D = Record<string, unknown>> {
  type: T;
  version: number;
  data: D;
  occurredAt: string;
  actor: {
    type: ActorType;
    id: string;
  };
  metadata?: EventMetadata;
}

// Case Created
export interface SupportCaseCreated extends SupportCaseEvent<'SupportCaseCreated'> {
  data: {
    title: string;
    description?: string;
    severity: SupportCaseSeverity;
    category?: string;
    source: SupportCaseSource;
    external_id?: string;
    first_response_due_at?: string;
    resolution_due_at?: string;
  };
}

// Case Assigned
export interface SupportCaseAssigned extends SupportCaseEvent<'SupportCaseAssigned'> {
  data: {
    owner_id: string;
    owner_name: string;
    team?: string;
    previous_owner_id?: string;
  };
}

// Status Changed
export interface SupportCaseStatusChanged extends SupportCaseEvent<'SupportCaseStatusChanged'> {
  data: {
    from_status: SupportCaseStatus;
    to_status: SupportCaseStatus;
    reason?: string;
  };
}

// Severity Changed
export interface SupportCaseSeverityChanged extends SupportCaseEvent<'SupportCaseSeverityChanged'> {
  data: {
    from_severity: SupportCaseSeverity;
    to_severity: SupportCaseSeverity;
    reason?: string;
    // SLA recalculation
    new_first_response_due_at?: string;
    new_resolution_due_at?: string;
  };
}

// Response Added
export interface SupportCaseResponseAdded extends SupportCaseEvent<'SupportCaseResponseAdded'> {
  data: {
    response_type: 'customer' | 'agent' | 'system';
    content_preview?: string;
    is_public: boolean;
    responder_id?: string;
    responder_name?: string;
  };
}

// First Response Sent
export interface SupportCaseFirstResponseSent extends SupportCaseEvent<'SupportCaseFirstResponseSent'> {
  data: {
    response_time_hours: number;
    sla_hours: number;
    sla_met: boolean;
  };
}

// Escalated
export interface SupportCaseEscalated extends SupportCaseEvent<'SupportCaseEscalated'> {
  data: {
    escalation_level: number;
    escalated_to_team?: string;
    escalated_to_user_id?: string;
    reason: string;
  };
}

// SLA Breached
export interface SupportCaseSLABreached extends SupportCaseEvent<'SupportCaseSLABreached'> {
  data: {
    sla_type: SLAType;
    target_hours: number;
    actual_hours: number;
    hours_over: number;
  };
}

// Resolved
export interface SupportCaseResolved extends SupportCaseEvent<'SupportCaseResolved'> {
  data: {
    resolution_summary: string;
    root_cause?: string;
    resolution_time_hours: number;
    sla_hours: number;
    sla_met: boolean;
  };
}

// Closed
export interface SupportCaseClosed extends SupportCaseEvent<'SupportCaseClosed'> {
  data: {
    close_reason: 'resolved' | 'duplicate' | 'no_response' | 'cancelled' | 'other';
    final_status: SupportCaseStatus;
  };
}

// Reopened
export interface SupportCaseReopened extends SupportCaseEvent<'SupportCaseReopened'> {
  data: {
    reason: string;
    previous_close_reason?: string;
  };
}

// CSAT Submitted
export interface SupportCaseCSATSubmitted extends SupportCaseEvent<'SupportCaseCSATSubmitted'> {
  data: {
    score: number;
    comment?: string;
  };
}

// Engagement Impact Assessed
export interface SupportCaseEngagementImpactAssessed extends SupportCaseEvent<'SupportCaseEngagementImpactAssessed'> {
  data: {
    impact: EngagementImpact;
    churn_risk_contribution: number;
    assessment_notes?: string;
  };
}

// Union of all support case events
export type SupportCaseEventType =
  | SupportCaseCreated
  | SupportCaseAssigned
  | SupportCaseStatusChanged
  | SupportCaseSeverityChanged
  | SupportCaseResponseAdded
  | SupportCaseFirstResponseSent
  | SupportCaseEscalated
  | SupportCaseSLABreached
  | SupportCaseResolved
  | SupportCaseClosed
  | SupportCaseReopened
  | SupportCaseCSATSubmitted
  | SupportCaseEngagementImpactAssessed;

// ============================================================================
// COMMANDS
// ============================================================================

export interface CreateSupportCaseCommand {
  company_id: string;
  company_product_id?: string;
  title: string;
  description?: string;
  severity: SupportCaseSeverity;
  category?: string;
  source: SupportCaseSource;
  external_id?: string;
  actor: {
    type: ActorType;
    id: string;
  };
  metadata?: EventMetadata;
}

export interface AssignSupportCaseCommand {
  support_case_id: string;
  owner_id: string;
  owner_name: string;
  team?: string;
  actor: {
    type: ActorType;
    id: string;
  };
  metadata?: EventMetadata;
}

export interface ChangeSupportCaseStatusCommand {
  support_case_id: string;
  to_status: SupportCaseStatus;
  reason?: string;
  actor: {
    type: ActorType;
    id: string;
  };
  metadata?: EventMetadata;
}

export interface ChangeSupportCaseSeverityCommand {
  support_case_id: string;
  to_severity: SupportCaseSeverity;
  reason?: string;
  actor: {
    type: ActorType;
    id: string;
  };
  metadata?: EventMetadata;
}

export interface AddSupportCaseResponseCommand {
  support_case_id: string;
  response_type: 'customer' | 'agent' | 'system';
  content_preview?: string;
  is_public: boolean;
  actor: {
    type: ActorType;
    id: string;
  };
  metadata?: EventMetadata;
}

export interface EscalateSupportCaseCommand {
  support_case_id: string;
  escalation_level: number;
  escalated_to_team?: string;
  escalated_to_user_id?: string;
  reason: string;
  actor: {
    type: ActorType;
    id: string;
  };
  metadata?: EventMetadata;
}

export interface ResolveSupportCaseCommand {
  support_case_id: string;
  resolution_summary: string;
  root_cause?: string;
  actor: {
    type: ActorType;
    id: string;
  };
  metadata?: EventMetadata;
}

export interface CloseSupportCaseCommand {
  support_case_id: string;
  close_reason: 'resolved' | 'duplicate' | 'no_response' | 'cancelled' | 'other';
  actor: {
    type: ActorType;
    id: string;
  };
  metadata?: EventMetadata;
}

export interface ReopenSupportCaseCommand {
  support_case_id: string;
  reason: string;
  actor: {
    type: ActorType;
    id: string;
  };
  metadata?: EventMetadata;
}

export interface SubmitSupportCaseCSATCommand {
  support_case_id: string;
  score: number;
  comment?: string;
  actor: {
    type: ActorType;
    id: string;
  };
  metadata?: EventMetadata;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface SupportCaseQueueQuery {
  status?: SupportCaseStatus[];
  severity?: SupportCaseSeverity[];
  owner_id?: string;
  team?: string;
  company_id?: string;
  company_product_id?: string;
  sla_breached?: boolean;
  sla_at_risk?: boolean;
  limit?: number;
  offset?: number;
  order_by?: 'severity' | 'created_at' | 'first_response_due_at' | 'resolution_due_at';
  order_direction?: 'asc' | 'desc';
}

export interface SupportCaseStatsQuery {
  company_id?: string;
  company_product_id?: string;
  product_id?: string;
  from_date?: string;
  to_date?: string;
}

// ============================================================================
// AGGREGATE
// ============================================================================

export interface SupportCaseAggregate {
  id: string;
  company_id: string;
  company_product_id: string | null;
  events: EventStore[];
  current_state: SupportCaseReadModel | null;
}
