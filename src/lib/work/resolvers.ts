/**
 * Work Item Resolver CTA Mapping
 *
 * Determines the primary action (resolver CTA) for each work item
 * based on its source type, signal type, and context.
 *
 * Resolver selection follows a priority chain:
 * 1. Signal-specific resolver (if defined)
 * 2. Source-type resolver (fallback)
 * 3. Generic resolver (last resort)
 */

import {
  WorkItemSourceType,
  WorkItemSignalType,
} from './events';
import { WorkItemDetailProjection } from './projections';

// ============================================================================
// RESOLVER TYPES
// ============================================================================

export type ResolverAction =
  | 'reply_email'           // Open email reply composer
  | 'schedule_meeting'      // Open scheduler
  | 'make_call'             // Initiate call
  | 'send_message'          // Open messaging
  | 'update_deal_stage'     // Move deal to next stage
  | 'close_case'            // Close support case
  | 'escalate_case'         // Escalate support case
  | 'reassign'              // Reassign to another user
  | 'add_note'              // Add context note
  | 'create_task'           // Create follow-up task
  | 'open_customer_hub'     // View customer in full context
  | 'acknowledge'           // Just acknowledge/snooze
  | 'complete_onboarding_step'  // Mark onboarding milestone
  | 'request_commitment'    // Ask for commitment
  | 'send_renewal_proposal' // Send renewal
  | 'send_expansion_proposal'; // Send upsell proposal

export interface ResolverCTA {
  action: ResolverAction;
  label: string;
  shortLabel: string;
  icon: string;
  variant: 'primary' | 'secondary' | 'destructive' | 'outline';
  requiresConfirm?: boolean;
  opensModal?: boolean;
}

export interface ResolverConfig {
  primary: ResolverCTA;
  secondary?: ResolverCTA[];
  quickActions?: ResolverCTA[];
}

// ============================================================================
// CTA DEFINITIONS
// ============================================================================

const CTAs: Record<ResolverAction, ResolverCTA> = {
  reply_email: {
    action: 'reply_email',
    label: 'Reply to Email',
    shortLabel: 'Reply',
    icon: 'Reply',
    variant: 'primary',
    opensModal: true,
  },
  schedule_meeting: {
    action: 'schedule_meeting',
    label: 'Schedule Meeting',
    shortLabel: 'Schedule',
    icon: 'Calendar',
    variant: 'primary',
    opensModal: true,
  },
  make_call: {
    action: 'make_call',
    label: 'Make Call',
    shortLabel: 'Call',
    icon: 'Phone',
    variant: 'primary',
  },
  send_message: {
    action: 'send_message',
    label: 'Send Message',
    shortLabel: 'Message',
    icon: 'MessageSquare',
    variant: 'primary',
    opensModal: true,
  },
  update_deal_stage: {
    action: 'update_deal_stage',
    label: 'Update Deal Stage',
    shortLabel: 'Update Stage',
    icon: 'ArrowRight',
    variant: 'primary',
    opensModal: true,
  },
  close_case: {
    action: 'close_case',
    label: 'Close Case',
    shortLabel: 'Close',
    icon: 'CheckCircle',
    variant: 'primary',
    requiresConfirm: true,
  },
  escalate_case: {
    action: 'escalate_case',
    label: 'Escalate Case',
    shortLabel: 'Escalate',
    icon: 'AlertTriangle',
    variant: 'destructive',
    requiresConfirm: true,
  },
  reassign: {
    action: 'reassign',
    label: 'Reassign',
    shortLabel: 'Reassign',
    icon: 'UserPlus',
    variant: 'outline',
    opensModal: true,
  },
  add_note: {
    action: 'add_note',
    label: 'Add Note',
    shortLabel: 'Note',
    icon: 'FileText',
    variant: 'outline',
    opensModal: true,
  },
  create_task: {
    action: 'create_task',
    label: 'Create Task',
    shortLabel: 'Task',
    icon: 'ListTodo',
    variant: 'outline',
    opensModal: true,
  },
  open_customer_hub: {
    action: 'open_customer_hub',
    label: 'View Customer',
    shortLabel: 'View',
    icon: 'ExternalLink',
    variant: 'outline',
  },
  acknowledge: {
    action: 'acknowledge',
    label: 'Acknowledge',
    shortLabel: 'Ack',
    icon: 'Check',
    variant: 'secondary',
  },
  complete_onboarding_step: {
    action: 'complete_onboarding_step',
    label: 'Complete Step',
    shortLabel: 'Complete',
    icon: 'CheckSquare',
    variant: 'primary',
    requiresConfirm: true,
  },
  request_commitment: {
    action: 'request_commitment',
    label: 'Request Commitment',
    shortLabel: 'Commit',
    icon: 'Target',
    variant: 'primary',
    opensModal: true,
  },
  send_renewal_proposal: {
    action: 'send_renewal_proposal',
    label: 'Send Renewal',
    shortLabel: 'Renew',
    icon: 'RefreshCw',
    variant: 'primary',
    opensModal: true,
  },
  send_expansion_proposal: {
    action: 'send_expansion_proposal',
    label: 'Send Proposal',
    shortLabel: 'Propose',
    icon: 'TrendingUp',
    variant: 'primary',
    opensModal: true,
  },
};

