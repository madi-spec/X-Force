/**
 * Scheduler Event Types for Work Integration
 *
 * Event-sourced scheduling with Work item coordination.
 * Uses deterministic rules for resolution - no keyword matching.
 */

import { LifecycleEvent } from '@/types/eventSourcing';
import { MeetingType, MeetingPlatform, SchedulingStatus } from './types';

// ============================================
// SCHEDULER EVENTS
// ============================================

/**
 * Emitted when a scheduling request is initiated from a Work item
 */
export interface SchedulingRequestedEvent extends LifecycleEvent<'SchedulingRequested'> {
  event_data: {
    scheduling_request_id: string;
    work_item_id: string;
    company_id: string;
    company_name: string;
    contact_id?: string;
    contact_name?: string;
    contact_email?: string;
    deal_id?: string;
    meeting_type: MeetingType;
    duration_minutes: number;
    context?: string;
    // Track what triggered this scheduling attempt
    triggered_by_signal_type?: string;
    trigger_communication_id?: string;
  };
}

/**
 * Emitted when a meeting is successfully booked (confirmed time)
 */
export interface MeetingBookedEvent extends LifecycleEvent<'MeetingBooked'> {
  event_data: {
    scheduling_request_id: string;
    work_item_id: string;
    company_id: string;
    company_name: string;
    meeting_time: string;
    meeting_type: MeetingType;
    meeting_platform: MeetingPlatform;
    duration_minutes: number;
    calendar_event_id?: string;
    // Attendees at time of booking
    internal_attendees: Array<{ user_id: string; name: string }>;
    external_attendees: Array<{ contact_id?: string; name: string; email: string }>;
  };
}

/**
 * Emitted when a scheduled meeting is cancelled
 */
export interface MeetingCancelledEvent extends LifecycleEvent<'MeetingCancelled'> {
  event_data: {
    scheduling_request_id: string;
    work_item_id?: string;
    company_id: string;
    reason: 'cancelled_by_us' | 'cancelled_by_them' | 'no_response' | 'rescheduling';
    notes?: string;
  };
}

/**
 * Emitted when a scheduled meeting is completed (held)
 */
export interface MeetingCompletedEvent extends LifecycleEvent<'MeetingCompleted'> {
  event_data: {
    scheduling_request_id: string;
    work_item_id?: string;
    company_id: string;
    meeting_time: string;
    outcome: 'held' | 'no_show' | 'partial_attendance';
    notes?: string;
  };
}

export type SchedulerEvent =
  | SchedulingRequestedEvent
  | MeetingBookedEvent
  | MeetingCancelledEvent
  | MeetingCompletedEvent;

// ============================================
// RESOLUTION RULES
// ============================================

/**
 * Resolution policy for scheduler-related work items.
 * Determines when a work item should be resolved based on scheduling events.
 */
export interface SchedulerResolutionRule {
  work_item_signal_type: string;
  resolves_when: 'meeting_booked' | 'scheduling_requested' | 'meeting_completed' | 'manual';
  reopen_on_cancel: boolean;
  description: string;
}

/**
 * Deterministic rules for when scheduling resolves a work item.
 * These rules are testable and contain no AI/keyword logic.
 */
export const SCHEDULER_RESOLUTION_RULES: SchedulerResolutionRule[] = [
  {
    work_item_signal_type: 'meeting_scheduled',
    resolves_when: 'meeting_booked',
    reopen_on_cancel: true,
    description: 'Resolve when meeting is confirmed on calendar',
  },
  {
    work_item_signal_type: 'follow_up_due',
    resolves_when: 'meeting_booked',
    reopen_on_cancel: true,
    description: 'Follow-up resolved when meeting is scheduled',
  },
  {
    work_item_signal_type: 'deal_stalled',
    resolves_when: 'meeting_booked',
    reopen_on_cancel: true,
    description: 'Stalled deal resolved when re-engagement meeting booked',
  },
  {
    work_item_signal_type: 'churn_risk',
    resolves_when: 'meeting_booked',
    reopen_on_cancel: true,
    description: 'Churn risk addressed when check-in meeting booked',
  },
  {
    work_item_signal_type: 'opportunity_detected',
    resolves_when: 'scheduling_requested',
    reopen_on_cancel: false,
    description: 'Opportunity actioned when scheduling is initiated',
  },
  {
    work_item_signal_type: 'trial_ending',
    resolves_when: 'meeting_booked',
    reopen_on_cancel: true,
    description: 'Trial ending resolved when close/conversion meeting booked',
  },
];

