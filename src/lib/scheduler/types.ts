/**
 * AI Scheduler Types
 *
 * Types for the scheduling request system, state machine, and related entities.
 */

import type { SchedulingIntent } from './core/constants';

// Re-export SchedulingIntent for convenience
export type { SchedulingIntent };

// ============================================
// INTENT ANALYSIS TYPES (moved from IntentDetector.ts)
// ============================================

export interface IntentAnalysis {
  /** Primary detected intent */
  intent: SchedulingIntent;
  /** Confidence in the detection */
  confidence: 'high' | 'medium' | 'low';
  /** Sentiment toward the meeting */
  sentiment: 'positive' | 'neutral' | 'negative';
  /** AI's reasoning for this classification */
  reasoning: string;

  // Flags for special handling
  /** Is the person expressing confusion or correcting us? */
  isConfused: boolean;
  /** What are they confused about? */
  confusionReason?: string;
  /** Are they delegating to someone else? */
  isDelegating: boolean;
  /** Who are they delegating to? */
  delegateTo?: string;
  /** Do they have a question? */
  hasQuestion: boolean;
  /** What is their question? */
  question?: string;
  /** Did they mention they're out of office or unavailable? */
  isOutOfOffice: boolean;
  /** Any dates mentioned for unavailability */
  oooUntil?: string;
}

// ============================================
// ENUMS / CONSTANTS
// ============================================

export const SCHEDULING_STATUS = {
  INITIATED: 'initiated',
  PROPOSING: 'proposing',
  AWAITING_RESPONSE: 'awaiting_response',
  NEGOTIATING: 'negotiating',
  CONFIRMING: 'confirming',
  CONFIRMED: 'confirmed',
  REMINDER_SENT: 'reminder_sent',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
} as const;

export type SchedulingStatus = (typeof SCHEDULING_STATUS)[keyof typeof SCHEDULING_STATUS];

export const MEETING_TYPES = {
  DISCOVERY: 'discovery',
  DEMO: 'demo',
  FOLLOW_UP: 'follow_up',
  TECHNICAL: 'technical',
  TECHNICAL_DEEP_DIVE: 'technical_deep_dive',
  EXECUTIVE: 'executive',
  EXECUTIVE_BRIEFING: 'executive_briefing',
  PRICING_NEGOTIATION: 'pricing_negotiation',
  IMPLEMENTATION_PLANNING: 'implementation_planning',
  CHECK_IN: 'check_in',
  TRIAL_KICKOFF: 'trial_kickoff',
  CUSTOM: 'custom',
} as const;

export type MeetingType = (typeof MEETING_TYPES)[keyof typeof MEETING_TYPES];

export const MEETING_PLATFORMS = {
  TEAMS: 'teams',
  ZOOM: 'zoom',
  GOOGLE_MEET: 'google_meet',
  PHONE: 'phone',
  IN_PERSON: 'in_person',
} as const;

export type MeetingPlatform = (typeof MEETING_PLATFORMS)[keyof typeof MEETING_PLATFORMS];

export const ACTION_TYPES = {
  EMAIL_SENT: 'email_sent',
  EMAIL_RECEIVED: 'email_received',
  SMS_SENT: 'sms_sent',
  SMS_RECEIVED: 'sms_received',
  TIMES_PROPOSED: 'times_proposed',
  TIME_SELECTED: 'time_selected',
  INVITE_SENT: 'invite_sent',
  INVITE_ACCEPTED: 'invite_accepted',
  INVITE_DECLINED: 'invite_declined',
  REMINDER_SENT: 'reminder_sent',
  NO_SHOW_DETECTED: 'no_show_detected',
  RESCHEDULING_STARTED: 'rescheduling_started',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  FOLLOW_UP_SENT: 'follow_up_sent',
  PAUSED: 'paused',
  RESUMED: 'resumed',
  STATUS_CHANGED: 'status_changed',
  CHANNEL_ESCALATED: 'channel_escalated',
  DURATION_DEESCALATED: 'duration_deescalated',
  PERSONA_DETECTED: 'persona_detected',
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

export const INVITE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  TENTATIVE: 'tentative',
} as const;

