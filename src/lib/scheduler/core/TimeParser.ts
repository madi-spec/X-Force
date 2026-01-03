/**
 * TimeParser - Single Source of Truth for Time Parsing
 *
 * ALL time parsing in the scheduler flows through this module.
 * No exceptions. Ever.
 *
 * This module handles:
 * - Natural language time parsing ("2pm on Monday")
 * - Timezone normalization and conversion
 * - Year inference for ambiguous dates
 * - Matching responses to proposed times
 */

import { callAIJson } from '@/lib/ai/core/aiClient';
import { formatForDisplay } from '../timezone';
import {
  isValidTimezone,
  createTaggedTimestamp,
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
// DATE CONTEXT HELPERS
// ============================================

/**
 * Build date context for AI prompts
 */
function buildDateContext(timezone: string, referenceDate?: Date): {
  todayFormatted: string;
  yearGuidance: string;
  currentYear: number;
  nextYear: number;
} {
  const today = referenceDate || new Date();
  const currentYear = today.getFullYear();
  const nextYear = currentYear + 1;
  const currentMonth = today.getMonth() + 1;

  const todayFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });

  // Year guidance for when we're in late year
  let yearGuidance = '';
  if (currentMonth === 12) {
    yearGuidance = `
CRITICAL DATE RULES (Today is ${todayFormatted}):
- We are in DECEMBER ${currentYear}. Any mention of January, February, or March means ${nextYear}.
- When someone says "Monday the 5th" or similar, find the future date where the 5th falls on (or near) that day.
- January 6, ${nextYear} is a Monday - so "Monday the 6th" = ${nextYear}-01-06
- NEVER return dates in ${currentYear} for January/February/March - those months have already passed.
- All timestamps must be in the FUTURE.`;
  } else if (currentMonth === 1) {
    yearGuidance = `
CRITICAL DATE RULES (Today is ${todayFormatted}):
- We are in JANUARY ${currentYear}.
- When someone says "Monday the 6th" and today is early January, check if Jan 6 is Monday.
- All timestamps must be in the FUTURE from today.`;
  } else if (currentMonth >= 10) {
    yearGuidance = `Note: Today is ${todayFormatted}. If they mention January/February/March, use ${nextYear}.`;
  }

  return { todayFormatted, yearGuidance, currentYear, nextYear };
}

/**
 * Get AI instructions for timestamp handling
 */
function getAITimestampInstructions(timezone: string): string {
  return `
TIMESTAMP RULES:
1. Return times in the user's LOCAL timezone (${timezone}), NOT UTC.
2. Format: "YYYY-MM-DDTHH:MM:SS" (no Z suffix, as it's local time).
3. If they say "2pm", return 14:00:00 in their timezone.
4. Always include the timezone in your response object.
5. For ambiguous times like "10:30", assume AM for business hours.
6. The date number takes priority: "Monday the 5th" means find when the 5th is on/near Monday.`;
}

// ============================================
// MAIN PARSING FUNCTION
// ============================================

/**
 * Parse a single time expression from human input
 *
 * This is THE function for parsing times. All paths use this.
 */