/**
 * Determines if a scheduling event should resolve a work item.
 *
 * @param workItemSignalType - The signal type of the work item
 * @param eventType - The scheduler event that occurred
 * @param meetingWasBooked - Whether the meeting is now confirmed
 * @returns Resolution decision with reason
 */
export function shouldSchedulingResolveWorkItem(
  workItemSignalType: string,
  eventType: 'SchedulingRequested' | 'MeetingBooked' | 'MeetingCancelled' | 'MeetingCompleted',
  meetingWasBooked: boolean = false
): { resolves: boolean; reason: string } {
  const rule = SCHEDULER_RESOLUTION_RULES.find(
    (r) => r.work_item_signal_type === workItemSignalType
  );

  if (!rule) {
    return {
      resolves: false,
      reason: `No scheduler resolution rule for signal type: ${workItemSignalType}`,
    };
  }

  // Handle based on event type
  switch (eventType) {
    case 'SchedulingRequested':
      if (rule.resolves_when === 'scheduling_requested') {
        return {
          resolves: true,
          reason: `Scheduling initiated resolves ${workItemSignalType} per rule: ${rule.description}`,
        };
      }
      return {
        resolves: false,
        reason: `${workItemSignalType} requires ${rule.resolves_when}, not scheduling_requested`,
      };

    case 'MeetingBooked':
      if (rule.resolves_when === 'meeting_booked' || rule.resolves_when === 'scheduling_requested') {
        return {
          resolves: true,
          reason: `Meeting booked resolves ${workItemSignalType} per rule: ${rule.description}`,
        };
      }
      return {
        resolves: false,
        reason: `${workItemSignalType} requires ${rule.resolves_when}, not meeting_booked`,
      };

    case 'MeetingCompleted':
      if (rule.resolves_when === 'meeting_completed') {
        return {
          resolves: true,
          reason: `Meeting completed resolves ${workItemSignalType} per rule: ${rule.description}`,
        };
      }
      // Meeting completed should also resolve anything that resolves on booking
      if (rule.resolves_when === 'meeting_booked' || rule.resolves_when === 'scheduling_requested') {
        return {
          resolves: true,
          reason: `Meeting completed (implicitly resolves ${workItemSignalType})`,
        };
      }
      return {
        resolves: false,
        reason: `${workItemSignalType} requires ${rule.resolves_when}`,
      };

    case 'MeetingCancelled':
      // Cancellations don't resolve - they may reopen
      return {
        resolves: false,
        reason: 'Meeting cancellation does not resolve work items',
      };

    default:
      return {
        resolves: false,
        reason: `Unknown event type: ${eventType}`,
      };
  }
}

/**
 * Determines if a work item should be reopened when a meeting is cancelled.
 *
 * @param workItemSignalType - The signal type of the work item
 * @returns Whether to reopen and reason
 */
export function shouldReopenOnCancel(workItemSignalType: string): {
  shouldReopen: boolean;
  reason: string;
} {
  const rule = SCHEDULER_RESOLUTION_RULES.find(
    (r) => r.work_item_signal_type === workItemSignalType
  );

  if (!rule) {
    return {
      shouldReopen: false,
      reason: `No scheduler resolution rule for signal type: ${workItemSignalType}`,
    };
  }

  return {
    shouldReopen: rule.reopen_on_cancel,
    reason: rule.reopen_on_cancel
      ? `Reopening ${workItemSignalType} because meeting was cancelled`
      : `${workItemSignalType} does not require reopening on cancellation`,
  };
}