export type InviteStatus = (typeof INVITE_STATUS)[keyof typeof INVITE_STATUS];

export const ATTENDEE_SIDE = {
  INTERNAL: 'internal',
  EXTERNAL: 'external',
} as const;

export type AttendeeSide = (typeof ATTENDEE_SIDE)[keyof typeof ATTENDEE_SIDE];

export const OUTCOME_TYPES = {
  HELD: 'held',
  CANCELLED_BY_US: 'cancelled_by_us',
  CANCELLED_BY_THEM: 'cancelled_by_them',
  NO_SHOW: 'no_show',
  RESCHEDULED: 'rescheduled',
} as const;

export type OutcomeType = (typeof OUTCOME_TYPES)[keyof typeof OUTCOME_TYPES];

// ============================================
// PHASE 3: MULTI-CHANNEL & PERSONALIZATION
// ============================================

export const COMMUNICATION_CHANNELS = {
  EMAIL: 'email',
  SMS: 'sms',
  PHONE: 'phone',
} as const;

export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[keyof typeof COMMUNICATION_CHANNELS];

export const PERSONA_TYPES = {
  OWNER_OPERATOR: 'owner_operator',       // Busy owner, direct, values time
  OFFICE_MANAGER: 'office_manager',       // Detail-oriented, follows process
  OPERATIONS_LEAD: 'operations_lead',     // Efficiency-focused, data-driven
  IT_TECHNICAL: 'it_technical',           // Technical, wants specifics
  EXECUTIVE: 'executive',                 // High-level, strategic, brief
  FRANCHISE_CORP: 'franchise_corp',       // Multi-location, scalability focus
} as const;

export type PersonaType = (typeof PERSONA_TYPES)[keyof typeof PERSONA_TYPES];

export const URGENCY_LEVELS = {
  LOW: 'low',           // Standard cadence
  MEDIUM: 'medium',     // Slightly faster follow-ups
  HIGH: 'high',         // Priority scheduling
  CRITICAL: 'critical', // Hot lead, immediate action
} as const;

export type UrgencyLevel = (typeof URGENCY_LEVELS)[keyof typeof URGENCY_LEVELS];

// De-escalation: Reduce meeting duration when struggling to schedule
export const DURATION_TIERS = {
  FULL: 60,      // Full demo/discovery
  REDUCED: 30,   // Condensed version
  MINIMAL: 15,   // Quick intro/check-in
} as const;

export type DurationTier = (typeof DURATION_TIERS)[keyof typeof DURATION_TIERS];

// Channel progression rules
export interface ChannelProgression {
  current_channel: CommunicationChannel;
  attempts_on_channel: number;
  escalate_after: number;  // Escalate to next channel after N attempts
  channels_used: CommunicationChannel[];
}

// De-escalation state
export interface DeEscalationState {
  original_duration: number;
  current_duration: number;
  duration_tier: 'full' | 'reduced' | 'minimal';
  deescalated_at: string | null;
  reason: string | null;
}

// Persona configuration for tone/style
export interface PersonaConfig {
  type: PersonaType;
  detected_at: string;
  confidence: number;  // 0-1
  signals: string[];   // What indicated this persona
}

// Meeting type strategy
export interface MeetingTypeStrategy {
  meeting_type: MeetingType;
  ideal_duration: number;
  min_duration: number;
  max_attempts_before_deescalate: number;
  channel_progression: CommunicationChannel[];
  follow_up_hours: number[];  // [24, 48, 72] for 1st, 2nd, 3rd follow-up
  persona_overrides: Partial<Record<PersonaType, {
    duration_adjustment: number;  // +/- minutes
    tone: 'formal' | 'casual' | 'direct' | 'consultative';
  }>>;
}

// ============================================
// CORE TYPES
// ============================================

export interface PreferredTimes {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
}

export interface SchedulingRequest {
  id: string;
  created_by: string;
  deal_id: string | null;
  company_id: string | null;
  source_communication_id: string | null;

