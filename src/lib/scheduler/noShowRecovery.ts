/**
 * No-Show Detection and Recovery
 *
 * Detects when scheduled meetings result in no-shows and
 * initiates appropriate recovery actions.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  SchedulingRequest,
  SCHEDULING_STATUS,
  ACTION_TYPES,
  MeetingType,
} from './types';
import { adminSchedulingService } from './schedulingService';
import { checkSchedulingLeverageMoments, saveSchedulingLeverageMoment } from './schedulingLeverage';

// ============================================
// TYPES
// ============================================

export interface NoShowEvent {
  scheduling_request_id: string;
  scheduled_time: string;
  detected_at: string;
  no_show_number: number; // 1st, 2nd, etc.
  recovery_strategy: RecoveryStrategy;
}

export type RecoveryStrategy =
  | 'auto_reschedule'
  | 'send_follow_up'
  | 'escalate_to_human'
  | 'pause_outreach'
  | 'mark_dead';

export interface NoShowRecoveryResult {
  scheduling_request_id: string;
  recovery_strategy: RecoveryStrategy;
  action_taken: string;
  next_action_at: string | null;
  leverage_moment_created: boolean;
}

// ============================================
// RECOVERY STRATEGY RULES
// ============================================

interface RecoveryRule {
  strategy: RecoveryStrategy;
  followUpMessage: string;
  waitHours: number;
}

const RECOVERY_RULES: Record<number, RecoveryRule> = {
  1: {
    strategy: 'send_follow_up',
    followUpMessage: 'no_show_first',
    waitHours: 4, // Wait 4 hours then send follow-up
  },
  2: {
    strategy: 'escalate_to_human',
    followUpMessage: 'no_show_second',
    waitHours: 24, // Human should call within 24 hours
  },
  3: {
    strategy: 'pause_outreach',
    followUpMessage: 'no_show_final',
    waitHours: 168, // Pause for a week
  },
};

const DEFAULT_RECOVERY: RecoveryRule = {
  strategy: 'mark_dead',
  followUpMessage: '',
  waitHours: 0,
};

// ============================================
// NO-SHOW DETECTION
// ============================================

/**
 * Check for no-shows on meetings that should have happened.
 * Call this periodically (e.g., every 15-30 minutes).
 */
export async function detectNoShows(): Promise<NoShowEvent[]> {
  const supabase = createAdminClient();
  const now = new Date();

  // Find confirmed meetings where:
  // 1. Scheduled time has passed (by at least 30 minutes to account for late starts)
  // 2. Status is still 'confirmed' or 'reminder_sent'
  // 3. No completion or no-show has been logged
  const cutoff = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

  const { data: potentialNoShows, error } = await supabase
    .from('scheduling_requests')
    .select(`
      id,
      scheduled_time,
      no_show_count,
      deal_id,
      company_id,
      meeting_type
    `)
    .in('status', [SCHEDULING_STATUS.CONFIRMED, SCHEDULING_STATUS.REMINDER_SENT])
    .lt('scheduled_time', cutoff.toISOString())
    .order('scheduled_time', { ascending: true })
    .limit(50);

  if (error || !potentialNoShows) {
    console.error('[NoShowRecovery] Failed to fetch potential no-shows:', error);
    return [];
  }

  const noShowEvents: NoShowEvent[] = [];

  for (const request of potentialNoShows) {
    // Check if we already detected this as a no-show
    const { data: existingNoShow } = await supabase
      .from('scheduling_actions')
      .select('id')
      .eq('scheduling_request_id', request.id)
      .eq('action_type', ACTION_TYPES.NO_SHOW_DETECTED)
      .gte('created_at', request.scheduled_time)
      .single();

    if (existingNoShow) {
      // Already detected
      continue;
    }

    // This is a new no-show
    const noShowNumber = (request.no_show_count || 0) + 1;
    const rule = RECOVERY_RULES[noShowNumber] || DEFAULT_RECOVERY;

    const event: NoShowEvent = {
      scheduling_request_id: request.id,
      scheduled_time: request.scheduled_time,
      detected_at: now.toISOString(),
      no_show_number: noShowNumber,
      recovery_strategy: rule.strategy,
    };

    noShowEvents.push(event);
  }

  return noShowEvents;
}

