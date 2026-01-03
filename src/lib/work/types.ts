/**
 * Work Queue Types
 *
 * Queue items are entry points into customer context, not just tickets.
 * Each queue is associated with a lens and opens the CustomerHub to
 * the appropriate tab for that workflow.
 */

import { LensType } from '@/lib/lens/types';
import { CustomerHubTab } from '@/components/customerHub/types';

// ============================================================================
// ACTION VERBS - Controlled vocabulary for work items
// ============================================================================

export type ActionVerb = 'Reply' | 'Schedule' | 'Review' | 'Follow up' | 'Prepare' | 'Approve' | 'Escalate';

export const ACTION_VERB_STYLES: Record<ActionVerb, { bg: string; text: string; border: string }> = {
  'Reply': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  'Schedule': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  'Review': { bg: '#f3e8ff', text: '#6b21a8', border: '#c4b5fd' },
  'Follow up': { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  'Prepare': { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  'Approve': { bg: '#cffafe', text: '#155e75', border: '#67e8f9' },
  'Escalate': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
};

/**
 * Context for determining action verb from item content
 */
export interface ActionVerbContext {
  urgency_reason?: string | null;
  description?: string | null;
  title?: string | null;
  subtitle?: string | null;
}

/**
 * Determine the action verb based on item content and context
 */
export function getActionVerb(
  actionType: string | null,
  queueId: QueueId,
  item?: ActionVerbContext
): ActionVerb {
  // First, try to infer from the item's text content
  if (item) {
    const text = [
      item.urgency_reason || '',
      item.description || '',
      item.title || '',
      item.subtitle || ''
    ].join(' ').toLowerCase();

    // Schedule - meeting/call scheduling requests
    if (text.includes('reschedule') || text.includes('schedule') || text.includes('book a') ||
        text.includes('set up a meeting') || text.includes('find a time') || text.includes('availability')) {
      return 'Schedule';
    }

    // Reply - direct questions or requests needing response
    if (text.includes('asking') || text.includes('question') || text.includes('respond') ||
        text.includes('requested') || text.includes('wants to know') || text.includes('next steps') ||
        text.includes('high buying intent') || text.includes('needs reply') || text.includes('awaiting') ||
        text.includes('proposal') || text.includes('pricing') || text.includes('quote')) {
      return 'Reply';
    }

    // Follow up - outreach that needs continuation
    if (text.includes('follow up') || text.includes('follow-up') || text.includes('no response') ||
        text.includes('check in') || text.includes("haven't heard") || text.includes('no movement') ||
        text.includes('stalled') || text.includes('quiet') || text.includes('inactive') ||
        text.includes('re-engage') || text.includes('touch base')) {
      return 'Follow up';
    }

    // Prepare - upcoming meetings/calls
    if (text.includes('prepare') || text.includes('upcoming call') || text.includes('meeting tomorrow') ||
        text.includes('scheduled for') || text.includes('prep for') || text.includes('brief for')) {
      return 'Prepare';
    }

    // Escalate - risk signals
    if (text.includes('escalate') || text.includes('urgent') || text.includes('at risk') ||
        text.includes('churn') || text.includes('cancel') || text.includes('frustrated') ||
        text.includes('unhappy') || text.includes('issue') || text.includes('problem') ||
        text.includes('complaint')) {
      return 'Escalate';
    }

    // Approve - expansion/upsell opportunities
    if (text.includes('upsell') || text.includes('expand') || text.includes('upgrade') ||
        text.includes('additional') || text.includes('renewal') || text.includes('growth') ||
        text.includes('more licenses') || text.includes('add users')) {
      return 'Approve';
    }
  }

  // Fall back to action_type based logic
  if (actionType) {
    if (['email_respond', 'respond', 'reply', 'needs_reply'].includes(actionType)) return 'Reply';
    if (['schedule', 'book_meeting', 'calendar', 'scheduling'].includes(actionType)) return 'Schedule';
    if (['prepare', 'meeting_prep', 'call_with_prep', 'research'].includes(actionType)) return 'Prepare';
    if (['follow_up', 'meeting_follow_up', 'call', 'check_in', 'followup'].includes(actionType)) return 'Follow up';
    if (['escalate', 'urgent', 'sla_breach', 'at_risk'].includes(actionType)) return 'Escalate';
    if (['upsell', 'expand', 'renewal', 'approve', 'expansion'].includes(actionType)) return 'Approve';
  }

  // Fall back to queue-based logic
  if (['needs_response', 'unresolved_issues'].includes(queueId)) return 'Reply';
  if (['scheduling'].includes(queueId)) return 'Schedule';
  if (['meeting_prep'].includes(queueId)) return 'Prepare';
  if (['follow_ups', 'stalled_deals'].includes(queueId)) return 'Follow up';
  if (['sla_breaches', 'high_severity', 'at_risk'].includes(queueId)) return 'Escalate';
  if (['expansion_ready'].includes(queueId)) return 'Approve';

  return 'Review';
}

// Queue identifiers grouped by lens
export type CSQueue = 'at_risk' | 'expansion_ready' | 'unresolved_issues';
export type SalesQueue = 'follow_ups' | 'stalled_deals' | 'new_leads' | 'needs_response' | 'scheduling';
export type OnboardingQueue = 'blocked' | 'due_this_week' | 'new_kickoffs';
export type SupportQueue = 'sla_breaches' | 'high_severity' | 'unassigned';
export type UniversalQueue = 'action_now' | 'meeting_prep';

export type QueueId = CSQueue | SalesQueue | OnboardingQueue | SupportQueue | UniversalQueue;

export interface QueueConfig {
  id: QueueId;
  name: string;
  description: string;
  lens: LensType;
  defaultTab: CustomerHubTab;
  icon: string;
  color: string;
  bgColor: string;
  priority: number; // Lower = higher priority in list
}

export interface QueueItem {
  id: string;
  company_id: string;
  company_name: string;
  company_domain: string | null;
  queue_id: QueueId;

  // Display
  title: string;
  subtitle: string | null;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  urgency_reason: string | null;

  // Action-oriented display (new card format)
  action_verb: ActionVerb;
  thread_count: number;
  waiting_time: string | null;  // "2 days", "4 hours", etc.
  contact_name: string | null;
  stage: string | null;

  // Scoring (for prioritization)
  priority_score: number;
  days_in_queue: number;

  // Context
  mrr: number | null;
  health_score: number | null;
  owner_name: string | null;

  // Source tracking
  source_type: 'company_product' | 'support_case' | 'communication' | 'derived';
  source_id: string | null;

  // Timestamps
  created_at: string;
  last_activity_at: string | null;

  // Metadata for specific queue types
  metadata: Record<string, unknown>;
}

export interface QueueStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface QueueResult {
  queue: QueueConfig;
  items: QueueItem[];
  stats: QueueStats;
  hasMore: boolean;
}

export interface WorkQueueState {
  selectedQueue: QueueId | null;
  selectedCompanyId: string | null;
  queues: Map<QueueId, QueueResult>;
  loading: boolean;
  error: string | null;
}

// Queue configuration by lens
export const QUEUE_CONFIGS: QueueConfig[] = [
  // Universal Queue - appears in all lenses
  {
    id: 'action_now',
    name: 'Action Now',
    description: 'Items needing immediate attention from Daily Driver',
    lens: 'sales', // Will be shown in all lenses via getQueuesForLens
    defaultTab: 'overview',
    icon: 'Zap',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    priority: 0, // Always first
  },
  {
    id: 'meeting_prep',
    name: 'Meeting Prep',
    description: 'Upcoming meetings requiring preparation',
    lens: 'sales', // Will be shown in all lenses via getQueuesForLens
    defaultTab: 'overview',
    icon: 'Calendar',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    priority: 0.5, // Right after action_now
  },

  // Customer Success Queues
  {
    id: 'at_risk',
    name: 'At Risk',
    description: 'Customers showing signs of churn risk',
    lens: 'customer_success',
    defaultTab: 'engagement',
    icon: 'AlertTriangle',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    priority: 1,
  },
  {
    id: 'expansion_ready',
    name: 'Expansion Ready',
    description: 'Customers with upsell/cross-sell opportunities',
    lens: 'customer_success',
    defaultTab: 'overview',
    icon: 'TrendingUp',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    priority: 2,
  },
  {
    id: 'unresolved_issues',
    name: 'Unresolved Issues',
    description: 'Customers with open support cases',
    lens: 'customer_success',
    defaultTab: 'support',
    icon: 'Ticket',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    priority: 3,
  },

  // Sales Queues
  {
    id: 'needs_response',
    name: 'Needs Response',
    description: 'Emails and messages requiring reply',
    lens: 'sales',
    defaultTab: 'conversations',
    icon: 'MessageSquare',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    priority: 1,
  },
  {
    id: 'follow_ups',
    name: 'Follow-ups',
    description: 'Follow-up actions from meetings and calls',
    lens: 'sales',
    defaultTab: 'sales',
    icon: 'Clock',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    priority: 2,
  },
  {
    id: 'new_leads',
    name: 'New Leads',
    description: 'New opportunities to research and qualify',
    lens: 'sales',
    defaultTab: 'sales',
    icon: 'Sparkles',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    priority: 3,
  },
  {
    id: 'scheduling',
    name: 'Scheduling',
    description: 'Meetings and calls to schedule',
    lens: 'sales',
    defaultTab: 'sales',
    icon: 'CalendarPlus',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    priority: 4,
  },
  {
    id: 'stalled_deals',
    name: 'Stalled',
    description: 'Deals with no activity in 7+ days',
    lens: 'sales',
    defaultTab: 'sales',
    icon: 'PauseCircle',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    priority: 5,
  },

  // Onboarding Queues
  {
    id: 'blocked',
    name: 'Blocked',
    description: 'Onboardings waiting on blockers',
    lens: 'onboarding',
    defaultTab: 'onboarding',
    icon: 'XCircle',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    priority: 1,
  },
  {
    id: 'due_this_week',
    name: 'Due This Week',
    description: 'Go-lives scheduled this week',
    lens: 'onboarding',
    defaultTab: 'onboarding',
    icon: 'Calendar',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    priority: 2,
  },
  {
    id: 'new_kickoffs',
    name: 'New Kickoffs',
    description: 'Recently started onboardings',
    lens: 'onboarding',
    defaultTab: 'onboarding',
    icon: 'Rocket',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    priority: 3,
  },

  // Support Queues
  {
    id: 'sla_breaches',
    name: 'SLA Breaches',
    description: 'Cases that have breached SLA',
    lens: 'support',
    defaultTab: 'support',
    icon: 'AlertCircle',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    priority: 1,
  },
  {
    id: 'high_severity',
    name: 'High Severity',
    description: 'Critical and urgent cases',
    lens: 'support',
    defaultTab: 'support',
    icon: 'Flame',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    priority: 2,
  },
  {
    id: 'unassigned',
    name: 'Unassigned',
    description: 'Cases without an owner',
    lens: 'support',
    defaultTab: 'support',
    icon: 'UserX',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    priority: 3,
  },
];

// Helper to get queues for a specific lens
export function getQueuesForLens(lens: LensType): QueueConfig[] {
  // For 'focus' lens, return ALL queues
  if (lens === 'focus') {
    return [...QUEUE_CONFIGS].sort((a, b) => a.priority - b.priority);
  }

  // Always include universal queues (action_now, meeting_prep), plus queues specific to this lens
  const universalQueueIds = ['action_now', 'meeting_prep'];
  const universalQueues = QUEUE_CONFIGS.filter(q => universalQueueIds.includes(q.id));
  const lensQueues = QUEUE_CONFIGS.filter(q => q.lens === lens && !universalQueueIds.includes(q.id));

  const queues = [...universalQueues, ...lensQueues];
  return queues.sort((a, b) => a.priority - b.priority);
}

// Helper to get queue config by ID
export function getQueueConfig(queueId: QueueId): QueueConfig | undefined {
  return QUEUE_CONFIGS.find(q => q.id === queueId);
}

// Helper to get the default queue for a lens
export function getDefaultQueue(lens: LensType): QueueConfig | undefined {
  const queues = getQueuesForLens(lens);
  return queues[0];
}
