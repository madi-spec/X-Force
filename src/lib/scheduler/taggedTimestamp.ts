/**
 * Tagged Timestamps - Bulletproof Timezone Handling
 *
 * Every timestamp in the system must explicitly know what timezone it represents.
 * This eliminates the "2pm becomes 6am" bug caused by bare timestamps being
 * treated as UTC when they're actually local times.
 *
 * RULES:
 * 1. AI extracts LOCAL times - never ask AI to convert to UTC
 * 2. Tag every timestamp - always pair datetime with timezone
 * 3. Store both - keep UTC for queries, keep local+tz for debugging
 * 4. Compare in UTC - availability checks use UTC
 * 5. Display in local - user-facing times use their timezone
 */

/**
 * A timestamp that explicitly knows what timezone it represents.
 * This eliminates ambiguity and conversion errors.
 */
export interface TaggedTimestamp {
  // The datetime in ISO format WITHOUT timezone suffix
  // e.g., "2025-01-06T14:00:00"
  localDateTime: string;

  // The IANA timezone this datetime is in
  // e.g., "America/New_York"
  timezone: string;

  // Pre-computed UTC equivalent (with Z suffix)
  // e.g., "2025-01-06T19:00:00Z"
  utc: string;
}

/**
 * AI-extracted time from email parsing
 */
export interface AIExtractedTime {
  localDateTime: string;
  timezone: string;
  displayText: string;
}

/**
 * Validate that a timezone string is valid IANA timezone
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert local datetime string to UTC
 * Handles DST correctly by using Intl
 */
function localToUtc(localDateTime: string, timezone: string): string {
  // Parse the local datetime components
  const [datePart, timePart] = localDateTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const timeComponents = (timePart || '00:00:00').split(':').map(Number);
  const [hour, minute, second = 0] = timeComponents;

  // Create a formatter that outputs in UTC
  const utcFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Create a formatter for the source timezone
  const localFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Find the UTC time that, when formatted in the local timezone, gives us the target local time
  // Start with a rough guess
  let testDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Parse the local formatted result
  const parseFormattedDate = (formatted: string): { y: number; m: number; d: number; h: number; min: number; s: number } => {
    const parts = formatted.split(', ');
    const dateParts = parts[0].split('-').map(Number);
    const timeParts = parts[1].split(':').map(Number);
    return {
      y: dateParts[0],
      m: dateParts[1],
      d: dateParts[2],
      h: timeParts[0],
      min: timeParts[1],
      s: timeParts[2] || 0
    };
  };

  // Iterate to find the correct UTC time (handles DST edge cases)
  for (let attempt = 0; attempt < 48; attempt++) {
    const localFormatted = localFormatter.format(testDate);
    const parsed = parseFormattedDate(localFormatted);

    if (
      parsed.y === year &&
      parsed.m === month &&
      parsed.d === day &&
      parsed.h === hour &&
      parsed.min === minute
    ) {
      // Found it!
      return testDate.toISOString();
    }

    // Adjust by the difference
    const diffHours = hour - parsed.h;
    const diffMinutes = minute - parsed.min;
    const diffDays = day - parsed.d;

    testDate = new Date(testDate.getTime() +
      (diffDays * 24 * 60 * 60 * 1000) +
      (diffHours * 60 * 60 * 1000) +
      (diffMinutes * 60 * 1000)
    );
  }

  // Fallback - should rarely happen
  console.warn('[TaggedTimestamp] Could not precisely convert, using best effort');
  return testDate.toISOString();
}

/**
 * Convert UTC datetime string to local
 */
function utcToLocal(utcDateTime: string, timezone: string): string {
  const utcDate = new Date(utcDateTime);

  // Format in the target timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };

  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(utcDate);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

/**
 * Create a tagged timestamp from a local time
 * USE THIS when the user/prospect specifies a time
 *
 * @param localDateTime - The datetime in local time, e.g., "2025-01-06T14:00:00"
 * @param timezone - The IANA timezone, e.g., "America/New_York"
 */
export function createTaggedTimestamp(
  localDateTime: string,
  timezone: string
): TaggedTimestamp {
  // Validate inputs
  if (!localDateTime) {
    throw new Error('localDateTime is required');
  }
  if (!timezone) {
    throw new Error('timezone is required');
  }
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  // Normalize the local datetime (remove any Z or offset if present)
  const cleanLocal = localDateTime
    .replace(/Z$/, '')
    .replace(/[+-]\d{2}:\d{2}$/, '')
    .replace(/\.\d{3}$/, ''); // Remove milliseconds

  // Convert to UTC
  const utc = localToUtc(cleanLocal, timezone);

  return {
    localDateTime: cleanLocal,
    timezone,
    utc
  };
}

/**
 * Create a tagged timestamp from UTC
 * USE THIS when reading from database or APIs that return UTC
 *
 * @param utcDateTime - The UTC datetime, e.g., "2025-01-06T19:00:00Z"
 * @param timezone - Target timezone for display, e.g., "America/New_York"
 */
export function createTaggedFromUtc(
  utcDateTime: string,
  timezone: string
): TaggedTimestamp {
  if (!utcDateTime) {
    throw new Error('utcDateTime is required');
  }
  if (!timezone) {
    throw new Error('timezone is required');
  }
  if (!isValidTimezone(timezone)) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  // Ensure UTC has Z suffix
  const cleanUtc = utcDateTime.endsWith('Z')
    ? utcDateTime
    : utcDateTime.replace(/[+-]\d{2}:\d{2}$/, '') + 'Z';

  // Convert to local
  const localDateTime = utcToLocal(cleanUtc, timezone);

  return {
    localDateTime,
    timezone,
    utc: cleanUtc
  };
}

/**
 * Create a tagged timestamp from a Date object
 * The Date is assumed to be in UTC (as JS Dates always are internally)
 */
export function createTaggedFromDate(
  date: Date,
  timezone: string
): TaggedTimestamp {
  return createTaggedFromUtc(date.toISOString(), timezone);
}

/**
 * Format a tagged timestamp for display to the user
 */
export function formatTaggedForDisplay(
  ts: TaggedTimestamp,
  options?: {
    includeTimezone?: boolean;
    format?: 'short' | 'long';
    includeYear?: boolean;
  }
): string {
  const date = new Date(ts.utc);

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: ts.timezone,
    weekday: options?.format === 'long' ? 'long' : 'short',
    month: options?.format === 'long' ? 'long' : 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(options?.includeYear !== false && { year: 'numeric' }),
    ...(options?.includeTimezone !== false && { timeZoneName: 'short' })
  };

  return date.toLocaleString('en-US', formatOptions);
}

