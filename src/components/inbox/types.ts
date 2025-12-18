// Inbox types for conversation-centric email

export type ConversationStatus = 'active' | 'pending' | 'awaiting_response' | 'snoozed' | 'archived' | 'ignored';
export type ConversationPriority = 'urgent' | 'high' | 'normal' | 'low';
export type ActionQueue = 'respond' | 'follow_up' | 'review' | 'drafts' | 'fyi';
export type DraftStatus = 'pending' | 'approved' | 'sent' | 'discarded';

export interface EmailParticipant {
  address: string;
  name?: string;
}

export interface EmailMessage {
  id: string;
  conversation_id: string;
  outlook_message_id: string;
  subject: string;
  body_preview: string;
  body_html?: string;
  from_address: string;
  from_name?: string;
  to_addresses: EmailParticipant[];
  cc_addresses?: EmailParticipant[];
  received_at: string;
  is_from_us: boolean;
  is_read: boolean;
  has_attachments: boolean;
}

export interface Conversation {
  id: string;
  user_id: string;
  thread_id: string;
  subject: string;
  participants: EmailParticipant[];
  last_message_at: string;
  last_external_at?: string;
  message_count: number;
  status: ConversationStatus;
  priority?: ConversationPriority;
  action_queue?: ActionQueue;
  snoozed_until?: string;
  snooze_reason?: string;
  deal_id?: string;
  company_id?: string;
  contact_id?: string;
  link_confidence?: number;
  sla_deadline?: string;
  sla_status?: 'ok' | 'warning' | 'overdue';
  ai_summary?: string;
  ai_signals?: string[];
  has_pending_draft?: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  messages?: EmailMessage[];
  deal?: {
    id: string;
    name: string;
    stage: string;
  };
  company?: {
    id: string;
    name: string;
  };
  contact?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface EmailDraft {
  id: string;
  conversation_id: string;
  body_html: string;
  body_text: string;
  generation_type: 'auto' | 'manual';
  status: DraftStatus;
  confidence_score?: number;
  created_at: string;
  updated_at: string;
}

export interface ActionQueueCounts {
  respond: number;
  follow_up: number;
  review: number;
  drafts: number;
  fyi: number;
}

export interface InboxFilters {
  queue?: ActionQueue;
  status?: ConversationStatus;
  dealId?: string;
  companyId?: string;
  search?: string;
}

export interface SnoozeOption {
  label: string;
  value: Date;
  reason?: string;
}

export function getSnoozeOptions(): SnoozeOption[] {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(9, 0, 0, 0);

  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setHours(9, 0, 0, 0);

  return [
    { label: 'Tomorrow morning', value: tomorrow },
    { label: 'Next week', value: nextWeek },
    { label: 'Next month', value: nextMonth },
  ];
}

export function formatConversationTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export function getSlaStatusColor(status?: string): string {
  switch (status) {
    case 'overdue':
      return 'text-red-600';
    case 'warning':
      return 'text-amber-600';
    default:
      return 'text-gray-400';
  }
}

export function getPriorityColor(priority?: string): string {
  switch (priority) {
    case 'urgent':
      return 'text-red-600 bg-red-50';
    case 'high':
      return 'text-orange-600 bg-orange-50';
    case 'normal':
      return 'text-blue-600 bg-blue-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}