// ============================================================================
// SIGNAL-SPECIFIC RESOLVERS
// ============================================================================

const SIGNAL_RESOLVERS: Partial<Record<WorkItemSignalType, ResolverConfig>> = {
  // Communication signals
  message_needs_reply: {
    primary: CTAs.reply_email,
    secondary: [CTAs.schedule_meeting, CTAs.make_call],
    quickActions: [CTAs.add_note, CTAs.acknowledge],
  },

  // Scheduler signals
  meeting_scheduled: {
    primary: CTAs.open_customer_hub,
    secondary: [CTAs.add_note],
    quickActions: [CTAs.acknowledge],
  },
  follow_up_due: {
    primary: CTAs.schedule_meeting,
    secondary: [CTAs.send_message, CTAs.make_call],
    quickActions: [CTAs.acknowledge],
  },

  // Command center signals
  promise_at_risk: {
    primary: CTAs.make_call,
    secondary: [CTAs.send_message, CTAs.schedule_meeting],
    quickActions: [CTAs.add_note, CTAs.reassign],
  },
  sla_breach: {
    primary: CTAs.escalate_case,
    secondary: [CTAs.close_case, CTAs.reassign],
    quickActions: [CTAs.add_note],
  },
  churn_risk: {
    primary: CTAs.schedule_meeting,
    secondary: [CTAs.send_message, CTAs.make_call],
    quickActions: [CTAs.add_note, CTAs.reassign],
  },
  expansion_ready: {
    primary: CTAs.send_expansion_proposal,
    secondary: [CTAs.schedule_meeting],
    quickActions: [CTAs.add_note],
  },

  // Lifecycle signals
  deal_stalled: {
    primary: CTAs.make_call,
    secondary: [CTAs.send_message, CTAs.update_deal_stage],
    quickActions: [CTAs.add_note, CTAs.reassign],
  },
  onboarding_blocked: {
    primary: CTAs.schedule_meeting,
    secondary: [CTAs.make_call, CTAs.send_message],
    quickActions: [CTAs.add_note, CTAs.reassign],
  },
  case_escalated: {
    primary: CTAs.make_call,
    secondary: [CTAs.send_message],
    quickActions: [CTAs.add_note, CTAs.reassign],
  },
  case_opened: {
    primary: CTAs.close_case,
    secondary: [CTAs.send_message],
    quickActions: [CTAs.add_note, CTAs.reassign],
  },
  milestone_due: {
    primary: CTAs.complete_onboarding_step,
    secondary: [CTAs.schedule_meeting],
    quickActions: [CTAs.add_note],
  },
};

// ============================================================================
// SOURCE-TYPE FALLBACK RESOLVERS
// ============================================================================

