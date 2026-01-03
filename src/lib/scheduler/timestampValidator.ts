/**
 * Timestamp Validation Layer
 *
 * Catches conversion errors before they happen.
 * This prevents the "2pm becomes 6am" bug by validating that:
 * 1. Times are during business hours
 * 2. Times are on weekdays
 * 3. Times are in the future
 * 4. UTC conversion offsets are sensible
 */

import {
  TaggedTimestamp,
  formatTaggedForDisplay,
  getTaggedLocalHour,
  getTaggedLocalDayOfWeek,
  isTaggedInFuture
} from './taggedTimestamp';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

export interface ValidationContext {
  userTimezone: string;
  businessHoursStart?: number; // Default: 9
  businessHoursEnd?: number;   // Default: 17
  allowWeekends?: boolean;     // Default: false
  minHoursInFuture?: number;   // Default: 1
}

/**
 * Expected UTC offsets for common US timezones
 * Includes both standard and daylight saving time
 */
const EXPECTED_OFFSETS: Record<string, number[]> = {
  // US Timezones
  'America/New_York': [-5, -4],      // EST/EDT
  'America/Chicago': [-6, -5],        // CST/CDT
  'America/Denver': [-7, -6],         // MST/MDT
  'America/Los_Angeles': [-8, -7],    // PST/PDT
  'America/Phoenix': [-7],            // No DST
  'America/Anchorage': [-9, -8],      // AKST/AKDT
  'Pacific/Honolulu': [-10],          // HST, no DST

  // Other common timezones
  'Europe/London': [0, 1],            // GMT/BST
  'Europe/Paris': [1, 2],             // CET/CEST
  'Europe/Berlin': [1, 2],            // CET/CEST
  'Asia/Tokyo': [9],                  // JST, no DST
  'Asia/Shanghai': [8],               // CST, no DST
  'Australia/Sydney': [10, 11],       // AEST/AEDT
  'UTC': [0],
};

/**
 * Validate that a timestamp makes sense before using it
 * This catches the "2pm becomes 6am" bug
 */
export function validateProposedTime(
  ts: TaggedTimestamp,
  context: ValidationContext
): ValidationResult {
  const {
    businessHoursStart = 9,
    businessHoursEnd = 17,
    allowWeekends = false,
    minHoursInFuture = 1
  } = context;

  const localHour = getTaggedLocalHour(ts);
  const dayOfWeek = getTaggedLocalDayOfWeek(ts);

  // Check 1: Is this during business hours in the LOCAL timezone?
  if (localHour < businessHoursStart || localHour >= businessHoursEnd) {
    return {
      valid: false,
      error: `Time ${localHour}:00 is outside business hours (${businessHoursStart}:00-${businessHoursEnd}:00 ${ts.timezone})`
    };
  }

  // Check 2: Is this on a weekday?
  if (!allowWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      valid: false,
      error: `${dayNames[dayOfWeek]} is not a business day`
    };
  }

  // Check 3: Is this in the future?
  if (!isTaggedInFuture(ts, minHoursInFuture * 60)) {
    return {
      valid: false,
      error: `This time is in the past or less than ${minHoursInFuture} hour(s) from now`
    };
  }

  // Check 4: Sanity check - does the UTC conversion make sense?
  const utcDate = new Date(ts.utc);
  const utcHour = utcDate.getUTCHours();

  // Calculate actual offset
  let actualOffset = localHour - utcHour;
  // Normalize to -12 to +12 range
  if (actualOffset > 12) actualOffset -= 24;
  if (actualOffset < -12) actualOffset += 24;

  // If local is 2pm (14:00) EST, UTC should be 7pm (19:00)
  // So offset should be -5 (EST) or -4 (EDT)
  // If UTC hour equals local hour and we're not in UTC timezone, something is wrong
  if (ts.timezone !== 'UTC' && actualOffset === 0) {
    return {
      valid: false,
      error: `Timezone conversion error: local ${localHour}:00 ${ts.timezone} should not equal UTC ${utcHour}:00`
    };
  }

  // Check 5: Is the offset reasonable for this timezone?
  if (EXPECTED_OFFSETS[ts.timezone]) {
    if (!EXPECTED_OFFSETS[ts.timezone].includes(actualOffset)) {
      return {
        valid: false,
        error: `Unexpected UTC offset for ${ts.timezone}: got ${actualOffset} hours, expected ${EXPECTED_OFFSETS[ts.timezone].join(' or ')}`
      };
    }
  }

  return { valid: true };
}

/**
 * Validate a batch of proposed times
 */
export function validateProposedTimes(
  times: TaggedTimestamp[],
  context: ValidationContext
): { valid: TaggedTimestamp[]; invalid: Array<{ ts: TaggedTimestamp; error: string }> } {
  const valid: TaggedTimestamp[] = [];
  const invalid: Array<{ ts: TaggedTimestamp; error: string }> = [];

  for (const ts of times) {
    const result = validateProposedTime(ts, context);
    if (result.valid) {
      valid.push(ts);
    } else {
      invalid.push({ ts, error: result.error || 'Unknown validation error' });
    }
  }

  return { valid, invalid };
}

/**
 * Log timestamp conversions for debugging
 */
