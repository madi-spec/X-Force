/**
 * Scheduling Stop Rules
 *
 * Relationship-aware rules that prevent over-contacting
 * and protect the prospect relationship.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { SchedulingRequest, SCHEDULING_STATUS, PersonaType } from './types';
import { getContactFrequencyState, ContactFrequencyState } from './reputationGuardrails';
import { STOP_RULES as BASE_STOP_RULES } from '@/lib/ai/leverage/stopRules';

// ============================================
// SCHEDULING-SPECIFIC STOP RULES
// ============================================

export const SCHEDULING_STOP_RULES = {
  // Attempt limits
  max_attempts_before_pause: 6,
  max_attempts_per_channel: 3,

  // Timing
  min_hours_between_attempts: 24,
  min_hours_between_channels: 48,
  pause_duration_days: 14,

  // Relationship signals
  respect_no_response_pattern: true,
  soften_after_attempts: 3,
  pause_on_negative_sentiment: true,

  // Channel-specific
  max_sms_per_request: 2,
  max_phone_attempts: 2,
  email_fatigue_threshold: 4,

  // Persona-based adjustments
  executive_max_attempts: 3,
  executive_min_days_between: 3,

  // Economic thresholds
  min_deal_value_for_escalation: 5000,
} as const;

// ============================================
// TYPES
// ============================================

export interface SchedulingStopCheck {
  canProceed: boolean;
  blockedBy: string | null;
  reason: string | null;
  suggestedAction: SuggestedAction | null;
  relationshipRisk: 'low' | 'medium' | 'high';
}

export type SuggestedAction =
  | 'wait'
  | 'change_channel'
  | 'soften_tone'
  | 'pause_outreach'
  | 'escalate_to_human'
  | 'try_champion'
  | 'abort';

export interface SchedulingStopContext {
  schedulingRequest: SchedulingRequest;
  intendedAction: 'send_email' | 'send_sms' | 'make_call' | 'send_follow_up';
  contactId?: string;
  persona?: PersonaType;
}

// ============================================
// MAIN CHECK FUNCTION
// ============================================

/**
 * Check all scheduling stop rules before taking action.
 */
export async function checkSchedulingStopRules(
  context: SchedulingStopContext
): Promise<SchedulingStopCheck> {
  const req = context.schedulingRequest;

  // Get contact frequency state if we have a contact
  let frequencyState: ContactFrequencyState | null = null;
  if (context.contactId) {
    frequencyState = await getContactFrequencyState(context.contactId, context.persona);
  }

  // Run checks in priority order
  const checks = [
    () => checkBlocked(frequencyState),
    () => checkMaxAttempts(req, context.persona),
    () => checkChannelLimits(req, context.intendedAction),
    () => checkTimingRules(req),
    () => checkResponsePattern(req),
    () => checkSentimentSignals(req),
    () => checkPersonaRules(req, context.persona),
    () => checkRelationshipRisk(req, frequencyState),
  ];

  for (const check of checks) {
    const result = await check();
    if (!result.canProceed) {
      return result;
    }
  }

  // Calculate overall relationship risk
  const risk = calculateRelationshipRisk(req, frequencyState);

  return {
    canProceed: true,
    blockedBy: null,
    reason: null,
    suggestedAction: risk === 'high' ? 'soften_tone' : null,
    relationshipRisk: risk,
  };
}

// ============================================
// INDIVIDUAL RULE CHECKS
// ============================================

function checkBlocked(
  frequencyState: ContactFrequencyState | null
): SchedulingStopCheck {
  if (frequencyState?.is_blocked) {
    return {
      canProceed: false,
      blockedBy: 'contact_blocked',
      reason: frequencyState.block_reason || 'Contact is blocked from outreach',
      suggestedAction: 'abort',
      relationshipRisk: 'high',
    };
  }

  return passCheck();
}

