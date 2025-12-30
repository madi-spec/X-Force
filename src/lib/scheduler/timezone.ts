/**
 * Centralized Timezone Utility for Scheduler
 *
 * This module provides consistent timezone handling across all scheduler operations.
 *
 * CORE PRINCIPLES:
 * 1. All database storage uses UTC (ISO 8601 with Z suffix)
 * 2. All user-facing times are converted to/from user's timezone
 * 3. AI parsing assumes user's timezone, then converts to UTC
 * 4. Never use bare new Date() for user-visible times
 *
 * DEFAULT TIMEZONE: America/New_York (Eastern Time)
 */

export const DEFAULT_TIMEZONE = 'America/New_York';

// Microsoft Graph API timezone name mapping
const MS_TIMEZONE_MAP: Record<string, string> = {
  'Eastern Standard Time': 'America/New_York',
  'Eastern Daylight Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Central Daylight Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'Mountain Daylight Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Pacific Daylight Time': 'America/Los_Angeles',
  'UTC': 'UTC',
  'GMT': 'UTC',
};

/**
 * Normalize timezone string to IANA format
 */
export function normalizeTimezone(tz: string | undefined | null): string {
  if (!tz) return DEFAULT_TIMEZONE;

  // Check MS timezone map
  if (MS_TIMEZONE_MAP[tz]) {
    return MS_TIMEZONE_MAP[tz];
  }

  // Already IANA format
  return tz;
}

/**
 * Get the UTC offset in hours for a given timezone at a specific date
 * Accounts for DST
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): number {
  const tz = normalizeTimezone(timezone);

  // Get the time in the target timezone
  const tzTime = new Date(date.toLocaleString('en-US', { timeZone: tz }));

  // Get the time in UTC
  const utcTime = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));

  // Difference in hours
  return (tzTime.getTime() - utcTime.getTime()) / (1000 * 60 * 60);
}

/**
 * Parse a local time string (like "2026-01-05T14:00:00") in a specific timezone
 * and return a UTC Date object.
 *
 * This is the KEY function for fixing the timezone bug.
 * When AI returns "2026-01-05T14:00:00" meaning 2pm in user's timezone,
 * this converts it to the correct UTC time.
 *
 * @param localTimeString - ISO-like string WITHOUT timezone (e.g., "2026-01-05T14:00:00")
 * @param timezone - The timezone the local time is in (e.g., "America/New_York")
 * @returns Date object in UTC
 */
export function parseLocalTimeToUTC(localTimeString: string, timezone: string): Date {
  const tz = normalizeTimezone(timezone);

  // If already has Z or offset, parse directly
  if (localTimeString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(localTimeString)) {
    return new Date(localTimeString);
  }

  // Parse the components from the local time string
  const match = localTimeString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    console.warn('[parseLocalTimeToUTC] Could not parse time string:', localTimeString);
    return new Date(localTimeString);
  }

  const [, year, month, day, hour, minute, second = '00'] = match;

  // Create a date object for this local time to calculate the offset
  // We need to figure out what UTC time corresponds to this local time
  const tempDate = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );

  // Get the offset for this timezone at this approximate time
  const offsetHours = getTimezoneOffset(tz, tempDate);

  // Create the UTC time by subtracting the offset
  const utcTime = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour) - offsetHours,
    parseInt(minute),
    parseInt(second)
  ));

  return utcTime;
}

/**
 * Convert a UTC Date to an ISO string in a specific timezone
 * Returns format like "2026-01-05T14:00:00" (local time, no Z)
 */