/**
 * Process a single no-show event.
 */
export async function processNoShow(
  event: NoShowEvent
): Promise<NoShowRecoveryResult> {
  const supabase = createAdminClient();
  const rule = RECOVERY_RULES[event.no_show_number] || DEFAULT_RECOVERY;

  // Log the no-show
  await adminSchedulingService.logAction(event.scheduling_request_id, {
    action_type: ACTION_TYPES.NO_SHOW_DETECTED,
    message_content: `No-show #${event.no_show_number} detected for meeting scheduled at ${event.scheduled_time}`,
    actor: 'ai',
    ai_reasoning: `Scheduled time passed without meeting confirmation. Recovery strategy: ${rule.strategy}`,
  });

  // Update no-show count
  await supabase
    .from('scheduling_requests')
    .update({
      no_show_count: event.no_show_number,
      status: rule.strategy === 'mark_dead'
        ? SCHEDULING_STATUS.PAUSED
        : SCHEDULING_STATUS.AWAITING_RESPONSE,
    })
    .eq('id', event.scheduling_request_id);

  let nextActionAt: string | null = null;
  let actionTaken = '';
  let leverageMomentCreated = false;

  switch (rule.strategy) {
    case 'send_follow_up':
      // Schedule a follow-up message
      nextActionAt = new Date(Date.now() + rule.waitHours * 60 * 60 * 1000).toISOString();

      await supabase
        .from('scheduling_requests')
        .update({
          next_action_type: 'send_no_show_follow_up',
          next_action_at: nextActionAt,
        })
        .eq('id', event.scheduling_request_id);

      actionTaken = `Scheduled follow-up for ${rule.waitHours} hours from now`;
      break;

    case 'escalate_to_human':
      // Create a leverage moment
      const moment = await checkSchedulingLeverageMoments(event.scheduling_request_id);
      if (moment) {
        await saveSchedulingLeverageMoment(moment);
        leverageMomentCreated = true;
      }

      nextActionAt = new Date(Date.now() + rule.waitHours * 60 * 60 * 1000).toISOString();

      await supabase
        .from('scheduling_requests')
        .update({
          next_action_type: 'human_intervention_needed',
          next_action_at: nextActionAt,
        })
        .eq('id', event.scheduling_request_id);

      actionTaken = 'Escalated to human - leverage moment created';
      break;

    case 'pause_outreach':
      // Pause and schedule a check-in later
      nextActionAt = new Date(Date.now() + rule.waitHours * 60 * 60 * 1000).toISOString();

      await supabase
        .from('scheduling_requests')
        .update({
          status: SCHEDULING_STATUS.PAUSED,
          next_action_type: 'check_reactivation',
          next_action_at: nextActionAt,
        })
        .eq('id', event.scheduling_request_id);

      actionTaken = `Paused outreach for ${Math.round(rule.waitHours / 24)} days`;
      break;

    case 'mark_dead':
      await supabase
        .from('scheduling_requests')
        .update({
          status: SCHEDULING_STATUS.CANCELLED,
          next_action_type: null,
          next_action_at: null,
        })
        .eq('id', event.scheduling_request_id);

      actionTaken = 'Marked as cancelled due to excessive no-shows';
      break;

    default:
      actionTaken = 'No action taken';
  }

  return {
    scheduling_request_id: event.scheduling_request_id,
    recovery_strategy: rule.strategy,
    action_taken: actionTaken,
    next_action_at: nextActionAt,
    leverage_moment_created: leverageMomentCreated,
  };
}

/**
 * Detect and process all no-shows.
 */
export async function processAllNoShows(): Promise<{
  detected: number;
  processed: number;
  results: NoShowRecoveryResult[];
}> {
  const events = await detectNoShows();

  if (events.length === 0) {
    return { detected: 0, processed: 0, results: [] };
  }

  const results: NoShowRecoveryResult[] = [];

  for (const event of events) {
    const result = await processNoShow(event);
    results.push(result);
  }

  return {
    detected: events.length,
    processed: results.length,
    results,
  };
}