// ============================================
// CONTEXT EXTRACTION
// ============================================

/**
 * Context extracted from a work item to prefill scheduler
 */
export interface SchedulerPrefillContext {
  companyId: string;
  companyName: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  dealId?: string;
  suggestedMeetingType: MeetingType;
  suggestedDuration: number;
  context: string;
  triggerCommunicationId?: string;
}

/**
 * Maps work item signal types to appropriate meeting types.
 */
const SIGNAL_TO_MEETING_TYPE: Record<string, MeetingType> = {
  message_needs_reply: 'follow_up',
  follow_up_due: 'follow_up',
  meeting_scheduled: 'discovery',
  deal_stalled: 'check_in',
  churn_risk: 'check_in',
  opportunity_detected: 'discovery',
  trial_ending: 'follow_up',
  demo_requested: 'demo',
  technical_question: 'technical',
  pricing_inquiry: 'pricing_negotiation',
  executive_interest: 'executive_briefing',
};

/**
 * Maps work item signal types to suggested meeting durations.
 */
const SIGNAL_TO_DURATION: Record<string, number> = {
  message_needs_reply: 30,
  follow_up_due: 30,
  meeting_scheduled: 45,
  deal_stalled: 30,
  churn_risk: 30,
  opportunity_detected: 45,
  trial_ending: 30,
  demo_requested: 60,
  technical_question: 45,
  pricing_inquiry: 30,
  executive_interest: 30,
};

/**
 * Extracts scheduler prefill context from a work item.
 *
 * @param workItem - The work item to extract context from
 * @param linkedCommunication - Optional linked communication for additional context
 * @returns Prefill context for the scheduler modal
 */
export function extractSchedulerContext(
  workItem: {
    id: string;
    company_id: string;
    company_name: string;
    signal_type: string;
    title: string;
    subtitle?: string;
    why_here?: string;
    metadata?: Record<string, unknown>;
  },
  linkedCommunication?: {
    id: string;
    contact_name?: string;
    contact_email?: string;
    contact_id?: string;
    subject?: string;
    body_preview?: string;
  }
): SchedulerPrefillContext {
  // Determine meeting type from signal
  const suggestedMeetingType =
    SIGNAL_TO_MEETING_TYPE[workItem.signal_type] || 'follow_up';

  // Determine duration from signal
  const suggestedDuration = SIGNAL_TO_DURATION[workItem.signal_type] || 30;

  // Build context string from work item
  const contextParts: string[] = [];

  if (workItem.why_here) {
    contextParts.push(`Reason: ${workItem.why_here}`);
  }

  if (workItem.title) {
    contextParts.push(`Context: ${workItem.title}`);
  }

  if (workItem.subtitle) {
    contextParts.push(workItem.subtitle);
  }

  // Add communication context if available
  if (linkedCommunication?.subject) {
    contextParts.push(`Recent email: "${linkedCommunication.subject}"`);
  }

  if (linkedCommunication?.body_preview) {
    contextParts.push(`Preview: ${linkedCommunication.body_preview.slice(0, 200)}...`);
  }

  // Extract contact info from metadata or linked communication
  const contactId =
    linkedCommunication?.contact_id ||
    (workItem.metadata?.contact_id as string | undefined);
  const contactName =
    linkedCommunication?.contact_name ||
    (workItem.metadata?.contact_name as string | undefined);
  const contactEmail =
    linkedCommunication?.contact_email ||
    (workItem.metadata?.contact_email as string | undefined);

  // Extract deal ID if present
  const dealId = workItem.metadata?.deal_id as string | undefined;

  return {
    companyId: workItem.company_id,
    companyName: workItem.company_name,
    contactId,
    contactName,
    contactEmail,
    dealId,
    suggestedMeetingType,
    suggestedDuration,
    context: contextParts.join('\n'),
    triggerCommunicationId: linkedCommunication?.id,
  };
}