export function formatUTCToLocal(utcDate: Date, timezone: string): string {
  const tz = normalizeTimezone(timezone);

  const year = utcDate.toLocaleDateString('en-US', { year: 'numeric', timeZone: tz });
  const month = String(parseInt(utcDate.toLocaleDateString('en-US', { month: 'numeric', timeZone: tz }))).padStart(2, '0');
  const day = String(parseInt(utcDate.toLocaleDateString('en-US', { day: 'numeric', timeZone: tz }))).padStart(2, '0');
  const hour = String(parseInt(utcDate.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: tz }))).padStart(2, '0');
  const minute = String(parseInt(utcDate.toLocaleTimeString('en-US', { minute: 'numeric', timeZone: tz }))).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:00`;
}

/**
 * Format a UTC Date for display to users in their timezone
 * Returns human-readable string like "Monday, January 5 at 2:00 PM EST"
 */
export function formatForDisplay(
  utcDate: Date,
  timezone: string,
  options?: {
    includeDate?: boolean;
    includeTime?: boolean;
    includeTimezone?: boolean;
    includeYear?: boolean;
  }
): string {
  const tz = normalizeTimezone(timezone);
  const opts = {
    includeDate: true,
    includeTime: true,
    includeTimezone: true,
    includeYear: false,
    ...options,
  };

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
  };

  if (opts.includeDate) {
    formatOptions.weekday = 'long';
    formatOptions.month = 'long';
    formatOptions.day = 'numeric';
    if (opts.includeYear) {
      formatOptions.year = 'numeric';
    }
  }

  if (opts.includeTime) {
    formatOptions.hour = 'numeric';
    formatOptions.minute = '2-digit';
  }

  if (opts.includeTimezone) {
    formatOptions.timeZoneName = 'short';
  }

  return new Intl.DateTimeFormat('en-US', formatOptions).format(utcDate);
}

/**
 * Format a UTC Date for Microsoft Graph API
 * Graph API expects datetime without Z suffix in the timezone specified separately
 */
export function formatForGraphAPI(utcDate: Date, timezone: string): string {
  return formatUTCToLocal(utcDate, timezone);
}

/**
 * Get the current time as a Date object, adjusted for a specific timezone
 * This returns a Date that, when formatted in that timezone, shows "now"
 */
export function getNow(): Date {
  return new Date();
}

/**
 * Get today's date components in a specific timezone
 */
export function getTodayInTimezone(timezone: string): { year: number; month: number; day: number; dayOfWeek: number } {
  const tz = normalizeTimezone(timezone);
  const now = new Date();

  return {
    year: parseInt(now.toLocaleDateString('en-US', { year: 'numeric', timeZone: tz })),
    month: parseInt(now.toLocaleDateString('en-US', { month: 'numeric', timeZone: tz })),
    day: parseInt(now.toLocaleDateString('en-US', { day: 'numeric', timeZone: tz })),
    dayOfWeek: getDayOfWeek(now, tz),
  };
}

/**
 * Get the day of week (0=Sunday, 6=Saturday) for a Date in a specific timezone
 */
export function getDayOfWeek(date: Date, timezone: string): number {
  const tz = normalizeTimezone(timezone);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz });
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days.indexOf(dayName);
}

/**
 * Get the day name for a Date in a specific timezone
 */
export function getDayName(date: Date, timezone: string): string {
  const tz = normalizeTimezone(timezone);
  return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz });
}

/**
 * Check if a date is in the past (comparing in a specific timezone)
 */
export function isInPast(date: Date, timezone: string): boolean {
  const now = new Date();
  return date.getTime() < now.getTime();
}

/**
 * Check if a date is today in a specific timezone
 */
export function isToday(date: Date, timezone: string): boolean {
  const tz = normalizeTimezone(timezone);
  const now = new Date();

  const dateStr = date.toLocaleDateString('en-US', { timeZone: tz });
  const todayStr = now.toLocaleDateString('en-US', { timeZone: tz });

  return dateStr === todayStr;
}

/**
 * Add hours to a Date
 */
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Add minutes to a Date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Add days to a Date
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Create a Date from components in a specific timezone
 * Returns a UTC Date that represents the given local time
 */
export function createDateInTimezone(
  year: number,
  month: number, // 1-indexed (1=January)
  day: number,
  hour: number,
  minute: number,
  timezone: string
): Date {
  const localTimeString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  return parseLocalTimeToUTC(localTimeString, timezone);
}

/**
 * Get the timezone abbreviation (EST, EDT, PST, etc.) for a date
 */
export function getTimezoneAbbreviation(date: Date, timezone: string): string {
  const tz = normalizeTimezone(timezone);
  const formatted = date.toLocaleString('en-US', {
    timeZone: tz,
    timeZoneName: 'short',
  });

  // Extract the timezone abbreviation (last word)
  const match = formatted.match(/\s([A-Z]{2,4})$/);
  return match ? match[1] : 'ET';
}

/**
 * Build AI prompt context for date parsing
 * This provides the AI with all the information it needs to correctly parse times
 */
export function buildDateContextForAI(timezone: string): {
  todayFormatted: string;
  currentYear: number;
  nextYear: number;
  currentMonth: number;
  yearGuidance: string;
  timezoneInfo: string;
} {
  const tz = normalizeTimezone(timezone);
  const today = getTodayInTimezone(tz);
  const currentYear = today.year;
  const nextYear = currentYear + 1;
  const currentMonth = today.month;

  const todayFormatted = formatForDisplay(new Date(), tz, {
    includeDate: true,
    includeTime: false,
    includeTimezone: false,
    includeYear: true,
  });

  let yearGuidance = '';
  if (currentMonth === 12) {
    yearGuidance = `CRITICAL: Today is ${todayFormatted}. We are in DECEMBER ${currentYear}.
