/**
 * Communication Event Types
 *
 * All lifecycle writes for communications are events only.
 * These events form the canonical Communication stream.
 * No keyword matching for intelligence - use playbooks and analysis.
 */

import { LifecycleEvent, ActorType } from '@/types/eventSourcing';

// ============================================================================
// COMMUNICATION TYPES
// ============================================================================

export type CommunicationChannel = 'email' | 'call' | 'meeting' | 'sms';
export type CommunicationDirection = 'inbound' | 'outbound';
export type CommunicationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

// Analysis is done via playbooks, not keyword matching
export type CommunicationIntentType =
  | 'inquiry'           // Asking for information
  | 'scheduling'        // Meeting/call scheduling
  | 'negotiation'       // Price/terms discussion
  | 'objection'         // Concern or pushback
  | 'commitment'        // Promise or agreement
  | 'follow_up'         // Following up on previous
  | 'closing'           // Moving toward close
  | 'support'           // Support/help request
  | 'feedback'          // Sharing experience
  | 'referral'          // Introducing someone
  | 'other';

export type CommunicationUrgency = 'immediate' | 'today' | 'this_week' | 'no_rush';

// ============================================================================
// COMMUNICATION EVENTS
// ============================================================================

/**
 * CommunicationThreadIngested - A new thread/conversation started
 */
export interface CommunicationThreadIngestedEvent extends LifecycleEvent<'CommunicationThreadIngested'> {
  event_data: {
    thread_id: string;
    company_id: string | null;
    contact_id: string | null;
    channel: CommunicationChannel;
    subject: string | null;
    participants: Array<{
      email?: string;
      name?: string;
      role: 'us' | 'them';
    }>;
    first_message_id: string;
    source: 'email_sync' | 'manual' | 'calendar_sync' | 'sms_webhook';
  };
}

/**
 * CommunicationMessageReceived - An inbound message was received
 */
export interface CommunicationMessageReceivedEvent extends LifecycleEvent<'CommunicationMessageReceived'> {
  event_data: {
    message_id: string;
    thread_id: string;
    communication_id: string;  // Our internal communication record ID
    company_id: string | null;
    contact_id: string | null;
    channel: CommunicationChannel;
    subject: string | null;
    content_preview: string | null;
    from_email: string | null;
    from_name: string | null;
    received_at: string;
    // Playbook-based classification (not keyword matching)
    requires_response: boolean;
    response_deadline: string | null;  // ISO date if urgent
  };
}

/**
 * CommunicationMessageSent - An outbound message was sent (by human or AI)
 */
export interface CommunicationMessageSentEvent extends LifecycleEvent<'CommunicationMessageSent'> {
  event_data: {
    message_id: string;
    thread_id: string;
    communication_id: string;
    company_id: string | null;
    contact_id: string | null;
    channel: CommunicationChannel;
    subject: string | null;
    content_preview: string | null;
    to_email: string | null;
    sent_at: string;
    sent_by: 'human' | 'ai';
    ai_action_type: string | null;  // e.g., 'follow_up', 'scheduling'
  };
}

/**
 * CommunicationReplySent - A reply was sent in response to a message
 * This is the key event that can resolve WorkItems
 */
export interface CommunicationReplySentEvent extends LifecycleEvent<'CommunicationReplySent'> {
  event_data: {
    reply_message_id: string;
    in_reply_to_message_id: string;
    in_reply_to_communication_id: string;
    thread_id: string;
    communication_id: string;  // The new reply's communication record
    company_id: string | null;
    contact_id: string | null;
    channel: CommunicationChannel;
    subject: string | null;
    content_preview: string | null;
    to_email: string | null;
    sent_at: string;
    sent_by: 'human' | 'ai';
    // Resolution tracking
    resolves_work_item_id: string | null;
    resolution_type: 'replied' | 'scheduled_meeting' | 'forwarded' | null;
  };
}

/**
 * CommunicationAnalysisGenerated - AI analysis completed (playbook-based, not keywords)
 */
