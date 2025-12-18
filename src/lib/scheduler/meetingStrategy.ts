/**
 * Meeting Type Strategy Engine
 *
 * Defines strategies for each meeting type including:
 * - Channel progression rules
 * - De-escalation triggers
 * - Persona-specific adjustments
 * - Follow-up cadences
 */

import {
  MeetingType,
  MeetingTypeStrategy,
  PersonaType,
  CommunicationChannel,
  MEETING_TYPES,
  PERSONA_TYPES,
  COMMUNICATION_CHANNELS,
} from './types';

// ============================================
// MEETING TYPE STRATEGIES
// ============================================

export const MEETING_STRATEGIES: Record<MeetingType, MeetingTypeStrategy> = {
  [MEETING_TYPES.DISCOVERY]: {
    meeting_type: MEETING_TYPES.DISCOVERY,
    ideal_duration: 30,
    min_duration: 15,
    max_attempts_before_deescalate: 4,
    channel_progression: [
      COMMUNICATION_CHANNELS.EMAIL,
      COMMUNICATION_CHANNELS.SMS,
    ],
    follow_up_hours: [24, 48, 72], // Faster cadence for discovery
    persona_overrides: {
      [PERSONA_TYPES.OWNER_OPERATOR]: {
        duration_adjustment: -15, // 15 min for busy owners
        tone: 'direct',
      },
      [PERSONA_TYPES.EXECUTIVE]: {
        duration_adjustment: 0,
        tone: 'formal',
      },
      [PERSONA_TYPES.OFFICE_MANAGER]: {
        duration_adjustment: 0,
        tone: 'formal',
      },
    },
  },

  [MEETING_TYPES.DEMO]: {
    meeting_type: MEETING_TYPES.DEMO,
    ideal_duration: 60,
    min_duration: 30,
    max_attempts_before_deescalate: 5,
    channel_progression: [
      COMMUNICATION_CHANNELS.EMAIL,
      COMMUNICATION_CHANNELS.SMS,
    ],
    follow_up_hours: [24, 72, 120], // Longer cadence for demos
    persona_overrides: {
      [PERSONA_TYPES.OWNER_OPERATOR]: {
        duration_adjustment: -15, // 45 min for owners
        tone: 'direct',
      },
      [PERSONA_TYPES.IT_TECHNICAL]: {
        duration_adjustment: 15, // 75 min for technical deep dives
        tone: 'direct',
      },
      [PERSONA_TYPES.OPERATIONS_LEAD]: {
        duration_adjustment: 0,
        tone: 'consultative',
      },
    },
  },

  [MEETING_TYPES.FOLLOW_UP]: {
    meeting_type: MEETING_TYPES.FOLLOW_UP,
    ideal_duration: 30,
    min_duration: 15,
    max_attempts_before_deescalate: 3,
    channel_progression: [
      COMMUNICATION_CHANNELS.EMAIL,
      COMMUNICATION_CHANNELS.SMS,
    ],
    follow_up_hours: [24, 48], // Quick follow-ups
    persona_overrides: {
      [PERSONA_TYPES.OWNER_OPERATOR]: {
        duration_adjustment: -15,
        tone: 'direct',
      },
      [PERSONA_TYPES.EXECUTIVE]: {
        duration_adjustment: -15, // 15 min for execs
        tone: 'formal',
      },
    },
  },

  [MEETING_TYPES.TECHNICAL]: {
    meeting_type: MEETING_TYPES.TECHNICAL,
    ideal_duration: 45,
    min_duration: 30,
    max_attempts_before_deescalate: 4,
    channel_progression: [
      COMMUNICATION_CHANNELS.EMAIL,
      // No SMS for technical - usually IT prefers email
    ],
    follow_up_hours: [48, 96, 144], // Longer cadence
    persona_overrides: {
      [PERSONA_TYPES.IT_TECHNICAL]: {
        duration_adjustment: 15, // 60 min for deep technical
        tone: 'direct',
      },
      [PERSONA_TYPES.OPERATIONS_LEAD]: {
        duration_adjustment: 0,
        tone: 'consultative',
      },
    },
  },

  [MEETING_TYPES.EXECUTIVE]: {
    meeting_type: MEETING_TYPES.EXECUTIVE,
    ideal_duration: 30,
    min_duration: 15,
    max_attempts_before_deescalate: 3,
    channel_progression: [
      COMMUNICATION_CHANNELS.EMAIL,
      // No SMS for executives without explicit permission
    ],
    follow_up_hours: [48, 96], // Respectful spacing
    persona_overrides: {
      [PERSONA_TYPES.EXECUTIVE]: {
        duration_adjustment: -15, // 15 min max
        tone: 'formal',
      },
      [PERSONA_TYPES.FRANCHISE_CORP]: {
        duration_adjustment: 0,
        tone: 'consultative',
      },
    },
  },

  [MEETING_TYPES.TECHNICAL_DEEP_DIVE]: {
    meeting_type: MEETING_TYPES.TECHNICAL_DEEP_DIVE,
    ideal_duration: 60,
    min_duration: 45,
    max_attempts_before_deescalate: 4,
    channel_progression: [
      COMMUNICATION_CHANNELS.EMAIL,
    ],
    follow_up_hours: [48, 96, 144],
    persona_overrides: {
      [PERSONA_TYPES.IT_TECHNICAL]: {
        duration_adjustment: 30,
        tone: 'direct',
      },
    },
  },

  [MEETING_TYPES.EXECUTIVE_BRIEFING]: {
    meeting_type: MEETING_TYPES.EXECUTIVE_BRIEFING,
    ideal_duration: 30,
    min_duration: 15,
    max_attempts_before_deescalate: 3,
    channel_progression: [
      COMMUNICATION_CHANNELS.EMAIL,
    ],
    follow_up_hours: [48, 96],
    persona_overrides: {
      [PERSONA_TYPES.EXECUTIVE]: {
        duration_adjustment: -15,
        tone: 'formal',
      },
    },
  },

  [MEETING_TYPES.PRICING_NEGOTIATION]: {
    meeting_type: MEETING_TYPES.PRICING_NEGOTIATION,
    ideal_duration: 45,
    min_duration: 30,
    max_attempts_before_deescalate: 4,
    channel_progression: [
      COMMUNICATION_CHANNELS.EMAIL,
      COMMUNICATION_CHANNELS.SMS,
    ],
    follow_up_hours: [24, 48, 72],
    persona_overrides: {
      [PERSONA_TYPES.EXECUTIVE]: {
        duration_adjustment: -15,
        tone: 'formal',
      },
      [PERSONA_TYPES.OWNER_OPERATOR]: {
        duration_adjustment: 0,
        tone: 'direct',
      },
    },
  },

  [MEETING_TYPES.IMPLEMENTATION_PLANNING]: {
    meeting_type: MEETING_TYPES.IMPLEMENTATION_PLANNING,
    ideal_duration: 60,
    min_duration: 45,
    max_attempts_before_deescalate: 4,
    channel_progression: [
      COMMUNICATION_CHANNELS.EMAIL,
      COMMUNICATION_CHANNELS.SMS,
    ],
    follow_up_hours: [24, 48, 72],
    persona_overrides: {
      [PERSONA_TYPES.OPERATIONS_LEAD]: {
        duration_adjustment: 0,
        tone: 'consultative',
      },
      [PERSONA_TYPES.IT_TECHNICAL]: {
        duration_adjustment: 15,
        tone: 'direct',
      },
    },
  },

  [MEETING_TYPES.CHECK_IN]: {
    meeting_type: MEETING_TYPES.CHECK_IN,
    ideal_duration: 15,
    min_duration: 15,
    max_attempts_before_deescalate: 3,
    channel_progression: [
      COMMUNICATION_CHANNELS.EMAIL,
      COMMUNICATION_CHANNELS.SMS,
    ],
    follow_up_hours: [24, 48],
    persona_overrides: {
      [PERSONA_TYPES.OWNER_OPERATOR]: {
        duration_adjustment: 0,
        tone: 'direct',
      },
    },
  },

  [MEETING_TYPES.TRIAL_KICKOFF]: {
    meeting_type: MEETING_TYPES.TRIAL_KICKOFF,
    ideal_duration: 45,
    min_duration: 30,
    max_attempts_before_deescalate: 4,
    channel_progression: [
      COMMUNICATION_CHANNELS.EMAIL,
      COMMUNICATION_CHANNELS.SMS,
    ],
    follow_up_hours: [24, 48, 72],
    persona_overrides: {
      [PERSONA_TYPES.OPERATIONS_LEAD]: {
        duration_adjustment: 0,
        tone: 'consultative',
      },
    },
  },

  [MEETING_TYPES.CUSTOM]: {
    meeting_type: MEETING_TYPES.CUSTOM,
    ideal_duration: 30,
    min_duration: 15,
    max_attempts_before_deescalate: 4,
    channel_progression: [
      COMMUNICATION_CHANNELS.EMAIL,
      COMMUNICATION_CHANNELS.SMS,
    ],
    follow_up_hours: [24, 48, 72],
    persona_overrides: {},
  },
};