export function logTimestampConversion(
  operation: string,
  input: unknown,
  output: TaggedTimestamp,
  context?: ValidationContext
): void {
  console.log(`[Timestamp] ${operation}:`);
  console.log(`  Input: ${JSON.stringify(input)}`);
  console.log(`  Local: ${output.localDateTime} (${output.timezone})`);
  console.log(`  UTC:   ${output.utc}`);
  console.log(`  Display: ${formatTaggedForDisplay(output)}`);

  // Sanity check
  const validation = validateProposedTime(output, {
    userTimezone: output.timezone,
    businessHoursStart: 6,  // Wider range for logging
    businessHoursEnd: 22,
    ...context
  });

  if (!validation.valid) {
    console.error(`  ⚠️ VALIDATION FAILED: ${validation.error}`);
  } else {
    console.log(`  ✓ Validation passed`);
  }
}

/**
 * Detect if a bare timestamp was mistakenly treated as UTC
 *
 * Example: "2025-01-06T14:00:00" should be local time, not UTC.
 * If treated as UTC, it would be 9am EST instead of 2pm EST.
 */
export function detectMistreatedBareTimestamp(
  originalInput: string,
  resultUtc: string,
  expectedTimezone: string
): { likely: boolean; explanation: string } {
  // If input had Z or offset, it was explicit - no issue
  if (originalInput.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(originalInput)) {
    return { likely: false, explanation: 'Input had explicit timezone indicator' };
  }

  // Check if UTC equals input (would mean bare was treated as UTC)
  const inputWithoutZ = originalInput.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
  const utcWithoutZ = resultUtc.replace(/Z$/, '').replace(/\.\d{3}Z$/, '');

  if (inputWithoutZ === utcWithoutZ) {
    return {
      likely: true,
      explanation: `Bare timestamp "${originalInput}" appears to have been treated as UTC. ` +
        `For timezone ${expectedTimezone}, the UTC equivalent should differ.`
    };
  }

  return { likely: false, explanation: 'Conversion appears correct' };
}

/**
 * Suggest the correct interpretation of a timestamp
 */
export function suggestCorrectInterpretation(
  timestamp: string,
  context: {
    prospectTimezone?: string;
    userTimezone: string;
    emailContent?: string;
  }
): {
  interpretation: 'utc' | 'prospect_local' | 'user_local' | 'ambiguous';
  recommendedTimezone: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
} {
  // If timestamp has Z suffix, it's definitively UTC
  if (timestamp.endsWith('Z')) {
    return {
      interpretation: 'utc',
      recommendedTimezone: 'UTC',
      confidence: 'high',
      reasoning: 'Timestamp has Z suffix indicating UTC'
    };
  }

  // If timestamp has offset, parse it
  const offsetMatch = timestamp.match(/([+-])(\d{2}):(\d{2})$/);
  if (offsetMatch) {
    const offsetHours = parseInt(offsetMatch[2], 10) * (offsetMatch[1] === '-' ? -1 : 1);
    // Find matching timezone
    for (const [tz, offsets] of Object.entries(EXPECTED_OFFSETS)) {
      if (offsets.includes(offsetHours)) {
        return {
          interpretation: 'prospect_local',
          recommendedTimezone: tz,
          confidence: 'medium',
          reasoning: `Offset ${offsetMatch[0]} matches ${tz}`
        };
      }
    }
  }

  // Bare timestamp - need context
  if (context.prospectTimezone) {
    return {
      interpretation: 'prospect_local',
      recommendedTimezone: context.prospectTimezone,
      confidence: 'high',
      reasoning: 'Bare timestamp should be interpreted in prospect timezone'
    };
  }

  return {
    interpretation: 'ambiguous',
    recommendedTimezone: context.userTimezone,
    confidence: 'low',
    reasoning: 'No timezone indicator and no prospect timezone known - defaulting to user timezone'
  };
}

/**
 * Check if a meeting time slot is still available
 * (hasn't become stale since proposal)
 */
export function isSlotStillValid(
  proposedAt: Date,
  slotTime: TaggedTimestamp,
  maxStalenessHours: number = 24
): { valid: boolean; reason?: string } {
  const now = new Date();
  const slotDate = new Date(slotTime.utc);

  // Check if slot is in the past
  if (slotDate.getTime() < now.getTime()) {
    return {
      valid: false,
      reason: 'Slot time has passed'
    };
  }

  // Check if proposal is too old
  const proposalAgeMs = now.getTime() - proposedAt.getTime();
  const maxStalenessMs = maxStalenessHours * 60 * 60 * 1000;

  if (proposalAgeMs > maxStalenessMs) {
    return {
      valid: false,
      reason: `Proposal is ${Math.round(proposalAgeMs / (60 * 60 * 1000))} hours old - availability may have changed`
    };
  }

  return { valid: true };
}

/**
 * Format validation errors for user display
 */
export function formatValidationError(error: string): string {
  // Make error messages more user-friendly
  return error
    .replace(/\d{2}:\d{2}/g, match => {
      const hour = parseInt(match.split(':')[0], 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${match.split(':')[1]} ${ampm}`;
    })
    .replace(/America\/New_York/g, 'Eastern Time')
    .replace(/America\/Chicago/g, 'Central Time')
    .replace(/America\/Denver/g, 'Mountain Time')
    .replace(/America\/Los_Angeles/g, 'Pacific Time');
}
