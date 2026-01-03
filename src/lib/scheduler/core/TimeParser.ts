/**
 * TimeParser - Utility Functions for Time Handling
 *
 * This module provides:
 * - matchToProposedTime(): Match user responses to proposed times
 * - validateParsedTime(): Validate parsed times for scheduling
 * - formatParsedTimeForEmail(): Format times for email display
 *
 * NOTE: AI-based time parsing is now handled by the managed prompt
 * 'scheduler_response_parsing' in responseProcessor.ts.
 * The old parseTime() and extractTimesFromText() functions have been removed.
 */

import { formatForDisplay } from '../timezone';
import {
  formatTaggedForDisplay,
  type TaggedTimestamp,
} from '../taggedTimestamp';
import { TIMING, DEFAULT_BUSINESS_HOURS } from './constants';

// ============================================
// TYPES
// ============================================

export interface ParsedTime {
  /** Original input string */
  raw: string;
  /** Parsed UTC timestamp */
  utc: Date | null;
  /** Human-readable display string in user's timezone */
  display: string;
  /** Timezone used for interpretation */
  timezone: string;
  /** Parsing confidence */
  confidence: 'high' | 'medium' | 'low';
  /** AI's reasoning for this interpretation */
  reasoning: string;
  /** Was this converted from a bare timestamp? */
  wasConverted: boolean;
  /** Tagged timestamp for tracing */
  tagged?: TaggedTimestamp;
}

export interface TimeParseContext {
  /** User's timezone (e.g., "America/New_York") */
  timezone: string;
  /** Additional context from email body */
  emailBody?: string;
  /** Reference date for relative terms like "next Monday" */
  referenceDate?: Date;
  /** Previously proposed times (for matching "the first one", etc.) */
  proposedTimes?: Array<{ utc: string; display: string }>;
}

export interface TimeParseResult {
  success: boolean;
  time: ParsedTime | null;
  error?: string;
}

export interface MultiTimeParseResult {
  success: boolean;
  times: ParsedTime[];
  errors: string[];
}

// ============================================
// PROPOSED TIME MATCHING
// ============================================

/**
 * Match a response against previously proposed times
 * Used when someone says "the first one works" or "Tuesday works"
 */
export function matchToProposedTime(
  response: string,
  proposedTimes: Array<{ utc: string; display: string }>,
  context: TimeParseContext
): ParsedTime | null {
  if (!proposedTimes || proposedTimes.length === 0) {
    return null;
  }

  const normalized = response.toLowerCase().trim();
  console.log(`[TimeParser] Matching response "${normalized}" to ${proposedTimes.length} proposed times`);

  // Check for ordinal references
  const ordinalPatterns: Array<{ pattern: RegExp; index: number }> = [
    { pattern: /\b(first|option\s*1|#1|1st)\b/i, index: 0 },
    { pattern: /\b(second|option\s*2|#2|2nd)\b/i, index: 1 },
    { pattern: /\b(third|option\s*3|#3|3rd)\b/i, index: 2 },
    { pattern: /\b(fourth|option\s*4|#4|4th)\b/i, index: 3 },
  ];

  for (const { pattern, index } of ordinalPatterns) {
    if (pattern.test(normalized) && proposedTimes[index]) {
      const match = proposedTimes[index];
      console.log(`[TimeParser] Matched ordinal "${pattern}" to index ${index}`);
      return {
        raw: response,
        utc: new Date(match.utc),
        display: match.display,
        timezone: context.timezone,
        confidence: 'high',
        reasoning: `Matched ordinal reference to proposed time #${index + 1}`,
        wasConverted: false,
      };
    }
  }

  // Check for day name matches
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (const dayName of dayNames) {
    if (normalized.includes(dayName)) {
      const matchingTime = proposedTimes.find((t) =>
        t.display.toLowerCase().includes(dayName)
      );
      if (matchingTime) {
        console.log(`[TimeParser] Matched day name "${dayName}"`);
        return {
          raw: response,
          utc: new Date(matchingTime.utc),
          display: matchingTime.display,
          timezone: context.timezone,
          confidence: 'high',
          reasoning: `Matched "${dayName}" to proposed time`,
          wasConverted: false,
        };
      }
    }
  }

  // Check for time-specific matches (e.g., "2pm", "2:00")
  const timeMatch = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const ampm = timeMatch[3]?.toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;

    // Find a proposed time with matching hour
    const matchingTime = proposedTimes.find((t) => {
      // This is approximate - proper timezone handling would need more work
      return t.display.includes(`${hour % 12 || 12}:`) ||
        t.display.includes(`${hour}:`);
    });

    if (matchingTime) {
      console.log(`[TimeParser] Matched time "${timeMatch[0]}"`);
      return {
        raw: response,
        utc: new Date(matchingTime.utc),
        display: matchingTime.display,
        timezone: context.timezone,
        confidence: 'medium',
        reasoning: `Matched time "${timeMatch[0]}" to proposed time`,
        wasConverted: false,
      };
    }
  }

  console.log(`[TimeParser] No match found for response`);
  return null;
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate a parsed time is usable for scheduling
 */
export function validateParsedTime(
  time: ParsedTime,
  options: {
    minHoursInFuture?: number;
    businessHoursStart?: number;
    businessHoursEnd?: number;
    allowWeekends?: boolean;
  } = {}
): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const {
    minHoursInFuture = TIMING.MIN_HOURS_IN_FUTURE,
    businessHoursStart = DEFAULT_BUSINESS_HOURS.start,
    businessHoursEnd = DEFAULT_BUSINESS_HOURS.end,
    allowWeekends = false,
  } = options;

  if (!time.utc) {
    issues.push('No valid UTC timestamp');
    return { valid: false, issues };
  }

  const now = new Date();
  const minFutureDate = new Date(now.getTime() + minHoursInFuture * 60 * 60 * 1000);

  // Check if in future
  if (time.utc < minFutureDate) {
    issues.push(`Time must be at least ${minHoursInFuture} hour(s) in the future`);
  }

  // Check business hours (approximate check based on display string)
  const hourMatch = time.display.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (hourMatch) {
    let hour = parseInt(hourMatch[1], 10);
    const ampm = hourMatch[3].toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    if (hour < businessHoursStart || hour >= businessHoursEnd) {
      issues.push(
        `Time is outside business hours (${businessHoursStart}AM-${businessHoursEnd % 12 || 12}PM)`
      );
    }
  }

  // Check weekends
  if (!allowWeekends) {
    const dayOfWeek = time.utc.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      issues.push('Time falls on a weekend');
    }
  }

  // Check confidence level
  if (time.confidence === 'low') {
    issues.push('Low confidence in time interpretation');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// ============================================
// FORMATTING
// ============================================

/**
 * Format a parsed time for email display
 */
export function formatParsedTimeForEmail(
  time: ParsedTime,
  timezone?: string
): string {
  if (!time.utc) {
    return time.display || time.raw;
  }

  // Use tagged timestamp if available for accurate formatting
  if (time.tagged) {
    return formatTaggedForDisplay(time.tagged);
  }

  const tz = timezone || time.timezone;
  return formatForDisplay(time.utc, tz);
}
