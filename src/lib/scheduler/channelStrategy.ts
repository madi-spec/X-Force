/**
 * Channel Strategy Engine
 *
 * Handles multi-channel progression (email → SMS) and de-escalation
 * (60min → 30min → 15min) when struggling to schedule meetings.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { adminSchedulingService } from './schedulingService';
import {
  sendSchedulingSms,
  generateInitialSms,
  generateFollowUpSms,
  generateDeEscalationSms,
  extractPhoneFromContact,
  type SmsTemplateContext,
} from '@/lib/sms';
import {
  SchedulingRequest,
  CommunicationChannel,
  COMMUNICATION_CHANNELS,
  ChannelProgression,
  DeEscalationState,
  MeetingType,
  MEETING_TYPES,
  ACTION_TYPES,
  DURATION_TIERS,
} from './types';

// ============================================
// CHANNEL PROGRESSION RULES
// ============================================

interface ChannelRule {
  channel: CommunicationChannel;
  maxAttempts: number;
  waitHoursBeforeEscalate: number;
}

// Default progression: email (3 attempts) → SMS (2 attempts)
const DEFAULT_CHANNEL_PROGRESSION: ChannelRule[] = [
  { channel: COMMUNICATION_CHANNELS.EMAIL, maxAttempts: 3, waitHoursBeforeEscalate: 72 },
  { channel: COMMUNICATION_CHANNELS.SMS, maxAttempts: 2, waitHoursBeforeEscalate: 48 },
];

// Meeting-type specific progressions
const MEETING_TYPE_PROGRESSIONS: Record<MeetingType, ChannelRule[]> = {
  [MEETING_TYPES.DISCOVERY]: [
    { channel: COMMUNICATION_CHANNELS.EMAIL, maxAttempts: 2, waitHoursBeforeEscalate: 48 },
    { channel: COMMUNICATION_CHANNELS.SMS, maxAttempts: 2, waitHoursBeforeEscalate: 48 },
  ],
  [MEETING_TYPES.DEMO]: [
    { channel: COMMUNICATION_CHANNELS.EMAIL, maxAttempts: 3, waitHoursBeforeEscalate: 72 },
    { channel: COMMUNICATION_CHANNELS.SMS, maxAttempts: 2, waitHoursBeforeEscalate: 48 },
  ],
  [MEETING_TYPES.FOLLOW_UP]: [
    { channel: COMMUNICATION_CHANNELS.EMAIL, maxAttempts: 2, waitHoursBeforeEscalate: 24 },
    { channel: COMMUNICATION_CHANNELS.SMS, maxAttempts: 1, waitHoursBeforeEscalate: 24 },
  ],
  [MEETING_TYPES.TECHNICAL]: DEFAULT_CHANNEL_PROGRESSION,
  [MEETING_TYPES.TECHNICAL_DEEP_DIVE]: DEFAULT_CHANNEL_PROGRESSION,
  [MEETING_TYPES.EXECUTIVE]: [
    // Executives: more email attempts, no SMS without permission
    { channel: COMMUNICATION_CHANNELS.EMAIL, maxAttempts: 4, waitHoursBeforeEscalate: 96 },
  ],
  [MEETING_TYPES.EXECUTIVE_BRIEFING]: [
    // Executive briefings: more email attempts, no SMS without permission
    { channel: COMMUNICATION_CHANNELS.EMAIL, maxAttempts: 4, waitHoursBeforeEscalate: 96 },
  ],
  [MEETING_TYPES.PRICING_NEGOTIATION]: [
    { channel: COMMUNICATION_CHANNELS.EMAIL, maxAttempts: 3, waitHoursBeforeEscalate: 72 },
    { channel: COMMUNICATION_CHANNELS.SMS, maxAttempts: 2, waitHoursBeforeEscalate: 48 },
  ],
  [MEETING_TYPES.IMPLEMENTATION_PLANNING]: DEFAULT_CHANNEL_PROGRESSION,
  [MEETING_TYPES.CHECK_IN]: [
    { channel: COMMUNICATION_CHANNELS.EMAIL, maxAttempts: 2, waitHoursBeforeEscalate: 24 },
    { channel: COMMUNICATION_CHANNELS.SMS, maxAttempts: 1, waitHoursBeforeEscalate: 24 },
  ],
  [MEETING_TYPES.TRIAL_KICKOFF]: [
    { channel: COMMUNICATION_CHANNELS.EMAIL, maxAttempts: 2, waitHoursBeforeEscalate: 48 },
    { channel: COMMUNICATION_CHANNELS.SMS, maxAttempts: 2, waitHoursBeforeEscalate: 48 },
  ],
  [MEETING_TYPES.CUSTOM]: DEFAULT_CHANNEL_PROGRESSION,
};

// ============================================
// DE-ESCALATION RULES
// ============================================

interface DeEscalationRule {
  triggerAfterAttempts: number;
  fromDuration: number;
  toDuration: number;
  tier: 'full' | 'reduced' | 'minimal';
}

const DE_ESCALATION_RULES: DeEscalationRule[] = [
  { triggerAfterAttempts: 4, fromDuration: 60, toDuration: 30, tier: 'reduced' },
  { triggerAfterAttempts: 6, fromDuration: 30, toDuration: 15, tier: 'minimal' },
];

// ============================================
// CHANNEL PROGRESSION SERVICE
// ============================================

/**
 * Initialize channel progression for a new request
 */