  // Meeting details
  meeting_type: MeetingType;
  duration_minutes: number;
  title: string | null;
  context: string | null;

  // Video/location
  meeting_platform: MeetingPlatform;
  meeting_location: string | null;
  meeting_link: string | null;

  // Scheduling preferences
  date_range_start: string | null;
  date_range_end: string | null;
  preferred_times: PreferredTimes;
  avoid_days: string[];
  timezone: string;

  // State
  status: SchedulingStatus;
  attempt_count: number;
  no_show_count: number;
  last_action_at: string | null;
  next_action_at: string | null;
  next_action_type: string | null;

  // Proposed times
  proposed_times: string[];

  // Outcome
  scheduled_time: string | null;
  calendar_event_id: string | null;
  invite_accepted: boolean;
  completed_at: string | null;
  outcome: OutcomeType | null;
  outcome_notes: string | null;

  // AI tracking
  email_thread_id: string | null;
  conversation_history: ConversationMessage[];

  // Phase 3: Multi-channel & personalization
  current_channel: CommunicationChannel;
  channel_progression: ChannelProgression | null;
  deescalation_state: DeEscalationState | null;
  persona: PersonaConfig | null;
  urgency: UrgencyLevel;

  created_at: string;
  updated_at: string;

  // Relations (when joined)
  attendees?: SchedulingAttendee[];
  actions?: SchedulingAction[];
  company?: { id: string; name: string };
  deal?: { id: string; name: string };
  creator?: { id: string; name: string };
}

export interface SchedulingAttendee {
  id: string;
  scheduling_request_id: string;

  side: AttendeeSide;
  user_id: string | null;
  contact_id: string | null;

  name: string | null;
  email: string;
  title: string | null;

  is_required: boolean;
  is_organizer: boolean;
  is_primary_contact: boolean;

  invite_status: InviteStatus;
  responded_at: string | null;

  created_at: string;

  // Relations (when joined)
  user?: { id: string; name: string; email: string };
  contact?: { id: string; name: string; email: string };
}

export interface SchedulingAction {
  id: string;
  scheduling_request_id: string;

  action_type: ActionType;
  email_id: string | null;
  times_proposed: string[] | null;
  time_selected: string | null;
  message_subject: string | null;
  message_content: string | null;

  previous_status: SchedulingStatus | null;
  new_status: SchedulingStatus | null;

  ai_reasoning: string | null;
  actor: 'ai' | 'user' | 'prospect';
  actor_id: string | null;

  created_at: string;
}

export interface SchedulingTemplate {
  id: string;
  name: string;
  meeting_type: MeetingType | null;
  description: string | null;

  duration_minutes: number;
  default_platform: MeetingPlatform;

  initial_email_template: string | null;
  follow_up_template: string | null;
  confirmation_template: string | null;
  reminder_template: string | null;
  no_show_template: string | null;
  reschedule_template: string | null;

  follow_up_after_hours: number;
  second_follow_up_hours: number;
  reminder_hours_before: number;
  max_attempts: number;

  default_preferred_times: PreferredTimes;
  default_avoid_days: string[];

  is_system: boolean;
  created_by: string | null;

  created_at: string;
  updated_at: string;
}

export interface MeetingPrepBrief {
  id: string;
  scheduling_request_id: string;
  deal_id: string | null;
  company_id: string | null;
  meeting_time: string;

  brief_content: {
    executive_summary: string;
    meeting_objective: string;
    key_talking_points: string[];
    questions_to_ask: string[];
    landmines_to_avoid: string[];
    objection_prep: Array<{ objection: string; response: string }>;
    next_steps_to_propose: string[];
    attendee_insights: Array<{ name: string; title?: string; notes: string }>;
  };

  generated_at: string;
  viewed_at: string | null;
  feedback_rating: number | null;
  feedback_notes: string | null;

  created_at: string;
}

export interface ConversationMessage {
  id: string;
  timestamp: string;
  direction: 'outbound' | 'inbound';
  channel: CommunicationChannel;
  subject: string;  // Empty for SMS
  body: string;
  sender: string;
  recipient: string;
}