export async function parseTime(
  input: string,
  context: TimeParseContext
): Promise<TimeParseResult> {
  const effectiveTimezone = isValidTimezone(context.timezone)
    ? context.timezone
    : DEFAULT_BUSINESS_HOURS.timezone;

  console.log(`[TimeParser] Parsing: "${input}" in timezone ${effectiveTimezone}`);

  if (!input || input.trim().length === 0) {
    return {
      success: false,
      time: null,
      error: 'Empty input provided',
    };
  }

  const { todayFormatted, yearGuidance, currentYear, nextYear } =
    buildDateContext(effectiveTimezone, context.referenceDate);

  const prompt = `Parse this time expression and return the exact date and time.

TODAY'S DATE: ${todayFormatted}
USER'S TIMEZONE: ${effectiveTimezone}
${yearGuidance}

${getAITimestampInstructions(effectiveTimezone)}

TIME EXPRESSION TO PARSE: "${input}"

${context.emailBody ? `ADDITIONAL CONTEXT FROM EMAIL:\n${context.emailBody.slice(0, 500)}` : ''}

${context.proposedTimes && context.proposedTimes.length > 0 ? `
PREVIOUSLY PROPOSED TIMES:
${context.proposedTimes.map((t, i) => `${i + 1}. ${t.display}`).join('\n')}
If the input refers to "the first one", "option 1", "the second time", etc., match to these.
` : ''}

Parse the time expression and determine:
1. What specific date and time does this refer to?
2. How confident are you in this interpretation?`;

  try {
    const response = await callAIJson<{
      localDateTime: string;
      timezone: string;
      displayText: string;
      confidence: 'high' | 'medium' | 'low';
      reasoning: string;
      matchedProposedIndex?: number;
    }>({
      prompt,
      systemPrompt: `You are an expert at parsing natural language time expressions for scheduling meetings.

Your job is to convert human expressions like "2pm on Monday" or "next Tuesday at 3" into precise timestamps.

CRITICAL RULES:
1. Always return times in the user's LOCAL timezone, not UTC.
2. The date number takes priority: "Monday the 5th" means find when the 5th falls on/near Monday.
3. For bare times like "2pm", you need context about which day - if no day given, use "unclear" confidence.
4. Business hours are ${DEFAULT_BUSINESS_HOURS.start}AM-${DEFAULT_BUSINESS_HOURS.end}PM. "10:30" means 10:30 AM.
5. All dates MUST be in the future from today.

Return JSON in this exact format:
{
  "localDateTime": "2026-01-06T14:00:00",
  "timezone": "America/New_York",
  "displayText": "Monday, January 6 at 2:00 PM ET",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation of how you interpreted this",
  "matchedProposedIndex": 0  // Only if matching a proposed time (0-indexed)
}`,
      schema: `{
        "localDateTime": "ISO timestamp in LOCAL time (YYYY-MM-DDTHH:MM:SS, no Z)",
        "timezone": "IANA timezone string",
        "displayText": "Human readable string like 'Monday, January 6 at 2:00 PM ET'",
        "confidence": "high|medium|low",
        "reasoning": "Why you interpreted it this way",
        "matchedProposedIndex": "Optional index if matching a proposed time"
      }`,
      maxTokens: 500,
      temperature: 0.2,
    });

    const data = response.data;

    // Validate the returned timezone
    const returnedTimezone = isValidTimezone(data.timezone)
      ? data.timezone
      : effectiveTimezone;

    // Create UTC date from local time
    let utcDate: Date | null = null;
    let tagged: TaggedTimestamp | undefined;

    try {
      tagged = createTaggedTimestamp(data.localDateTime, returnedTimezone);
      utcDate = new Date(tagged.utc);
    } catch (err) {
      console.warn(`[TimeParser] Failed to create tagged timestamp: ${err}`);
    }

    // Validate it's in the future
    if (utcDate && utcDate <= new Date()) {
      console.warn(`[TimeParser] Parsed date is in the past: ${utcDate.toISOString()}`);
      // Attempt to fix by adding a year if it's close
      const withYear = new Date(utcDate);
      withYear.setFullYear(withYear.getFullYear() + 1);
      if (withYear > new Date()) {
        utcDate = withYear;
        try {
          tagged = createTaggedTimestamp(
            data.localDateTime.replace(`${currentYear}`, `${nextYear}`),
            returnedTimezone
          );
        } catch {
          // Keep original tagged if this fails
        }
      }
    }

    const parsedTime: ParsedTime = {
      raw: input,
      utc: utcDate,
      display: data.displayText,
      timezone: returnedTimezone,
      confidence: data.confidence,
      reasoning: data.reasoning,
      wasConverted: false,
      tagged,
    };

    console.log(`[TimeParser] Parsed successfully:`, {
      input,
      utc: utcDate?.toISOString(),
      display: data.displayText,
      confidence: data.confidence,
    });

    return {
      success: true,
      time: parsedTime,
    };
  } catch (err) {
    console.error(`[TimeParser] AI parsing failed:`, err);
    return {
      success: false,
      time: null,
      error: `AI parsing failed: ${err}`,
    };
  }
}