function checkMaxAttempts(
  req: SchedulingRequest,
  persona?: PersonaType
): SchedulingStopCheck {
  const maxAttempts = persona === 'executive'
    ? SCHEDULING_STOP_RULES.executive_max_attempts
    : SCHEDULING_STOP_RULES.max_attempts_before_pause;

  if (req.attempt_count >= maxAttempts) {
    return {
      canProceed: false,
      blockedBy: 'max_attempts',
      reason: `Maximum ${maxAttempts} attempts reached`,
      suggestedAction: 'pause_outreach',
      relationshipRisk: 'high',
    };
  }

  // Soft warning at soften threshold
  if (req.attempt_count >= SCHEDULING_STOP_RULES.soften_after_attempts) {
    return {
      canProceed: true,
      blockedBy: null,
      reason: 'Approaching attempt limit',
      suggestedAction: 'soften_tone',
      relationshipRisk: 'medium',
    };
  }

  return passCheck();
}

function checkChannelLimits(
  req: SchedulingRequest,
  intendedAction: SchedulingStopContext['intendedAction']
): SchedulingStopCheck {
  const channelState = req.channel_progression;

  if (!channelState) return passCheck();

  const attemptsOnChannel = channelState.attempts_on_channel || 0;

  // SMS limit
  if (intendedAction === 'send_sms') {
    const smsAttempts = req.actions?.filter(a =>
      a.action_type === 'sms_sent'
    ).length || 0;

    if (smsAttempts >= SCHEDULING_STOP_RULES.max_sms_per_request) {
      return {
        canProceed: false,
        blockedBy: 'sms_limit',
        reason: `Maximum ${SCHEDULING_STOP_RULES.max_sms_per_request} SMS messages reached`,
        suggestedAction: 'change_channel',
        relationshipRisk: 'medium',
      };
    }
  }

  // Phone limit
  if (intendedAction === 'make_call') {
    // Phone calls are human actions - track via ai_reasoning mentioning calls
    const callAttempts = req.actions?.filter(a =>
      a.ai_reasoning?.includes('call') || a.ai_reasoning?.includes('phone')
    ).length || 0;

    if (callAttempts >= SCHEDULING_STOP_RULES.max_phone_attempts) {
      return {
        canProceed: false,
        blockedBy: 'phone_limit',
        reason: `Maximum ${SCHEDULING_STOP_RULES.max_phone_attempts} call attempts reached`,
        suggestedAction: 'escalate_to_human',
        relationshipRisk: 'medium',
      };
    }
  }

  // Email fatigue
  if (intendedAction === 'send_email' || intendedAction === 'send_follow_up') {
    const emailAttempts = req.actions?.filter(a =>
      a.action_type === 'email_sent'
    ).length || 0;

    if (emailAttempts >= SCHEDULING_STOP_RULES.email_fatigue_threshold) {
      return {
        canProceed: false,
        blockedBy: 'email_fatigue',
        reason: `Email fatigue threshold (${SCHEDULING_STOP_RULES.email_fatigue_threshold}) reached`,
        suggestedAction: 'change_channel',
        relationshipRisk: 'medium',
      };
    }
  }

  // Per-channel limit
  if (attemptsOnChannel >= SCHEDULING_STOP_RULES.max_attempts_per_channel) {
    return {
      canProceed: false,
      blockedBy: 'channel_exhausted',
      reason: `Maximum ${SCHEDULING_STOP_RULES.max_attempts_per_channel} attempts on ${channelState.current_channel}`,
      suggestedAction: 'change_channel',
      relationshipRisk: 'medium',
    };
  }

  return passCheck();
}