// ============================================
// STRATEGY APPLICATION
// ============================================

/**
 * Get the strategy for a meeting type
 */
export function getMeetingStrategy(meetingType: MeetingType): MeetingTypeStrategy {
  return MEETING_STRATEGIES[meetingType] || MEETING_STRATEGIES[MEETING_TYPES.CUSTOM];
}

/**
 * Calculate adjusted duration based on persona
 */
export function getAdjustedDuration(
  meetingType: MeetingType,
  persona: PersonaType,
  baseDuration?: number
): number {
  const strategy = getMeetingStrategy(meetingType);
  const base = baseDuration || strategy.ideal_duration;

  const override = strategy.persona_overrides[persona];
  if (override?.duration_adjustment) {
    const adjusted = base + override.duration_adjustment;
    // Ensure we don't go below minimum
    return Math.max(adjusted, strategy.min_duration);
  }

  return base;
}

/**
 * Get recommended tone for meeting type + persona
 */
export function getRecommendedTone(
  meetingType: MeetingType,
  persona: PersonaType
): 'formal' | 'casual' | 'direct' | 'consultative' {
  const strategy = getMeetingStrategy(meetingType);
  const override = strategy.persona_overrides[persona];

  if (override?.tone) {
    return override.tone;
  }

  // Default tones by persona
  const defaultTones: Record<PersonaType, 'formal' | 'casual' | 'direct' | 'consultative'> = {
    [PERSONA_TYPES.OWNER_OPERATOR]: 'direct',
    [PERSONA_TYPES.OFFICE_MANAGER]: 'formal',
    [PERSONA_TYPES.OPERATIONS_LEAD]: 'consultative',
    [PERSONA_TYPES.IT_TECHNICAL]: 'direct',
    [PERSONA_TYPES.EXECUTIVE]: 'formal',
    [PERSONA_TYPES.FRANCHISE_CORP]: 'consultative',
  };

  return defaultTones[persona] || 'formal';
}