/**
 * Parse multiple time expressions
 */
export async function parseTimes(
  inputs: string[],
  context: TimeParseContext
): Promise<MultiTimeParseResult> {
  console.log(`[TimeParser] Parsing ${inputs.length} time expressions`);

  const results: ParsedTime[] = [];
  const errors: string[] = [];

  for (const input of inputs) {
    const result = await parseTime(input, context);
    if (result.success && result.time) {
      results.push(result.time);
    } else if (result.error) {
      errors.push(`"${input}": ${result.error}`);
    }
  }

  return {
    success: results.length > 0,
    times: results,
    errors,
  };
}

/**
 * Extract time expressions from free-form text (like an email body)
 */
export async function extractTimesFromText(
  text: string,
  context: TimeParseContext
): Promise<MultiTimeParseResult> {
  console.log(`[TimeParser] Extracting times from text (${text.length} chars)`);

  const effectiveTimezone = isValidTimezone(context.timezone)
    ? context.timezone
    : DEFAULT_BUSINESS_HOURS.timezone;

  const { todayFormatted, yearGuidance } = buildDateContext(
    effectiveTimezone,
    context.referenceDate
  );

  const prompt = `Extract all time/date expressions from this email text.

TODAY'S DATE: ${todayFormatted}
USER'S TIMEZONE: ${effectiveTimezone}
${yearGuidance}

EMAIL TEXT:
${text}

Find ALL mentions of specific times, dates, or scheduling-related expressions like:
- "2pm on Monday"
- "next Tuesday"
- "January 15th at 3:00"
- "the morning of the 5th"
- "Wednesday works for me"
- "how about 10:30?"

Do NOT include:
- Generic time references ("sometime next week", "in the afternoon")
- Past dates or historical references
- Purely hypothetical times`;

  try {
    const response = await callAIJson<{
      timeExpressions: Array<{
        text: string;
        localDateTime: string;
        timezone: string;
        displayText: string;
        confidence: 'high' | 'medium' | 'low';
      }>;
      reasoning: string;
    }>({
      prompt,
      systemPrompt: `You extract specific time/date expressions from text for scheduling purposes.
Return each expression with its parsed timestamp in the user's local timezone.`,
      schema: `{
        "timeExpressions": [{
          "text": "Original text snippet",
          "localDateTime": "YYYY-MM-DDTHH:MM:SS in local time",
          "timezone": "IANA timezone",
          "displayText": "Human readable"
        }],
        "reasoning": "Summary of what you found"
      }`,
      maxTokens: 1000,
      temperature: 0.2,
    });

    const times: ParsedTime[] = [];
    const errors: string[] = [];

    for (const expr of response.data.timeExpressions) {
      try {
        const returnedTimezone = isValidTimezone(expr.timezone)
          ? expr.timezone
          : effectiveTimezone;

        const tagged = createTaggedTimestamp(expr.localDateTime, returnedTimezone);
        const utcDate = new Date(tagged.utc);

        // Skip past dates
        if (utcDate <= new Date()) {
          console.log(`[TimeParser] Skipping past date: ${expr.text}`);
          continue;
        }

        times.push({
          raw: expr.text,
          utc: utcDate,
          display: expr.displayText,
          timezone: returnedTimezone,
          confidence: expr.confidence,
          reasoning: response.data.reasoning,
          wasConverted: false,
          tagged,
        });
      } catch (err) {
        errors.push(`"${expr.text}": Failed to parse - ${err}`);
      }
    }

    console.log(`[TimeParser] Extracted ${times.length} valid times from text`);

    return {
      success: times.length > 0,
      times,
      errors,
    };
  } catch (err) {
    console.error(`[TimeParser] Extraction failed:`, err);
    return {
      success: false,
      times: [],
      errors: [`Failed to extract times: ${err}`],
    };
  }
}

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
      const date = new Date(t.utc);
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