export interface CommunicationAnalysisGeneratedEvent extends LifecycleEvent<'CommunicationAnalysisGenerated'> {
  event_data: {
    analysis_id: string;
    communication_id: string;
    message_id: string | null;
    // Playbook-based classification
    intent_type: CommunicationIntentType;
    intent_confidence: number;  // 0-1
    urgency: CommunicationUrgency;
    // Structured extraction
    summary: string;
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    sentiment_score: number;  // -1 to 1
    // Extracted entities (from playbook rules, not keywords)
    extracted_signals: Array<{
      signal_type: string;
      confidence: number;
      details: string | null;
    }>;
    extracted_commitments_us: Array<{
      commitment: string;
      due_date: string | null;
    }>;
    extracted_commitments_them: Array<{
      commitment: string;
      due_date: string | null;
    }>;
    next_steps: string[];
    products_discussed: string[];
    // Playbook reference
    playbook_id: string | null;
    playbook_version: number | null;
  };
}

/**
 * CommunicationMarkedResponded - Communication marked as responded to
 */
export interface CommunicationMarkedRespondedEvent extends LifecycleEvent<'CommunicationMarkedResponded'> {
  event_data: {
    communication_id: string;
    responded_at: string;
    responded_by: 'human' | 'ai' | 'system';
    response_communication_id: string | null;  // Link to the reply
    resolution_notes: string | null;
  };
}

// Union of all communication events
export type CommunicationEvent =
  | CommunicationThreadIngestedEvent
  | CommunicationMessageReceivedEvent
  | CommunicationMessageSentEvent
  | CommunicationReplySentEvent
  | CommunicationAnalysisGeneratedEvent
  | CommunicationMarkedRespondedEvent;

// ============================================================================
// EVENT CREATION HELPERS
// ============================================================================

export interface CreateReplyInput {
  in_reply_to_communication_id: string;
  in_reply_to_message_id?: string;
  thread_id: string;
  company_id: string | null;
  contact_id: string | null;
  channel: CommunicationChannel;
  subject: string | null;
  content: string;
  to_email: string;
  sent_by: 'human' | 'ai';
  resolves_work_item_id?: string;
}

export interface AnalysisInput {
  communication_id: string;
  message_id?: string;
  playbook_id?: string;
}

// ============================================================================
// RESOLUTION RULES
// ============================================================================

/**
 * Deterministic rules for when a reply resolves a work item.
 * These are testable and don't use AI for the decision.
 */
export interface ReplyResolutionRule {
  work_item_signal_type: string;
  resolves_when: 'any_reply' | 'reply_to_trigger' | 'scheduled_meeting' | 'manual';
  description: string;
}

export const REPLY_RESOLUTION_RULES: ReplyResolutionRule[] = [
  {
    work_item_signal_type: 'message_needs_reply',
    resolves_when: 'reply_to_trigger',
    description: 'Resolved when we reply to the message that triggered the work item',
  },
  {
    work_item_signal_type: 'follow_up_due',
    resolves_when: 'any_reply',
    description: 'Resolved when we send any communication to the company',
  },
  {
    work_item_signal_type: 'meeting_scheduled',
    resolves_when: 'scheduled_meeting',
    description: 'Resolved when a meeting is successfully scheduled',
  },
  {
    work_item_signal_type: 'promise_at_risk',
    resolves_when: 'any_reply',
    description: 'Resolved when we communicate with the customer about the promise',
  },
];

/**
 * Check if a reply should resolve a work item based on deterministic rules.
 * This is the core resolution logic - must be testable and consistent.
 */
export function shouldReplyResolveWorkItem(
  workItemSignalType: string,
  replyTargetCommunicationId: string,
  workItemTriggerCommunicationId: string | null,
  isSchedulingReply: boolean
): { resolves: boolean; reason: string } {
  const rule = REPLY_RESOLUTION_RULES.find(r => r.work_item_signal_type === workItemSignalType);

  if (!rule) {
    return { resolves: false, reason: 'No resolution rule for this signal type' };
  }

  switch (rule.resolves_when) {
    case 'any_reply':
      return { resolves: true, reason: rule.description };

    case 'reply_to_trigger':
      if (replyTargetCommunicationId === workItemTriggerCommunicationId) {
        return { resolves: true, reason: rule.description };
      }
      return { resolves: false, reason: 'Reply was not to the triggering message' };

    case 'scheduled_meeting':
      if (isSchedulingReply) {
        return { resolves: true, reason: rule.description };
      }
      return { resolves: false, reason: 'Reply did not schedule a meeting' };

    case 'manual':
      return { resolves: false, reason: 'This work item requires manual resolution' };

    default:
      return { resolves: false, reason: 'Unknown resolution rule' };
  }
}