// ============================================
// NO-SHOW FOLLOW-UP MESSAGES
// ============================================

export interface NoShowFollowUpTemplate {
  subject: string;
  body: string;
}

export function getNoShowFollowUpTemplate(
  noShowNumber: number,
  contactName: string,
  meetingType: MeetingType
): NoShowFollowUpTemplate {
  const meetingLabel = formatMeetingType(meetingType);

  switch (noShowNumber) {
    case 1:
      return {
        subject: `Missed you - quick reschedule?`,
        body: `Hi ${contactName},

I noticed we weren't able to connect for our scheduled ${meetingLabel} today. No worries – I know things come up!

Would you like to reschedule for later this week? I'm flexible on timing.

Just let me know what works for you.`,
      };

    case 2:
      return {
        subject: `Let's find a better time`,
        body: `Hi ${contactName},

We've had some trouble connecting for our ${meetingLabel}. I want to make sure we find a time that actually works for your schedule.

What's the best way to connect – should I give you a call to find a time, or would you prefer to pick a slot that works?

Looking forward to connecting.`,
      };

    case 3:
      return {
        subject: `Checking in`,
        body: `Hi ${contactName},

I wanted to check in since we haven't been able to connect. I understand things get busy, and I don't want to keep reaching out if timing isn't right.

Would it be helpful to reconnect in a few weeks instead? Just let me know and I'll reach out then.

Either way, I'm here when you're ready.`,
      };

    default:
      return {
        subject: `Let's reconnect when timing is better`,
        body: `Hi ${contactName},

I know we've had some trouble finding time to connect. Rather than keep reaching out, I'll pause for now.

If and when you'd like to discuss ${meetingLabel}, just reply to this email and we'll set something up.

Best regards.`,
      };
  }
}

function formatMeetingType(type: MeetingType): string {
  const labels: Record<MeetingType, string> = {
    discovery: 'discovery call',
    demo: 'demo',
    follow_up: 'follow-up call',
    technical: 'technical discussion',
    technical_deep_dive: 'technical deep dive',
    executive: 'executive briefing',
    executive_briefing: 'executive briefing',
    pricing_negotiation: 'pricing discussion',
    implementation_planning: 'implementation planning session',
    check_in: 'check-in call',
    trial_kickoff: 'trial kickoff',
    custom: 'meeting',
  };

  return labels[type] || 'meeting';
}

// ============================================
// MEETING COMPLETION CONFIRMATION
// ============================================

/**
 * Mark a meeting as completed (did happen).
 */
export async function markMeetingCompleted(
  schedulingRequestId: string,
  notes?: string
): Promise<void> {
  const supabase = createAdminClient();

  await adminSchedulingService.logAction(schedulingRequestId, {
    action_type: ACTION_TYPES.COMPLETED,
    message_content: notes || 'Meeting completed successfully',
    actor: 'user',
  });

  await supabase
    .from('scheduling_requests')
    .update({
      status: SCHEDULING_STATUS.COMPLETED,
      next_action_type: null,
      next_action_at: null,
    })
    .eq('id', schedulingRequestId);
}

/**
 * Mark a meeting as rescheduled (prospect requested new time).
 */
export async function markMeetingRescheduled(
  schedulingRequestId: string,
  reason?: string
): Promise<void> {
  const supabase = createAdminClient();

  await adminSchedulingService.logAction(schedulingRequestId, {
    action_type: ACTION_TYPES.RESCHEDULING_STARTED,
    message_content: reason || 'Meeting rescheduled by prospect',
    actor: 'prospect',
  });

  await supabase
    .from('scheduling_requests')
    .update({
      status: SCHEDULING_STATUS.NEGOTIATING,
      scheduled_time: null,
      next_action_type: 'propose_new_times',
      next_action_at: new Date().toISOString(),
    })
    .eq('id', schedulingRequestId);
}