/**
 * Format a tagged timestamp for email display (human-friendly)
 */
export function formatTaggedForEmail(ts: TaggedTimestamp): string {
  const date = new Date(ts.utc);

  const options: Intl.DateTimeFormatOptions = {
    timeZone: ts.timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  };

  return date.toLocaleString('en-US', options);
}

/**
 * Format for Microsoft Graph API
 * Returns the local datetime WITHOUT Z suffix, paired with timezone
 */
export function formatTaggedForGraphAPI(ts: TaggedTimestamp): {
  dateTime: string;
  timeZone: string;
} {
  return {
    dateTime: ts.localDateTime,
    timeZone: ts.timezone
  };
}

/**
 * Compare two tagged timestamps (returns true if same moment in time)
 */
export function taggedTimestampsEqual(a: TaggedTimestamp, b: TaggedTimestamp): boolean {
  // Compare UTC values (same moment in time)
  const aTime = new Date(a.utc).getTime();
  const bTime = new Date(b.utc).getTime();
  return Math.abs(aTime - bTime) < 60000; // Within 1 minute
}

/**
 * Check if a tagged timestamp is in the future
 */
export function isTaggedInFuture(ts: TaggedTimestamp, bufferMinutes: number = 0): boolean {
  const now = new Date();
  const tsDate = new Date(ts.utc);
  const buffer = bufferMinutes * 60 * 1000;
  return tsDate.getTime() > now.getTime() + buffer;
}

/**
 * Check if a tagged timestamp is in the past
 */
export function isTaggedInPast(ts: TaggedTimestamp): boolean {
  const now = new Date();
  const tsDate = new Date(ts.utc);
  return tsDate.getTime() < now.getTime();
}

/**
 * Get the hour in local time (0-23)
 */
export function getTaggedLocalHour(ts: TaggedTimestamp): number {
  const date = new Date(ts.utc);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ts.timezone,
    hour: 'numeric',
    hour12: false
  });
  return parseInt(formatter.format(date), 10);
}

/**
 * Get the day of week in local time (0 = Sunday, 6 = Saturday)
 */
export function getTaggedLocalDayOfWeek(ts: TaggedTimestamp): number {
  const date = new Date(ts.utc);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ts.timezone,
    weekday: 'short'
  });
  const dayName = formatter.format(date);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.indexOf(dayName);
}

/**
 * Add duration to a tagged timestamp
 */
export function addMinutesToTagged(ts: TaggedTimestamp, minutes: number): TaggedTimestamp {
  const newUtc = new Date(new Date(ts.utc).getTime() + minutes * 60 * 1000);
  return createTaggedFromUtc(newUtc.toISOString(), ts.timezone);
}

/**
 * Get the date portion only (YYYY-MM-DD) in local time
 */
export function getTaggedLocalDate(ts: TaggedTimestamp): string {
  return ts.localDateTime.split('T')[0];
}

/**
 * Parse a potentially bare timestamp into a tagged timestamp
 * ONLY use this for legacy data - new code should always use createTaggedTimestamp
 */
export function parseAndTagTimestamp(
  timestamp: string | null | undefined,
  assumedTimezone: string
): TaggedTimestamp | null {
  if (!timestamp) return null;

  // Check if it already has timezone info
  if (timestamp.endsWith('Z')) {
    // It's UTC
    return createTaggedFromUtc(timestamp, assumedTimezone);
  }

  if (/[+-]\d{2}:\d{2}$/.test(timestamp)) {
    // Has offset - convert to UTC first
    const date = new Date(timestamp);
    return createTaggedFromUtc(date.toISOString(), assumedTimezone);
  }

  // Bare timestamp - assume it's in the given timezone
  return createTaggedTimestamp(timestamp, assumedTimezone);
}

/**
 * Log timestamp conversion for debugging
 */
export function logTaggedTimestamp(
  label: string,
  ts: TaggedTimestamp
): void {
  console.log(`[TaggedTimestamp] ${label}:`);
  console.log(`  Local: ${ts.localDateTime} (${ts.timezone})`);
  console.log(`  UTC:   ${ts.utc}`);
  console.log(`  Display: ${formatTaggedForDisplay(ts)}`);
}