// ============================================
// API / FORM TYPES
// ============================================

export interface CreateSchedulingRequestInput {
  meeting_type: MeetingType;
  duration_minutes: number;
  title?: string;
  context?: string;

  meeting_platform: MeetingPlatform;
  meeting_location?: string;

  date_range_start: string;
  date_range_end: string;
  preferred_times?: PreferredTimes;
  avoid_days?: string[];
  timezone?: string;

  deal_id?: string;
  company_id?: string;
  source_communication_id?: string;

  internal_attendees: Array<{
    user_id: string;
    is_organizer?: boolean;
  }>;

  external_attendees: Array<{
    contact_id?: string;
    name: string;
    email: string;
    title?: string;
    is_primary_contact?: boolean;
  }>;
}

export interface UpdateSchedulingRequestInput {
  status?: SchedulingStatus;
  scheduled_time?: string;
  calendar_event_id?: string;
  outcome?: OutcomeType;
  outcome_notes?: string;
  next_action_at?: string;
  next_action_type?: string;
  // Editable fields
  company_id?: string | null;
  deal_id?: string | null;
  title?: string | null;
  context?: string | null;
  meeting_type?: MeetingType;
  duration_minutes?: number;
  meeting_platform?: MeetingPlatform;
}

export interface ProposedTimeSlot {
  start: Date;
  end: Date;
  formatted: string;
}

// ============================================
// EMAIL GENERATION TYPES
// ============================================

export interface SchedulingEmailContext {
  meetingType: MeetingType;
  duration: number;
  context: string | null;
  proposedTimes: ProposedTimeSlot[];
  ourAttendees: Array<{ name: string; title?: string }>;
  theirAttendees: Array<{ name: string; title?: string }>;
  companyName: string;
  dealContext?: {
    stage: string;
    lastMeeting?: string;
    keyPoints?: string[];
  };
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface SchedulingRequestSummary {
  id: string;
  title: string | null;
  meeting_type: MeetingType;
  status: SchedulingStatus;
  company_name: string;
  primary_contact: string;
  scheduled_time: string | null;
  last_action_at: string | null;
  next_action_at: string | null;
  next_action_type: string | null;
  attempt_count: number;
  no_show_count: number;
  created_at: string;
}

export interface SchedulerDashboardData {
  pending: SchedulingRequestSummary[];
  confirmed: SchedulingRequestSummary[];
  needs_attention: SchedulingRequestSummary[];
  completed_this_week: {
    held: number;
    cancelled: number;
  };
}

// ============================================
// DRAFT SYSTEM TYPES
// ============================================

export const DRAFT_STATUS = {
  NONE: 'none',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  SENT: 'sent',
  EXPIRED: 'expired',
} as const;

export type DraftStatus = (typeof DRAFT_STATUS)[keyof typeof DRAFT_STATUS];

/**
 * Proposed time with full timezone info (stored in draft_proposed_times)
 * This ensures times are locked after preview and never regenerated
 */
export interface DraftProposedTime {
  localDateTime: string;      // "2025-01-06T14:00:00"
  timezone: string;           // "America/New_York"
  utc: string;                // "2025-01-06T19:00:00.000Z"
  display: string;            // "Monday, January 6 at 2:00 PM ET"
}

/**
 * Draft content structure stored in database
 */
export interface SchedulingDraft {
  subject: string;
  body: string;
  proposedTimes: DraftProposedTime[];
  generatedAt: string;        // ISO timestamp
  editedAt: string | null;    // ISO timestamp or null
  status: DraftStatus;
}

/**
 * Extended scheduling request with draft info
 */
export interface SchedulingRequestWithDraft extends SchedulingRequest {
  draft_email_subject: string | null;
  draft_email_body: string | null;
  draft_proposed_times: DraftProposedTime[] | null;
  draft_generated_at: string | null;
  draft_edited_at: string | null;
  draft_status: DraftStatus;
}