/**
 * Get follow-up interval in hours based on attempt number
 */
export function getFollowUpInterval(
  meetingType: MeetingType,
  attemptNumber: number
): number {
  const strategy = getMeetingStrategy(meetingType);
  const intervals = strategy.follow_up_hours;

  // Use the appropriate interval or the last one for subsequent attempts
  const index = Math.min(attemptNumber - 1, intervals.length - 1);
  return intervals[index] || 72; // Default 3 days
}

/**
 * Check if SMS is allowed for this meeting type
 */
export function isSmsAllowed(meetingType: MeetingType): boolean {
  const strategy = getMeetingStrategy(meetingType);
  return strategy.channel_progression.includes(COMMUNICATION_CHANNELS.SMS);
}

/**
 * Get the channel progression for a meeting type
 */
export function getChannelProgression(meetingType: MeetingType): CommunicationChannel[] {
  const strategy = getMeetingStrategy(meetingType);
  return strategy.channel_progression;
}

/**
 * Get the de-escalation trigger point
 */
export function getDeEscalationTrigger(meetingType: MeetingType): number {
  const strategy = getMeetingStrategy(meetingType);
  return strategy.max_attempts_before_deescalate;
}

// ============================================
// STRATEGY CONTEXT BUILDER
// ============================================

export interface SchedulingContext {
  meetingType: MeetingType;
  persona: PersonaType;
  attemptNumber: number;
  currentChannel: CommunicationChannel;
  currentDuration: number;
}

export interface StrategyRecommendation {
  duration: number;
  tone: 'formal' | 'casual' | 'direct' | 'consultative';
  channel: CommunicationChannel;
  shouldDeEscalate: boolean;
  shouldEscalateChannel: boolean;
  followUpHours: number;
  messagingFocus: string;
}

/**
 * Get complete strategy recommendation for current context
 */
export function getStrategyRecommendation(
  context: SchedulingContext
): StrategyRecommendation {
  const strategy = getMeetingStrategy(context.meetingType);

  // Check de-escalation
  const shouldDeEscalate = context.attemptNumber >= strategy.max_attempts_before_deescalate &&
    context.currentDuration > strategy.min_duration;

  // Check channel escalation
  const channelIndex = strategy.channel_progression.indexOf(context.currentChannel);
  const maxAttemptsOnChannel = channelIndex === 0 ? 3 : 2;
  const shouldEscalateChannel = context.attemptNumber > maxAttemptsOnChannel &&
    channelIndex < strategy.channel_progression.length - 1;

  // Determine next channel
  const nextChannel = shouldEscalateChannel
    ? strategy.channel_progression[channelIndex + 1]
    : context.currentChannel;

  // Calculate duration
  let duration = context.currentDuration;
  if (shouldDeEscalate) {
    // Reduce to next tier
    if (duration >= 60) duration = 30;
    else if (duration >= 30) duration = 15;
  }
  duration = getAdjustedDuration(context.meetingType, context.persona, duration);

  // Get tone
  const tone = getRecommendedTone(context.meetingType, context.persona);

  // Get follow-up interval
  const followUpHours = getFollowUpInterval(context.meetingType, context.attemptNumber);

  // Messaging focus based on context
  let messagingFocus = 'Value proposition and convenience';
  if (shouldDeEscalate) {
    messagingFocus = 'Shorter commitment, quick value preview';
  } else if (context.attemptNumber > 2) {
    messagingFocus = 'Flexibility, alternative times, acknowledgment of busy schedule';
  }

  return {
    duration,
    tone,
    channel: nextChannel,
    shouldDeEscalate,
    shouldEscalateChannel,
    followUpHours,
    messagingFocus,
  };
}

// ============================================
// EXPORTS
// ============================================

// SchedulingContext and StrategyRecommendation are exported inline with their declarations