function checkTimingRules(req: SchedulingRequest): SchedulingStopCheck {
  if (!req.last_action_at) return passCheck();

  const hoursSinceLastAction = getHoursSince(req.last_action_at);

  if (hoursSinceLastAction < SCHEDULING_STOP_RULES.min_hours_between_attempts) {
    const waitUntil = new Date(
      new Date(req.last_action_at).getTime() +
      SCHEDULING_STOP_RULES.min_hours_between_attempts * 60 * 60 * 1000
    );

    return {
      canProceed: false,
      blockedBy: 'timing_cooldown',
      reason: `Wait ${SCHEDULING_STOP_RULES.min_hours_between_attempts} hours between attempts`,
      suggestedAction: 'wait',
      relationshipRisk: 'low',
    };
  }

  return passCheck();
}

function checkResponsePattern(req: SchedulingRequest): SchedulingStopCheck {
  if (!SCHEDULING_STOP_RULES.respect_no_response_pattern) return passCheck();

  // Check if we've sent multiple emails with no response
  const actions = req.actions || [];
  const outbound = actions.filter(a =>
    a.action_type === 'email_sent' || a.action_type === 'sms_sent'
  );
  const inbound = actions.filter(a =>
    a.action_type === 'email_received' || a.action_type === 'sms_received'
  );

  // If 3+ outbound with 0 inbound, pause
  if (outbound.length >= 3 && inbound.length === 0) {
    return {
      canProceed: true, // Allow but flag
      blockedBy: null,
      reason: 'No response pattern detected',
      suggestedAction: 'escalate_to_human',
      relationshipRisk: 'high',
    };
  }

  return passCheck();
}

function checkSentimentSignals(req: SchedulingRequest): SchedulingStopCheck {
  if (!SCHEDULING_STOP_RULES.pause_on_negative_sentiment) return passCheck();

  // Check conversation history for negative signals
  const history = req.conversation_history || [];

  const negativeSignals = ['not interested', 'stop', 'unsubscribe', 'leave me alone', 'too busy', 'bad time'];

  for (const message of history) {
    if (message.direction === 'inbound') {
      const body = message.body?.toLowerCase() || '';
      if (negativeSignals.some(signal => body.includes(signal))) {
        return {
          canProceed: false,
          blockedBy: 'negative_sentiment',
          reason: 'Negative sentiment detected in response',
          suggestedAction: 'pause_outreach',
          relationshipRisk: 'high',
        };
      }
    }
  }

  return passCheck();
}

function checkPersonaRules(
  req: SchedulingRequest,
  persona?: PersonaType
): SchedulingStopCheck {
  if (!persona || persona !== 'executive') return passCheck();

  // Executive-specific rules
  const daysSinceLastAction = req.last_action_at
    ? getHoursSince(req.last_action_at) / 24
    : 999;

  if (daysSinceLastAction < SCHEDULING_STOP_RULES.executive_min_days_between) {
    return {
      canProceed: false,
      blockedBy: 'executive_cooldown',
      reason: `Executive contacts require ${SCHEDULING_STOP_RULES.executive_min_days_between} days between outreach`,
      suggestedAction: 'wait',
      relationshipRisk: 'medium',
    };
  }

  return passCheck();
}