export function initializeChannelProgression(
  meetingType: MeetingType
): ChannelProgression {
  const rules = MEETING_TYPE_PROGRESSIONS[meetingType] || DEFAULT_CHANNEL_PROGRESSION;

  return {
    current_channel: rules[0].channel,
    attempts_on_channel: 0,
    escalate_after: rules[0].maxAttempts,
    channels_used: [rules[0].channel],
  };
}

/**
 * Check if we should escalate to the next channel
 */
export function shouldEscalateChannel(
  request: SchedulingRequest
): { shouldEscalate: boolean; nextChannel: CommunicationChannel | null; reason: string } {
  const progression = request.channel_progression;

  if (!progression) {
    return { shouldEscalate: false, nextChannel: null, reason: 'No progression configured' };
  }

  const rules = MEETING_TYPE_PROGRESSIONS[request.meeting_type] || DEFAULT_CHANNEL_PROGRESSION;
  const currentRuleIndex = rules.findIndex(r => r.channel === progression.current_channel);

  if (currentRuleIndex === -1) {
    return { shouldEscalate: false, nextChannel: null, reason: 'Channel not in progression' };
  }

  const currentRule = rules[currentRuleIndex];

  // Check if we've exceeded max attempts on current channel
  if (progression.attempts_on_channel >= currentRule.maxAttempts) {
    const nextRuleIndex = currentRuleIndex + 1;

    if (nextRuleIndex < rules.length) {
      return {
        shouldEscalate: true,
        nextChannel: rules[nextRuleIndex].channel,
        reason: `Exceeded ${currentRule.maxAttempts} attempts on ${progression.current_channel}`,
      };
    } else {
      return {
        shouldEscalate: false,
        nextChannel: null,
        reason: 'All channels exhausted',
      };
    }
  }

  return { shouldEscalate: false, nextChannel: null, reason: 'Within attempt limits' };
}

/**
 * Escalate to the next communication channel
 */
