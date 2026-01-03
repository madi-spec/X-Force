/**
 * WorkItem Event Types
 *
 * All lifecycle writes are events only; projections are derived.
 * These events form the canonical WorkItem stream.
 */

import { LifecycleEvent, ActorType } from '@/types/eventSourcing';
import { LensType } from '@/lib/lens/types';
import { QueueId } from './types';

// ============================================================================
// WORK ITEM SOURCE TYPES
// ============================================================================

export type WorkItemSourceType =
  | 'communication'      // Message needing reply
  | 'scheduler'          // Meeting needed / follow-up scheduled
  | 'command_center'     // Promise at risk, SLA breach, churn risk, expansion ready
  | 'lifecycle_stage';   // Deal stage stuck, onboarding milestone due, case escalated

export type WorkItemSignalType =
  | 'message_needs_reply'
  | 'meeting_scheduled'
  | 'follow_up_due'
  | 'promise_at_risk'
  | 'sla_breach'
  | 'churn_risk'
  | 'expansion_ready'
  | 'deal_stalled'
  | 'onboarding_blocked'
  | 'case_escalated'
  | 'case_opened'
  | 'milestone_due';

export type WorkItemStatus = 'open' | 'snoozed' | 'resolved';

export type WorkItemPriority = 'critical' | 'high' | 'medium' | 'low';

// ============================================================================
// WORK ITEM EVENTS
// ============================================================================

/**
 * WorkItemCreated - Initial creation of a work item
 */
export interface WorkItemCreatedEvent extends LifecycleEvent<'WorkItemCreated'> {
  event_data: {
    work_item_id: string;
    focus_lens: LensType;
    queue_id: QueueId;

    // Entity references (immutable)
    company_id: string;
    company_name: string;
    deal_id?: string;
    case_id?: string;
    communication_id?: string;
    contact_id?: string;

    // Deep linking for communications (optional)
    // When work item is triggered by a specific message, include these
    trigger_communication_id?: string;  // The communication that triggered this
    trigger_message_id?: string;        // External message ID for deep linking

    // Source signal
    source_type: WorkItemSourceType;
    signal_type: WorkItemSignalType;
    signal_id?: string;

    // Display
    title: string;
    subtitle: string;
    why_here: string;  // Human explanation derived from signal + playbook
    priority: WorkItemPriority;
    priority_score: number;

    // Assignment
    assigned_to_user_id?: string;
    assigned_to_team_id?: string;

    // Analysis artifact (not keyword matching - playbook classification)
    analysis_artifact_id?: string;
  };
}

/**
 * WorkItemSignalAttached - Additional signal attached to existing work item
 */
export interface WorkItemSignalAttachedEvent extends LifecycleEvent<'WorkItemSignalAttached'> {
  event_data: {
    work_item_id: string;
    signal_type: WorkItemSignalType;
    signal_id: string;
    signal_source: WorkItemSourceType;
    signal_summary: string;
    priority_delta: number;  // How much this changes priority
    updated_why_here?: string;  // Updated explanation if needed
  };
}

/**
 * WorkItemAssigned - Work item assigned to user/team
 */
export interface WorkItemAssignedEvent extends LifecycleEvent<'WorkItemAssigned'> {
  event_data: {
    work_item_id: string;
    previous_user_id: string | null;
    new_user_id: string | null;
    previous_team_id: string | null;
    new_team_id: string | null;
    reason?: string;
  };
}

/**
 * WorkItemResolved - Work item resolved/completed
 */
export interface WorkItemResolvedEvent extends LifecycleEvent<'WorkItemResolved'> {
  event_data: {
    work_item_id: string;
    resolution_type: 'completed' | 'cancelled' | 'merged' | 'invalid';
    resolution_notes?: string;
    resolved_by_action?: string;  // e.g., 'replied', 'scheduled_meeting', 'closed_case'
    merged_into_work_item_id?: string;
  };
}

/**
 * WorkItemSnoozed - Work item temporarily hidden
 */
export interface WorkItemSnoozedEvent extends LifecycleEvent<'WorkItemSnoozed'> {
  event_data: {
    work_item_id: string;
    snooze_until: string;  // ISO date
    snooze_reason?: string;
  };
}

/**
 * WorkItemReopened - Work item reopened after snooze/resolution
 */
export interface WorkItemReopenedEvent extends LifecycleEvent<'WorkItemReopened'> {
  event_data: {
    work_item_id: string;
    reopen_reason: 'snooze_expired' | 'manual' | 'new_signal' | 'meeting_cancelled';
    new_signal_id?: string;
    // For meeting_cancelled reopen reason
    scheduling_request_id?: string;
    cancellation_reason?: string;
  };
}

/**
 * WorkItemPriorityUpdated - Priority recalculated
 */
export interface WorkItemPriorityUpdatedEvent extends LifecycleEvent<'WorkItemPriorityUpdated'> {
  event_data: {
    work_item_id: string;
    previous_priority: WorkItemPriority;
    new_priority: WorkItemPriority;
    previous_score: number;
    new_score: number;
    reason: string;
  };
}

// Union of all work item events
export type WorkItemEvent =
  | WorkItemCreatedEvent
  | WorkItemSignalAttachedEvent
  | WorkItemAssignedEvent
  | WorkItemResolvedEvent
  | WorkItemSnoozedEvent
  | WorkItemReopenedEvent
  | WorkItemPriorityUpdatedEvent;

// ============================================================================
// EVENT CREATION HELPERS
// ============================================================================

export interface CreateWorkItemInput {
  focus_lens: LensType;
  queue_id: QueueId;
  company_id: string;
  company_name: string;
  deal_id?: string;
  case_id?: string;
  communication_id?: string;
  contact_id?: string;
  // Deep linking for communications
  trigger_communication_id?: string;
  trigger_message_id?: string;
  source_type: WorkItemSourceType;
  signal_type: WorkItemSignalType;
  signal_id?: string;
  title: string;
  subtitle: string;
  why_here: string;
  priority: WorkItemPriority;
  priority_score: number;
  assigned_to_user_id?: string;
  analysis_artifact_id?: string;
}

export interface ResolveWorkItemInput {
  work_item_id: string;
  resolution_type: 'completed' | 'cancelled' | 'merged' | 'invalid';
  resolution_notes?: string;
  resolved_by_action?: string;
}

export interface SnoozeWorkItemInput {
  work_item_id: string;
  snooze_until: string;
  snooze_reason?: string;
}