- ANY date in January, February, or March MUST use year ${nextYear} (NOT ${currentYear})
- January ${currentYear} is IN THE PAST and invalid
- January ${nextYear} is the NEXT January and correct`;
  } else if (currentMonth >= 10) {
    yearGuidance = `Since we're in month ${currentMonth} of ${currentYear}, if they mention January, February, or March without a year, use ${nextYear}.`;
  } else {
    yearGuidance = `Use ${currentYear} for dates that are still in the future.`;
  }

  const tzAbbrev = getTimezoneAbbreviation(new Date(), tz);

  return {
    todayFormatted,
    currentYear,
    nextYear,
    currentMonth,
    yearGuidance,
    timezoneInfo: `User's timezone: ${tz} (${tzAbbrev}). All times mentioned by the user should be interpreted as ${tzAbbrev}.`,
  };
}

/**
 * Validate and normalize an AI-returned timestamp
 * Converts local time (without Z) to proper UTC
 *
 * This is the CRITICAL function for fixing the timezone bug in AI parsing
 */
export function normalizeAITimestamp(
  timestamp: string | null | undefined,
  userTimezone: string
): { utc: Date | null; original: string | null; wasConverted: boolean } {
  if (!timestamp) {
    return { utc: null, original: null, wasConverted: false };
  }

  const tz = normalizeTimezone(userTimezone);

  // Check if already UTC (has Z suffix)
  if (timestamp.endsWith('Z')) {
    return {
      utc: new Date(timestamp),
      original: timestamp,
      wasConverted: false,
    };
  }

  // Check if has timezone offset (e.g., -05:00)
  if (/[+-]\d{2}:\d{2}$/.test(timestamp)) {
    return {
      utc: new Date(timestamp),
      original: timestamp,
      wasConverted: false,
    };
  }

  // No timezone info - assume it's in the user's timezone and convert to UTC
  const utcDate = parseLocalTimeToUTC(timestamp, tz);

  console.log(`[normalizeAITimestamp] Converted "${timestamp}" (${tz}) to UTC: ${utcDate.toISOString()}`);

  return {
    utc: utcDate,
    original: timestamp,
    wasConverted: true,
  };
}

/**
 * Build the instruction string for AI about how to return timestamps
 */
export function getAITimestampInstructions(timezone: string): string {
  const tz = normalizeTimezone(timezone);
  const tzAbbrev = getTimezoneAbbreviation(new Date(), tz);
  const { currentYear, nextYear } = buildDateContextForAI(tz);

  return `TIMESTAMP FORMAT INSTRUCTIONS:
- The user is in timezone: ${tz} (${tzAbbrev})
- When they say a time like "2pm" or "14:00", they mean ${tzAbbrev} time
- Return timestamps in ISO 8601 format with the timezone offset
- Example: If they say "January 5 at 2pm", return "${nextYear}-01-05T14:00:00-05:00" (for EST)
- OR return UTC directly: "${nextYear}-01-05T19:00:00Z" (2pm EST = 7pm UTC)
- NEVER return a bare timestamp like "${nextYear}-01-05T14:00:00" without timezone info
- If the user explicitly mentions a timezone (EST, PST, etc.), use that timezone
- If no timezone is mentioned, assume ${tzAbbrev}`;
}