export async function escalateChannel(
  schedulingRequestId: string,
  newChannel: CommunicationChannel
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Get current request
    const { data: request, error: fetchError } = await adminSchedulingService.getSchedulingRequest(
      schedulingRequestId
    );

    if (fetchError || !request) {
      return { success: false, error: fetchError || 'Request not found' };
    }

    const progression = request.channel_progression || initializeChannelProgression(request.meeting_type);

    // Update progression
    const updatedProgression: ChannelProgression = {
      current_channel: newChannel,
      attempts_on_channel: 0,
      escalate_after: getMaxAttemptsForChannel(request.meeting_type, newChannel),
      channels_used: [...new Set([...progression.channels_used, newChannel])],
    };

    // Update request
    await supabase
      .from('scheduling_requests')
      .update({
        current_channel: newChannel,
        channel_progression: updatedProgression,
      })
      .eq('id', schedulingRequestId);

    // Log the escalation
    await adminSchedulingService.logAction(schedulingRequestId, {
      action_type: ACTION_TYPES.CHANNEL_ESCALATED,
      actor: 'ai',
      ai_reasoning: `Escalated from ${progression.current_channel} to ${newChannel} after ${progression.attempts_on_channel} attempts`,
    });

    return { success: true };

  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Increment attempt count on current channel
 */
export async function recordChannelAttempt(
  schedulingRequestId: string
): Promise<void> {
  const supabase = createAdminClient();

  const { data: request } = await supabase
    .from('scheduling_requests')
    .select('channel_progression, meeting_type')
    .eq('id', schedulingRequestId)
    .single();

  if (!request) return;

  const progression = request.channel_progression as ChannelProgression ||
    initializeChannelProgression(request.meeting_type);

  const updatedProgression: ChannelProgression = {
    ...progression,
    attempts_on_channel: progression.attempts_on_channel + 1,
  };

  await supabase
    .from('scheduling_requests')
    .update({ channel_progression: updatedProgression })
    .eq('id', schedulingRequestId);
}

// ============================================
// DE-ESCALATION SERVICE
// ============================================

/**
 * Check if we should de-escalate the meeting duration
 */
export function shouldDeEscalateDuration(
  request: SchedulingRequest
): { shouldDeEscalate: boolean; newDuration: number; tier: 'reduced' | 'minimal' | null; reason: string } {
  const currentDuration = request.deescalation_state?.current_duration || request.duration_minutes;

  // Find applicable de-escalation rule
  for (const rule of DE_ESCALATION_RULES) {
    if (
      request.attempt_count >= rule.triggerAfterAttempts &&
      currentDuration >= rule.fromDuration
    ) {
      return {
        shouldDeEscalate: true,
        newDuration: rule.toDuration,
        tier: rule.tier as 'reduced' | 'minimal',
        reason: `After ${request.attempt_count} attempts, reducing from ${currentDuration}min to ${rule.toDuration}min`,
      };
    }
  }

  return { shouldDeEscalate: false, newDuration: currentDuration, tier: null, reason: 'No de-escalation needed' };
}

/**
 * De-escalate meeting duration and notify prospect
 */
export async function deEscalateDuration(
  schedulingRequestId: string,
  newDuration: number,
  tier: 'reduced' | 'minimal',
  userId: string
): Promise<{ success: boolean; smsSent?: boolean; error?: string }> {
  const supabase = createAdminClient();

  try {
    // Get current request
    const { data: request, error: fetchError } = await adminSchedulingService.getSchedulingRequest(
      schedulingRequestId
    );

    if (fetchError || !request) {
      return { success: false, error: fetchError || 'Request not found' };
    }

    const previousDuration = request.deescalation_state?.current_duration || request.duration_minutes;

    // Update de-escalation state
    const deescalationState: DeEscalationState = {
      original_duration: request.deescalation_state?.original_duration || request.duration_minutes,
      current_duration: newDuration,
      duration_tier: tier,
      deescalated_at: new Date().toISOString(),
      reason: `Reduced from ${previousDuration}min to ${newDuration}min after ${request.attempt_count} attempts`,
    };

    // Update request
    await supabase
      .from('scheduling_requests')
      .update({
        duration_minutes: newDuration,
        deescalation_state: deescalationState,
      })
      .eq('id', schedulingRequestId);

    // Log the action
    await adminSchedulingService.logAction(schedulingRequestId, {
      action_type: ACTION_TYPES.DURATION_DEESCALATED,
      actor: 'ai',
      ai_reasoning: deescalationState.reason,
    });

    // If on SMS channel, send de-escalation message
    let smsSent = false;
    if (request.current_channel === COMMUNICATION_CHANNELS.SMS) {
      const smsResult = await sendDeEscalationSms(request, newDuration, userId);
      smsSent = smsResult.success;
    }

    return { success: true, smsSent };

  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// SMS CHANNEL OPERATIONS
// ============================================

/**
 * Send SMS for scheduling (handles phone number lookup)
 */
export async function sendSchedulingSmsToContact(
  request: SchedulingRequest,
  messageType: 'initial' | 'follow_up' | 'confirmation' | 'reminder',
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  // Get primary contact
  const primaryContact = request.attendees?.find(a => a.is_primary_contact);
  if (!primaryContact) {
    return { success: false, error: 'No primary contact' };
  }

  // Get full contact info for phone number
  if (!primaryContact.contact_id) {
    return { success: false, error: 'No contact linked' };
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('phone, mobile, name')
    .eq('id', primaryContact.contact_id)
    .single();

  if (!contact) {
    return { success: false, error: 'Contact not found' };
  }

  const phoneNumber = extractPhoneFromContact(contact);
  if (!phoneNumber) {
    return { success: false, error: 'No valid phone number' };
  }

  // Get sender info
  const { data: user } = await supabase
    .from('users')
    .select('name')
    .eq('id', userId)
    .single();

  // Get company name
  let companyName = 'your company';
  if (request.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', request.company_id)
      .single();
    companyName = company?.name || companyName;
  }

  // Build context
  const ctx: SmsTemplateContext = {
    recipientName: contact.name || primaryContact.name || 'there',
    companyName,
    senderName: user?.name || 'Sales Team',
    meetingType: getMeetingTypeLabel(request.meeting_type),
    duration: request.duration_minutes,
    scheduledTime: request.scheduled_time
      ? new Date(request.scheduled_time).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: request.timezone || 'America/New_York',
        })
      : undefined,
    meetingLink: request.meeting_link || undefined,
  };

  // Generate message based on type
  let message: string;
  switch (messageType) {
    case 'initial':
      message = generateInitialSms(ctx);
      break;
    case 'follow_up':
      message = generateFollowUpSms(ctx, request.attempt_count);
      break;
    default:
      return { success: false, error: `Unsupported message type: ${messageType}` };
  }

  // Send SMS
  const result = await sendSchedulingSms(phoneNumber, message, request.id);

  if (result.success) {
    // Log the action
    await adminSchedulingService.logAction(request.id, {
      action_type: ACTION_TYPES.SMS_SENT,
      message_content: message,
      actor: 'ai',
    });

    // Record channel attempt
    await recordChannelAttempt(request.id);
  }

  return result;
}

/**
 * Send de-escalation SMS offering shorter meeting
 */
async function sendDeEscalationSms(
  request: SchedulingRequest,
  newDuration: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const primaryContact = request.attendees?.find(a => a.is_primary_contact);
  if (!primaryContact?.contact_id) {
    return { success: false, error: 'No contact' };
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('phone, mobile, name')
    .eq('id', primaryContact.contact_id)
    .single();

  if (!contact) {
    return { success: false, error: 'Contact not found' };
  }

  const phoneNumber = extractPhoneFromContact(contact);
  if (!phoneNumber) {
    return { success: false, error: 'No phone' };
  }

  const { data: user } = await supabase
    .from('users')
    .select('name')
    .eq('id', userId)
    .single();

  const ctx: SmsTemplateContext = {
    recipientName: contact.name || 'there',
    senderName: user?.name || 'Sales Team',
    meetingType: getMeetingTypeLabel(request.meeting_type),
    duration: newDuration,
  };

  const message = generateDeEscalationSms(ctx, newDuration);

  return sendSchedulingSms(phoneNumber, message, request.id);
}

// ============================================
// HELPERS
// ============================================

function getMaxAttemptsForChannel(
  meetingType: MeetingType,
  channel: CommunicationChannel
): number {
  const rules = MEETING_TYPE_PROGRESSIONS[meetingType] || DEFAULT_CHANNEL_PROGRESSION;
  const rule = rules.find(r => r.channel === channel);
  return rule?.maxAttempts || 3;
}

function getMeetingTypeLabel(type: MeetingType): string {
  const labels: Record<MeetingType, string> = {
    [MEETING_TYPES.DISCOVERY]: 'discovery',
    [MEETING_TYPES.DEMO]: 'demo',
    [MEETING_TYPES.FOLLOW_UP]: 'follow-up',
    [MEETING_TYPES.TECHNICAL]: 'technical',
    [MEETING_TYPES.TECHNICAL_DEEP_DIVE]: 'technical deep dive',
    [MEETING_TYPES.EXECUTIVE]: 'executive',
    [MEETING_TYPES.EXECUTIVE_BRIEFING]: 'executive briefing',
    [MEETING_TYPES.PRICING_NEGOTIATION]: 'pricing discussion',
    [MEETING_TYPES.IMPLEMENTATION_PLANNING]: 'implementation planning',
    [MEETING_TYPES.CHECK_IN]: 'check-in',
    [MEETING_TYPES.TRIAL_KICKOFF]: 'trial kickoff',
    [MEETING_TYPES.CUSTOM]: 'meeting',
  };
  return labels[type] || 'call';
}

// ============================================
// EXPORTS
// ============================================

export {
  DEFAULT_CHANNEL_PROGRESSION,
  MEETING_TYPE_PROGRESSIONS,
  DE_ESCALATION_RULES,
};