async function checkRelationshipRisk(
  req: SchedulingRequest,
  frequencyState: ContactFrequencyState | null
): Promise<SchedulingStopCheck> {
  const risk = calculateRelationshipRisk(req, frequencyState);

  if (risk === 'high') {
    return {
      canProceed: true, // Allow but with strong warning
      blockedBy: null,
      reason: 'High relationship risk - proceed with caution',
      suggestedAction: 'soften_tone',
      relationshipRisk: 'high',
    };
  }

  return passCheck();
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function passCheck(): SchedulingStopCheck {
  return {
    canProceed: true,
    blockedBy: null,
    reason: null,
    suggestedAction: null,
    relationshipRisk: 'low',
  };
}

function getHoursSince(timestamp: string): number {
  return (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60);
}

function calculateRelationshipRisk(
  req: SchedulingRequest,
  frequencyState: ContactFrequencyState | null
): 'low' | 'medium' | 'high' {
  let riskScore = 0;

  // Attempt count contributes
  if (req.attempt_count >= 4) riskScore += 2;
  else if (req.attempt_count >= 2) riskScore += 1;

  // No-shows are a risk signal
  if (req.no_show_count >= 2) riskScore += 2;
  else if (req.no_show_count >= 1) riskScore += 1;

  // Frequency state
  if (frequencyState) {
    if (frequencyState.outreach_without_response >= 3) riskScore += 2;
    if (frequencyState.total_this_week >= 4) riskScore += 1;
  }

  // De-escalation indicates difficulty
  if (req.deescalation_state?.duration_tier === 'minimal') riskScore += 1;

  if (riskScore >= 4) return 'high';
  if (riskScore >= 2) return 'medium';
  return 'low';
}

// ============================================
// TONE ADJUSTMENT
// ============================================

export interface ToneAdjustment {
  soften: boolean;
  addApology: boolean;
  offerExit: boolean;
  reduceFrequency: boolean;
  suggestedTone: 'standard' | 'soft' | 'apologetic' | 'final_attempt';
}

/**
 * Get tone adjustments based on relationship risk.
 */
export function getToneAdjustment(
  stopCheck: SchedulingStopCheck,
  attemptCount: number
): ToneAdjustment {
  const baseAdjustment: ToneAdjustment = {
    soften: false,
    addApology: false,
    offerExit: false,
    reduceFrequency: false,
    suggestedTone: 'standard',
  };

  if (stopCheck.relationshipRisk === 'high') {
    return {
      soften: true,
      addApology: true,
      offerExit: true,
      reduceFrequency: true,
      suggestedTone: 'apologetic',
    };
  }

  if (stopCheck.relationshipRisk === 'medium' || attemptCount >= SCHEDULING_STOP_RULES.soften_after_attempts) {
    return {
      soften: true,
      addApology: false,
      offerExit: true,
      reduceFrequency: false,
      suggestedTone: 'soft',
    };
  }

  if (attemptCount >= SCHEDULING_STOP_RULES.max_attempts_before_pause - 1) {
    return {
      soften: true,
      addApology: false,
      offerExit: true,
      reduceFrequency: false,
      suggestedTone: 'final_attempt',
    };
  }

  return baseAdjustment;
}

// ============================================
// ACTION RECOMMENDATIONS
// ============================================

/**
 * Get recommended action based on stop check result.
 */
export function getRecommendedAction(
  stopCheck: SchedulingStopCheck
): {
  action: SuggestedAction;
  reason: string;
  waitUntil?: string;
} {
  switch (stopCheck.suggestedAction) {
    case 'wait':
      const waitHours = SCHEDULING_STOP_RULES.min_hours_between_attempts;
      return {
        action: 'wait',
        reason: `Wait before next outreach`,
        waitUntil: new Date(Date.now() + waitHours * 60 * 60 * 1000).toISOString(),
      };

    case 'change_channel':
      return {
        action: 'change_channel',
        reason: 'Current channel is exhausted, try a different approach',
      };

    case 'soften_tone':
      return {
        action: 'soften_tone',
        reason: 'Relationship at risk, use gentler messaging',
      };

    case 'pause_outreach':
      const pauseDays = SCHEDULING_STOP_RULES.pause_duration_days;
      return {
        action: 'pause_outreach',
        reason: `Pause outreach for ${pauseDays} days`,
        waitUntil: new Date(Date.now() + pauseDays * 24 * 60 * 60 * 1000).toISOString(),
      };

    case 'escalate_to_human':
      return {
        action: 'escalate_to_human',
        reason: 'Human intervention recommended',
      };

    case 'try_champion':
      return {
        action: 'try_champion',
        reason: 'Try reaching through internal champion',
      };

    case 'abort':
      return {
        action: 'abort',
        reason: 'Contact should not be reached',
      };

    default:
      return {
        action: 'wait',
        reason: 'No specific recommendation',
      };
  }
}