const SOURCE_TYPE_RESOLVERS: Record<WorkItemSourceType, ResolverConfig> = {
  communication: {
    primary: CTAs.reply_email,
    secondary: [CTAs.schedule_meeting],
    quickActions: [CTAs.add_note, CTAs.acknowledge],
  },
  scheduler: {
    primary: CTAs.schedule_meeting,
    secondary: [CTAs.send_message],
    quickActions: [CTAs.add_note, CTAs.acknowledge],
  },
  command_center: {
    primary: CTAs.open_customer_hub,
    secondary: [CTAs.schedule_meeting, CTAs.send_message],
    quickActions: [CTAs.add_note, CTAs.reassign],
  },
  lifecycle_stage: {
    primary: CTAs.update_deal_stage,
    secondary: [CTAs.schedule_meeting],
    quickActions: [CTAs.add_note, CTAs.reassign],
  },
};

// ============================================================================
// GENERIC FALLBACK
// ============================================================================

const GENERIC_RESOLVER: ResolverConfig = {
  primary: CTAs.open_customer_hub,
  secondary: [CTAs.schedule_meeting, CTAs.send_message],
  quickActions: [CTAs.add_note, CTAs.acknowledge],
};

// ============================================================================
// RESOLVER SELECTION
// ============================================================================

/**
 * Get resolver configuration for a work item
 */
export function getResolverConfig(workItem: WorkItemDetailProjection): ResolverConfig {
  // 1. Try signal-specific resolver
  const signalResolver = SIGNAL_RESOLVERS[workItem.signal_type];
  if (signalResolver) {
    return signalResolver;
  }

  // 2. Fall back to source-type resolver
  const sourceResolver = SOURCE_TYPE_RESOLVERS[workItem.source_type];
  if (sourceResolver) {
    return sourceResolver;
  }

  // 3. Generic fallback
  return GENERIC_RESOLVER;
}

/**
 * Get the primary CTA for a work item
 */
export function getPrimaryCTA(workItem: WorkItemDetailProjection): ResolverCTA {
  return getResolverConfig(workItem).primary;
}

/**
 * Get all available CTAs for a work item (primary + secondary + quick)
 */
export function getAllCTAs(workItem: WorkItemDetailProjection): {
  primary: ResolverCTA;
  secondary: ResolverCTA[];
  quickActions: ResolverCTA[];
} {
  const config = getResolverConfig(workItem);
  return {
    primary: config.primary,
    secondary: config.secondary || [],
    quickActions: config.quickActions || [],
  };
}

/**
 * Get CTA by action ID
 */
export function getCTA(action: ResolverAction): ResolverCTA {
  return CTAs[action];
}

// ============================================================================
// RESOLUTION HELPERS
// ============================================================================

/**
 * Map resolver action to resolution type for event emission
 */
export function actionToResolutionType(
  action: ResolverAction
): 'completed' | 'cancelled' | null {
  switch (action) {
    case 'reply_email':
    case 'make_call':
    case 'send_message':
    case 'close_case':
    case 'complete_onboarding_step':
    case 'send_renewal_proposal':
    case 'send_expansion_proposal':
    case 'request_commitment':
      return 'completed';
    case 'acknowledge':
      return 'completed';
    default:
      return null; // Action doesn't resolve the item
  }
}

/**
 * Check if an action resolves the work item
 */
export function actionResolvesItem(action: ResolverAction): boolean {
  return actionToResolutionType(action) !== null;
}

/**
 * Get the "resolved by" action string for event emission
 */
export function actionToResolvedBy(action: ResolverAction): string {
  const mapping: Record<ResolverAction, string> = {
    reply_email: 'replied',
    schedule_meeting: 'scheduled_meeting',
    make_call: 'called',
    send_message: 'messaged',
    update_deal_stage: 'updated_stage',
    close_case: 'closed_case',
    escalate_case: 'escalated',
    reassign: 'reassigned',
    add_note: 'noted',
    create_task: 'created_task',
    open_customer_hub: 'viewed',
    acknowledge: 'acknowledged',
    complete_onboarding_step: 'completed_step',
    request_commitment: 'requested_commitment',
    send_renewal_proposal: 'sent_renewal',
    send_expansion_proposal: 'sent_proposal',
  };

  return mapping[action];
}
