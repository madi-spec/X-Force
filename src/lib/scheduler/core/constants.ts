/**
 * Scheduler Constants - Single source for all constant values
 *
 * This file contains all configuration constants for the scheduling system.
 * Update values here rather than scattering magic numbers throughout the codebase.
 */

// ============================================
// ACTION TYPES
// ============================================

/** Action types that can be automatically processed by the cron */
export const AUTOMATION_ACTION_TYPES = [
  'follow_up',
  'second_follow_up',
  'send_initial',
  'send_options',
  'send_reminder',
  'check_no_show',
] as const;

/** Action types that require human review - cron won't auto-process */
export const HUMAN_REVIEW_ACTION_TYPES = [
  'human_review_decline',
  'human_review_max_attempts',
  'human_review_confusion',
  'answer_question',
  'offer_future_scheduling',
  'review_counter_proposal',
  'clarify_response',
  'confirm_attendance',
] as const;

/** All action types the cron should query for */
export const PROCESSABLE_ACTION_TYPES = [
  'process_response',
  ...AUTOMATION_ACTION_TYPES,
  ...HUMAN_REVIEW_ACTION_TYPES,
] as const;

export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];
export type HumanReviewActionType = (typeof HUMAN_REVIEW_ACTION_TYPES)[number];
export type ProcessableActionType = (typeof PROCESSABLE_ACTION_TYPES)[number];

// ============================================
// CONFIDENCE THRESHOLDS
// ============================================

export const CONFIDENCE = {
  /** High confidence - can auto-execute without human review */
  HIGH: 'high',
  /** Medium confidence - create draft for human review */
  MEDIUM: 'medium',
  /** Low confidence - escalate to human immediately */
  LOW: 'low',
} as const;

export const CONFIDENCE_THRESHOLDS = {
  /** Actions above this level can auto-execute */
  AUTO_EXECUTE: CONFIDENCE.HIGH,
  /** Actions at this level need human review before sending */
  NEEDS_REVIEW: CONFIDENCE.MEDIUM,
  /** Actions at this level should be escalated immediately */
  ESCALATE: CONFIDENCE.LOW,
} as const;

export type ConfidenceLevel = (typeof CONFIDENCE)[keyof typeof CONFIDENCE];

// ============================================
// TIMING CONSTANTS
// ============================================

export const TIMING = {
  /** Hours to wait before first follow-up */
  FOLLOW_UP_DELAY_HOURS: 24,
  /** Hours to wait before second follow-up */
  SECOND_FOLLOW_UP_DELAY_HOURS: 48,
  /** Hours to wait before final follow-up */
  FINAL_FOLLOW_UP_DELAY_HOURS: 72,
  /** Maximum number of follow-up attempts before pausing */
  MAX_FOLLOW_UP_ATTEMPTS: 5,
  /** Hours before meeting to send reminder */
  REMINDER_HOURS_BEFORE: 24,
  /** Delay before processing a response (allow email threading) */
  RESPONSE_PROCESSING_DELAY_MS: 3 * 60 * 1000, // 3 minutes
  /** Minimum hours in future for a valid meeting time */
  MIN_HOURS_IN_FUTURE: 1,
} as const;

// ============================================
// BUSINESS HOURS
// ============================================

export const DEFAULT_BUSINESS_HOURS = {
  /** Start of business day (hour in 24h format) */
  start: 9, // 9 AM
  /** End of business day (hour in 24h format) */
  end: 17, // 5 PM
  /** Default timezone for business operations */
  timezone: 'America/New_York',
} as const;

// ============================================
// MEETING DEFAULTS
// ============================================

export const MEETING_DEFAULTS = {
  /** Default meeting duration in minutes */
  DURATION_MINUTES: 30,
  /** Maximum meeting duration in minutes */
  MAX_DURATION_MINUTES: 120,
  /** Number of time slots to propose */
  SLOTS_TO_PROPOSE: 3,
  /** Days ahead to look for available slots */
  DAYS_AHEAD_TO_SEARCH: 14,
} as const;

// ============================================
// INTENT DETECTION
// ============================================

export const INTENT = {
  /** User is accepting a proposed time */
  ACCEPT: 'accept',
  /** User is declining the meeting */
  DECLINE: 'decline',
  /** User is proposing alternative times */
  COUNTER_PROPOSE: 'counter_propose',
  /** User is asking a question */
  QUESTION: 'question',
  /** User wants to change an existing meeting */
  RESCHEDULE: 'reschedule',
  /** User is delegating to someone else */
  DELEGATE: 'delegate',
  /** User appears confused or is correcting us */
  CONFUSED: 'confused',
  /** Intent cannot be determined */
  UNCLEAR: 'unclear',
} as const;

export type SchedulingIntent = (typeof INTENT)[keyof typeof INTENT];

// ============================================
// SCHEDULING STATUS
// ============================================

export const STATUS = {
  INITIATED: 'initiated',
  PROPOSING: 'proposing',
  AWAITING_RESPONSE: 'awaiting_response',
  NEGOTIATING: 'negotiating',
  CONFIRMED: 'confirmed',
  REMINDER_SENT: 'reminder_sent',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
  NO_SHOW: 'no_show',
} as const;

// Note: SchedulingStatus type is exported from ../types.ts to avoid conflicts

// ============================================
// ERROR CODES
// ============================================

export const ERROR_CODES = {
  NO_PRIMARY_CONTACT: 'NO_PRIMARY_CONTACT',
  INVALID_TIMEZONE: 'INVALID_TIMEZONE',
  NO_AVAILABLE_SLOTS: 'NO_AVAILABLE_SLOTS',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  CALENDAR_ERROR: 'CALENDAR_ERROR',
  AI_PARSING_ERROR: 'AI_PARSING_ERROR',
  MAX_ATTEMPTS_REACHED: 'MAX_ATTEMPTS_REACHED',
  REQUEST_NOT_FOUND: 'REQUEST_NOT_FOUND',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
