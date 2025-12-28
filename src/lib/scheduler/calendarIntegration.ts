/**
 * Calendar Integration for AI Scheduler
 *
 * Handles creating calendar events when meetings are confirmed.
 */

import { createCalendarEvent } from '@/lib/microsoft/calendarSync';
import { createAdminClient } from '@/lib/supabase/admin';
import { SchedulingService } from './schedulingService';
import {
  SchedulingRequest,
  SchedulingAttendee,
  MeetingPlatform,
  MEETING_PLATFORMS,
} from './types';

interface CreateMeetingEventInput {
  schedulingRequestId: string;
  userId: string;
  scheduledTime: Date;
  durationMinutes: number;
  title?: string;
  description?: string;
  platform: MeetingPlatform;
  location?: string;
}

interface CreateMeetingEventResult {
  success: boolean;
  eventId?: string;
  meetingLink?: string;
  error?: string;
}

/**
 * Creates a calendar event when a meeting is confirmed
 */
export async function createMeetingCalendarEvent(
  input: CreateMeetingEventInput
): Promise<CreateMeetingEventResult> {
  const supabase = createAdminClient();
  const schedulingService = new SchedulingService({ useAdmin: true });

  try {
    // Get the scheduling request with attendees
    const { data: request, error: requestError } = await schedulingService.getSchedulingRequest(
      input.schedulingRequestId
    );

    if (requestError || !request) {
      return { success: false, error: requestError || 'Request not found' };
    }

    // Get attendee emails
    const attendeeEmails = request.attendees
      ?.filter((a) => a.email)
      .map((a) => a.email) || [];

    // Calculate end time
    const endTime = new Date(input.scheduledTime);
    endTime.setMinutes(endTime.getMinutes() + input.durationMinutes);

    // Create the meeting subject
    const subject = input.title || generateMeetingSubject(request);

    // Create meeting body/description
    const body = input.description || generateMeetingBody(request);

    // Determine if it's an online meeting
    const isOnlineMeeting =
      input.platform === MEETING_PLATFORMS.TEAMS ||
      input.platform === MEETING_PLATFORMS.ZOOM ||
      input.platform === MEETING_PLATFORMS.GOOGLE_MEET;

    // Create the calendar event
    const result = await createCalendarEvent(input.userId, {
      subject,
      body,
      start: input.scheduledTime,
      end: endTime,
      attendees: attendeeEmails,
      isOnlineMeeting,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Update the scheduling request with the calendar event ID
    await supabase
      .from('scheduling_requests')
      .update({
        calendar_event_id: result.eventId,
        meeting_link: result.joinUrl || null,
        status: 'confirmed',
        invite_accepted: false, // Will be updated when invite response is received
        last_action_at: new Date().toISOString(),
      })
      .eq('id', input.schedulingRequestId);

    return {
      success: true,
      eventId: result.eventId,
      meetingLink: result.joinUrl,
    };

  } catch (err) {
    console.error('Error creating meeting calendar event:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Generates a meeting subject based on the scheduling request
 */
function generateMeetingSubject(request: SchedulingRequest): string {
  const companyName = request.company?.name || 'Prospect';
  const meetingTypeLabels: Record<string, string> = {
    discovery: 'Discovery Call',
    demo: 'Product Demo',
    follow_up: 'Follow-up Call',
    technical: 'Technical Discussion',
    executive: 'Executive Briefing',
    custom: 'Meeting',
  };

  const meetingType = meetingTypeLabels[request.meeting_type] || 'Meeting';
  return `${meetingType} - ${companyName}`;
}

/**
 * Generates meeting body/description with relevant context
 */
function generateMeetingBody(request: SchedulingRequest): string {
  const lines: string[] = [];

  lines.push(`<p><strong>Meeting Type:</strong> ${request.meeting_type}</p>`);
  lines.push(`<p><strong>Duration:</strong> ${request.duration_minutes} minutes</p>`);

  if (request.context) {
    lines.push(`<p><strong>Context:</strong></p>`);
    lines.push(`<p>${request.context}</p>`);
  }

  if (request.company?.name) {
    lines.push(`<p><strong>Company:</strong> ${request.company.name}</p>`);
  }

  if (request.attendees && request.attendees.length > 0) {
    const external = request.attendees.filter((a) => a.side === 'external');
    if (external.length > 0) {
      lines.push(`<p><strong>External Attendees:</strong></p>`);
      lines.push('<ul>');
      external.forEach((a) => {
        const name = a.name || a.email;
        const title = a.title ? ` - ${a.title}` : '';
        lines.push(`<li>${name}${title}</li>`);
      });
      lines.push('</ul>');
    }
  }

  lines.push('<hr/>');
  lines.push('<p><em>Created by X-FORCE AI Scheduler</em></p>');

  return lines.join('\n');
}

/**
 * Updates a calendar event when meeting details change
 */
export async function updateMeetingCalendarEvent(
  userId: string,
  eventId: string,
  updates: {
    start?: Date;
    end?: Date;
    subject?: string;
    body?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  // This would use the updateEvent method from MicrosoftGraphClient
  // For now, return success - full implementation would need token handling
  console.log('Calendar event update requested:', { eventId, updates });
  return { success: true };
}

/**
 * Cancels a calendar event when a meeting is cancelled
 */
export async function cancelMeetingCalendarEvent(
  userId: string,
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  // This would use the deleteEvent method from MicrosoftGraphClient
  // For now, return success - full implementation would need token handling
  console.log('Calendar event cancellation requested:', eventId);
  return { success: true };
}

/**
 * Get available time slots from the user's calendar
 */
export async function getAvailableTimeSlots(
  userId: string,
  startDate: Date,
  endDate: Date,
  duration: number,
  preferences: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  },
  avoidDays: string[]
): Promise<Date[]> {
  // This would check the user's calendar and return available slots
  // For MVP, we'll generate slots without calendar check

  const slots: Date[] = [];
  const current = new Date(startDate);

  const timeRanges: Array<{ start: number; end: number; period: 'morning' | 'afternoon' | 'evening' }> = [];
  if (preferences.morning) timeRanges.push({ start: 9, end: 12, period: 'morning' });
  if (preferences.afternoon) timeRanges.push({ start: 13, end: 17, period: 'afternoon' });
  if (preferences.evening) timeRanges.push({ start: 17, end: 19, period: 'evening' });

  while (current <= endDate && slots.length < 12) {
    const dayName = current.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayOfWeek = current.getDay();

    // Skip weekends and avoided days
    if (
      dayOfWeek === 0 ||
      dayOfWeek === 6 ||
      avoidDays.some((d) => dayName.includes(d.toLowerCase()))
    ) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Generate slots for preferred time periods
    for (const range of timeRanges) {
      if (slots.length >= 12) break;

      // Add slots at specific times
      const slotTimes = range.period === 'morning'
        ? [9, 10, 11]
        : range.period === 'afternoon'
        ? [13, 14, 15, 16]
        : [17, 18];

      for (const hour of slotTimes) {
        if (slots.length >= 12) break;

        const slot = new Date(current);
        slot.setHours(hour, 0, 0, 0);

        // Only add future slots
        if (slot > new Date()) {
          slots.push(slot);
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  // Return a subset with variety (different days/times)
  return selectDiverseSlots(slots, 4);
}

/**
 * Select diverse time slots for proposals (different days and times)
 */
function selectDiverseSlots(slots: Date[], count: number): Date[] {
  if (slots.length <= count) return slots;

  const selected: Date[] = [];
  const usedDays = new Set<string>();
  const usedPeriods = new Set<string>();

  // First pass: try to get different days
  for (const slot of slots) {
    if (selected.length >= count) break;

    const dayKey = slot.toDateString();
    const hour = slot.getHours();
    const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const periodKey = `${dayKey}-${period}`;

    if (!usedDays.has(dayKey) || !usedPeriods.has(periodKey)) {
      selected.push(slot);
      usedDays.add(dayKey);
      usedPeriods.add(periodKey);
    }
  }

  // Fill remaining with any slots
  for (const slot of slots) {
    if (selected.length >= count) break;
    if (!selected.includes(slot)) {
      selected.push(slot);
    }
  }

  return selected.sort((a, b) => a.getTime() - b.getTime());
}

// ============================================
// REAL CALENDAR AVAILABILITY
// ============================================

interface RealAvailableSlot {
  start: Date;
  end: Date;
  formatted: string;
}

interface GetRealAvailabilityOptions {
  daysAhead?: number;        // How many days to look ahead (default: 15 business days = ~3 weeks)
  slotDuration?: number;     // Meeting duration in minutes (default: 30)
  businessHoursStart?: number; // Start hour (default: 9)
  businessHoursEnd?: number;   // End hour (default: 17)
  maxSlots?: number;         // Max slots to return (default: 4)
  timezone?: string;         // Timezone for formatting (default: America/New_York)
}

/**
 * Get REAL available time slots by checking the user's actual calendar
 * Returns slots that are genuinely free (no conflicting events)
 */
export async function getRealAvailableSlots(
  userId: string,
  options: GetRealAvailabilityOptions = {}
): Promise<{ slots: RealAvailableSlot[]; error?: string }> {
  const {
    daysAhead = 15,  // 3 weeks of business days
    slotDuration = 30,
    businessHoursStart = 9,
    businessHoursEnd = 17,
    maxSlots = 4,
    timezone = 'America/New_York',
  } = options;

  try {
    // Dynamic imports to avoid circular dependencies
    const { MicrosoftGraphClient } = await import('@/lib/microsoft/graph');
    const { getValidToken } = await import('@/lib/microsoft/auth');

    // Get a valid access token (will refresh if expired)
    const token = await getValidToken(userId);
    if (!token) {
      return { slots: [], error: 'No valid Microsoft token - please reconnect your account' };
    }

    // Create graph client with the access token
    const graphClient = new MicrosoftGraphClient(token);

    // Get current time in the target timezone for proper date calculations
    const nowInTz = getNowInTimezone(timezone);
    const currentHourInTz = nowInTz.getHours();

    // Calculate date range - use timezone-aware date handling
    // Start from today in the target timezone, or tomorrow if late in the day
    const now = new Date();
    let startDateBase = now;

    if (currentHourInTz >= businessHoursEnd - 2) {
      // Late in the day, start from tomorrow
      startDateBase = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    // Get start of day in the TARGET timezone (not server timezone)
    // This fixes the bug where server timezone caused off-by-one day errors
    const startDate = getStartOfDayInTimezone(startDateBase, timezone);

    // Calculate end date (counting only business days)
    const endDate = new Date(startDate);
    let businessDaysAdded = 0;
    while (businessDaysAdded < daysAhead) {
      endDate.setDate(endDate.getDate() + 1);
      const dayOfWeek = getDayOfWeekInTimezone(endDate, timezone);
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDaysAdded++;
      }
    }

    // Fetch calendar events
    const eventsResult = await graphClient.getCalendarEvents({
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
      top: 100,
      timezone,
    });

    if (!eventsResult.value) {
      console.error('[getRealAvailableSlots] No calendar data returned');
      return { slots: [], error: 'Could not fetch calendar' };
    }

    // Build busy time blocks (excluding only cancelled and explicitly free events)
    const busyBlocks: Array<{ start: Date; end: Date }> = [];
    for (const event of eventsResult.value) {
      // Skip cancelled events
      if (event.isCancelled) continue;

      // Skip events explicitly marked as Free or Working Elsewhere
      if (event.showAs === 'free' || event.showAs === 'workingElsewhere') continue;

      // All other events block time (busy, tentative, oof/OOO)
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);

      busyBlocks.push({ start: eventStart, end: eventEnd });
    }

    // Sort busy blocks by start time
    busyBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());

    // Generate candidate slots within business hours
    // Group slots by day to ensure we get diversity across days
    const slotsByDay: Map<string, RealAvailableSlot[]> = new Map();
    const current = new Date(startDate);
    let daysScanned = 0;
    const minDaysToScan = Math.min(5, daysAhead); // Scan at least 5 days to get variety

    while (current < endDate && daysScanned < daysAhead) {
      // Use timezone-aware day of week check
      const dayOfWeek = getDayOfWeekInTimezone(current, timezone);
      const dateStr = getDateStringInTimezone(current, timezone);

      // Skip weekends (in target timezone)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        current.setTime(current.getTime() + 24 * 60 * 60 * 1000);
        continue;
      }

      const dayKey = dateStr; // Use timezone-aware date string
      const daySlotsArr: RealAvailableSlot[] = [];

      // Get date components in target timezone for slot creation
      const yearInTz = parseInt(current.toLocaleDateString('en-US', { year: 'numeric', timeZone: timezone }));
      const monthInTz = parseInt(current.toLocaleDateString('en-US', { month: 'numeric', timeZone: timezone })) - 1;
      const dayInTz = parseInt(current.toLocaleDateString('en-US', { day: 'numeric', timeZone: timezone }));

      // Generate slots for this day
      for (let hour = businessHoursStart; hour < businessHoursEnd; hour++) {
        for (const minute of [0, 30]) {
          // Create slot time in the target timezone (fixes timezone mismatch bug)
          const slotStart = createDateInTimezone(yearInTz, monthInTz, dayInTz, hour, minute, timezone);

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

          // Skip if slot is in the past
          if (slotStart <= new Date()) continue;

          // Skip if slot end is after business hours
          const endHourInTz = parseInt(slotEnd.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }));
          const endMinuteInTz = parseInt(slotEnd.toLocaleTimeString('en-US', { minute: 'numeric', timeZone: timezone }));
          if (endHourInTz > businessHoursEnd || (endHourInTz === businessHoursEnd && endMinuteInTz > 0)) {
            continue;
          }

          // Check if slot conflicts with any busy block
          const hasConflict = busyBlocks.some((busy) => {
            // Conflict if: slot starts before busy ends AND slot ends after busy starts
            return slotStart < busy.end && slotEnd > busy.start;
          });

          if (!hasConflict) {
            // Format in EXACT email style so AI can copy directly without modification
            const dayName = slotStart.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });
            const month = slotStart.toLocaleDateString('en-US', { month: 'long', timeZone: timezone });
            const dayNum = slotStart.toLocaleDateString('en-US', { day: 'numeric', timeZone: timezone });
            const time = slotStart.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: timezone,
            });
            // Format: "Monday, January 5th at 9:00 AM ET" - ready for email
            const daySuffix = getDaySuffix(parseInt(dayNum));
            const formatted = `${dayName}, ${month} ${dayNum}${daySuffix} at ${time} ET`;

            daySlotsArr.push({
              start: slotStart,
              end: slotEnd,
              formatted,
            });
          }
        }
      }

      if (daySlotsArr.length > 0) {
        slotsByDay.set(dayKey, daySlotsArr);
      }

      daysScanned++;

      // Move to next day (use milliseconds for timezone-agnostic increment)
      current.setTime(current.getTime() + 24 * 60 * 60 * 1000);

      // Stop early if we have enough days with slots
      if (slotsByDay.size >= minDaysToScan) {
        break;
      }
    }

    // Select diverse slots across different days
    const diverseSlots = selectDiverseSlotsAcrossDays(slotsByDay, maxSlots);

    const totalSlots = Array.from(slotsByDay.values()).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[getRealAvailableSlots] Found ${totalSlots} slots across ${slotsByDay.size} days, returning ${diverseSlots.length} diverse slots`);

    return { slots: diverseSlots };
  } catch (error) {
    console.error('[getRealAvailableSlots] Error:', error);
    return { slots: [], error: (error as Error).message };
  }
}

/**
 * Select diverse slots across different days
 * Prioritizes having slots on different days over different times on the same day
 * Uses seeded randomization and avoids slots with many pending proposals
 */
function selectDiverseSlotsAcrossDays(
  slotsByDay: Map<string, RealAvailableSlot[]>,
  count: number,
  random?: () => number,
  pendingCounts?: Map<string, number>
): RealAvailableSlot[] {
  const selected: RealAvailableSlot[] = [];
  let days = Array.from(slotsByDay.keys());

  if (days.length === 0) return [];

  // Shuffle days order using seeded random for variety
  if (random) {
    days = shuffleWithSeed(days, random);
  }

  // Score each slot based on pending proposals (lower is better)
  const scoreSlot = (slot: RealAvailableSlot): number => {
    if (!pendingCounts || pendingCounts.size === 0) return 0;
    // Create a key that matches hour granularity (e.g., "2026-01-06T10")
    const slotKey = slot.start.toISOString().substring(0, 13);
    return pendingCounts.get(slotKey) || 0;
  };

  // Sort slots within each day by pending count (prefer less busy times)
  const sortedSlotsByDay = new Map<string, RealAvailableSlot[]>();
  for (const [day, slots] of slotsByDay) {
    // Shuffle first, then stable-sort by pending count
    let shuffled = random ? shuffleWithSeed(slots, random) : [...slots];
    shuffled.sort((a, b) => scoreSlot(a) - scoreSlot(b));
    sortedSlotsByDay.set(day, shuffled);
  }

  // Strategy: Round-robin through days, picking one slot from each
  // This ensures we get slots from different days first
  let dayIndex = 0;
  const usedIndices: Map<string, number> = new Map();

  // Initialize indices for each day
  for (const day of days) {
    usedIndices.set(day, 0);
  }

  // Randomize starting period for time variety
  const startPeriod = random ? Math.floor(random() * 3) : 0;

  while (selected.length < count) {
    const currentDay = days[dayIndex % days.length];
    const daySlots = sortedSlotsByDay.get(currentDay) || [];
    const slotIndex = usedIndices.get(currentDay) || 0;

    if (slotIndex < daySlots.length) {
      // Pick a slot with time variety (varies starting period based on seed)
      const targetPeriod = (selected.length + startPeriod) % 3; // 0=morning, 1=afternoon, 2=late
      let bestSlot = daySlots[slotIndex];
      let bestSlotIndex = slotIndex;

      // Try to find a slot in the target time period (checking next few slots)
      for (let i = slotIndex; i < Math.min(slotIndex + 5, daySlots.length); i++) {
        const hour = daySlots[i].start.getHours();
        const period = hour < 12 ? 0 : hour < 15 ? 1 : 2;
        if (period === targetPeriod) {
          bestSlot = daySlots[i];
          bestSlotIndex = i;
          break;
        }
      }

      usedIndices.set(currentDay, bestSlotIndex + 1);
      selected.push(bestSlot);
    }

    dayIndex++;

    // If we've gone through all days without adding any slots, we're done
    if (dayIndex >= days.length * 10) break;
  }

  return selected.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Format available slots as a natural language string for AI prompts
 */
export function formatSlotsForPrompt(slots: RealAvailableSlot[]): string {
  if (slots.length === 0) {
    return 'No specific times available - ask the prospect for their availability.';
  }

  const lines = slots.map((slot, i) => `${i + 1}. ${slot.formatted}`);
  return lines.join('\n');
}

// ============================================
// SEEDED RANDOM FOR SLOT VARIATION
// ============================================

/**
 * Create a seeded random number generator
 * Uses a simple hash-based PRNG for deterministic but varied results
 */
function createSeededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Use the hash as seed for a simple LCG (Linear Congruential Generator)
  let state = Math.abs(hash) || 1;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Shuffle an array using a seeded random function
 */
function shuffleWithSeed<T>(array: T[], random: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================
// US FEDERAL HOLIDAYS
// ============================================

/**
 * Get US Federal holidays for a given year
 * Returns dates in YYYY-MM-DD format
 */
function getUSHolidays(year: number): Set<string> {
  const holidays = new Set<string>();

  // Fixed date holidays
  holidays.add(`${year}-01-01`); // New Year's Day
  holidays.add(`${year}-07-04`); // Independence Day
  holidays.add(`${year}-11-11`); // Veterans Day
  holidays.add(`${year}-12-25`); // Christmas Day

  // MLK Day - 3rd Monday of January
  holidays.add(getNthWeekdayOfMonth(year, 0, 1, 3));

  // Presidents Day - 3rd Monday of February
  holidays.add(getNthWeekdayOfMonth(year, 1, 1, 3));

  // Memorial Day - Last Monday of May
  holidays.add(getLastWeekdayOfMonth(year, 4, 1));

  // Labor Day - 1st Monday of September
  holidays.add(getNthWeekdayOfMonth(year, 8, 1, 1));

  // Columbus Day - 2nd Monday of October
  holidays.add(getNthWeekdayOfMonth(year, 9, 1, 2));

  // Thanksgiving - 4th Thursday of November
  holidays.add(getNthWeekdayOfMonth(year, 10, 4, 4));

  // Day after Thanksgiving (commonly observed)
  const thanksgiving = getNthWeekdayOfMonth(year, 10, 4, 4);
  const thanksgivingDate = new Date(thanksgiving);
  thanksgivingDate.setDate(thanksgivingDate.getDate() + 1);
  holidays.add(thanksgivingDate.toISOString().split('T')[0]);

  // Christmas Eve and New Year's Eve (commonly observed)
  holidays.add(`${year}-12-24`);
  holidays.add(`${year}-12-31`);

  return holidays;
}

/**
 * Get the nth weekday of a month (e.g., 3rd Monday)
 * @param year - The year
 * @param month - Month (0-indexed)
 * @param weekday - Day of week (0=Sunday, 1=Monday, etc.)
 * @param n - Which occurrence (1=first, 2=second, etc.)
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): string {
  const date = new Date(year, month, 1);

  // Find first occurrence of the weekday
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() + 1);
  }

  // Add weeks to get nth occurrence
  date.setDate(date.getDate() + (n - 1) * 7);

  return date.toISOString().split('T')[0];
}

/**
 * Get the last weekday of a month (e.g., last Monday of May)
 */
function getLastWeekdayOfMonth(year: number, month: number, weekday: number): string {
  // Start from the last day of the month
  const date = new Date(year, month + 1, 0);

  // Go backwards until we find the weekday
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() - 1);
  }

  return date.toISOString().split('T')[0];
}

/**
 * Check if a date is a US holiday
 */
export function isUSHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getUSHolidays(year);
  const dateStr = date.toISOString().split('T')[0];
  return holidays.has(dateStr);
}

// ============================================
// TIMEZONE HELPERS
// ============================================

/**
 * Get the current date/time in a specific timezone
 * Returns a Date object adjusted to represent that timezone's local time
 */
function getNowInTimezone(timezone: string): Date {
  const now = new Date();
  // Get the time string in the target timezone
  const tzString = now.toLocaleString('en-US', { timeZone: timezone });
  // Parse it back to get a Date that represents the local time in that timezone
  return new Date(tzString);
}

/**
 * Get the start of a day (midnight) in the target timezone as a UTC Date object
 * This ensures we start from the correct calendar date in the target timezone
 */
function getStartOfDayInTimezone(date: Date, timezone: string): Date {
  // Extract the calendar date in the target timezone
  const year = parseInt(date.toLocaleDateString('en-US', { year: 'numeric', timeZone: timezone }));
  const month = parseInt(date.toLocaleDateString('en-US', { month: 'numeric', timeZone: timezone })) - 1;
  const day = parseInt(date.toLocaleDateString('en-US', { day: 'numeric', timeZone: timezone }));

  // Create a Date representing midnight of that day in the target timezone
  return createDateInTimezone(year, month, day, 0, 0, timezone);
}

/**
 * Get the ordinal suffix for a day number (1st, 2nd, 3rd, 4th, etc.)
 */
function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Create a Date object representing a specific time in a timezone
 * This handles the timezone offset correctly
 *
 * Example: createDateInTimezone(2025, 0, 6, 15, 30, 'America/New_York')
 * Returns a Date where toLocaleString with that timezone shows "3:30 PM"
 */
function createDateInTimezone(
  year: number,
  month: number, // 0-indexed
  day: number,
  hour: number,
  minute: number,
  timezone: string
): Date {
  // Start with a UTC date using the naive values
  const utcBase = Date.UTC(year, month, day, hour, minute, 0);

  // Format this UTC time in the target timezone to find the offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(utcBase));
  const getPart = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value || '0');

  const tzYear = getPart('year');
  const tzMonth = getPart('month') - 1;
  const tzDay = getPart('day');
  const tzHour = getPart('hour') === 24 ? 0 : getPart('hour'); // Handle midnight edge case
  const tzMinute = getPart('minute');

  // Calculate the offset between what we want and what the timezone shows
  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, 0));
  const tzDate = new Date(Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute, 0));
  const offsetMs = utcDate.getTime() - tzDate.getTime();

  // Apply offset to get the correct UTC time that represents our desired local time
  return new Date(utcBase + offsetMs);
}

/**
 * Get the day of week for a date in a specific timezone
 */
function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days.indexOf(dayName);
}

/**
 * Get date string (YYYY-MM-DD) for a date in a specific timezone
 */
function getDateStringInTimezone(date: Date, timezone: string): string {
  const year = parseInt(date.toLocaleDateString('en-US', { year: 'numeric', timeZone: timezone }));
  const month = parseInt(date.toLocaleDateString('en-US', { month: 'numeric', timeZone: timezone }));
  const day = parseInt(date.toLocaleDateString('en-US', { day: 'numeric', timeZone: timezone }));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ============================================
// PENDING PROPOSAL TRACKING
// ============================================

/**
 * Get counts of how many times each time slot has been proposed
 * in active scheduling requests. Used to spread out proposals
 * and avoid overbooking popular times.
 */
async function getPendingProposalCounts(
  userId: string,
  timezone: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  try {
    const supabase = createAdminClient();

    // Get all active scheduling requests (awaiting_response or negotiating)
    const { data: activeRequests, error } = await supabase
      .from('scheduling_requests')
      .select('proposed_times')
      .eq('created_by', userId)
      .in('status', ['awaiting_response', 'negotiating', 'proposing']);

    if (error) {
      console.warn('[getPendingProposalCounts] Error fetching requests:', error);
      return counts;
    }

    // Count how many times each hour slot appears in proposals
    for (const request of activeRequests || []) {
      const proposedTimes = request.proposed_times || [];

      for (const timeStr of proposedTimes) {
        try {
          // Handle both ISO strings and formatted strings
          let date: Date;
          if (typeof timeStr === 'string' && timeStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            date = new Date(timeStr);
          } else {
            // Try to parse formatted string like "Monday, January 5th at 9:00 AM ET"
            // This is a best-effort parse
            continue; // Skip formatted strings for now
          }

          // Create hour-granularity key (e.g., "2026-01-06T10")
          const slotKey = date.toISOString().substring(0, 13);
          counts.set(slotKey, (counts.get(slotKey) || 0) + 1);
        } catch {
          // Skip unparseable times
        }
      }
    }

    console.log(`[getPendingProposalCounts] Found ${counts.size} time slots with pending proposals across ${activeRequests?.length || 0} active requests`);

  } catch (err) {
    console.warn('[getPendingProposalCounts] Error:', err);
  }

  return counts;
}

// ============================================
// MULTI-ATTENDEE AVAILABILITY
// ============================================

interface MultiAttendeeSlot {
  start: Date;
  end: Date;
  formatted: string;
}

interface GetMultiAttendeeAvailabilityOptions {
  daysAhead?: number;
  slotDuration?: number;
  businessHoursStart?: number;
  businessHoursEnd?: number;
  maxSlots?: number;
  timezone?: string;
  /**
   * Optional seed for randomization (e.g., company ID or request ID)
   * Different seeds produce different slot selections from the same pool
   * If not provided, uses current timestamp for natural variation
   */
  randomSeed?: string;
  /**
   * If true, queries pending scheduling requests and deprioritizes
   * slots that already have many proposals
   */
  avoidOverbooked?: boolean;
}

/**
 * Get available time slots that work for ALL internal attendees
 * Checks each attendee's calendar and finds overlapping free time
 * Also excludes US holidays
 */
export async function getMultiAttendeeAvailability(
  primaryUserId: string,
  attendeeEmails: string[],
  options: GetMultiAttendeeAvailabilityOptions = {}
): Promise<{ slots: MultiAttendeeSlot[]; error?: string; warnings?: string[] }> {
  const {
    daysAhead = 15,
    slotDuration = 30,
    businessHoursStart = 9,
    businessHoursEnd = 17,
    maxSlots = 4,
    timezone = 'America/New_York',
    randomSeed,
    avoidOverbooked = true,
  } = options;

  // Create a seeded random function for consistent but varied selection
  const seed = randomSeed || Date.now().toString();
  const seededRandom = createSeededRandom(seed);

  const warnings: string[] = [];

  try {
    const { MicrosoftGraphClient } = await import('@/lib/microsoft/graph');
    const { getValidToken } = await import('@/lib/microsoft/auth');

    const token = await getValidToken(primaryUserId);
    if (!token) {
      return { slots: [], error: 'No valid Microsoft token - please reconnect your account' };
    }

    const graphClient = new MicrosoftGraphClient(token);

    // Get current time in the target timezone
    const nowInTz = getNowInTimezone(timezone);
    const currentHourInTz = nowInTz.getHours();

    console.log(`[getMultiAttendeeAvailability] Current time in ${timezone}:`, nowInTz.toLocaleString());

    // Calculate date range - use timezone-aware date handling
    // Start from today in the target timezone, or tomorrow if late in the day
    const now = new Date();
    let startDateBase = now;

    if (currentHourInTz >= businessHoursEnd - 2) {
      // Late in the day, start from tomorrow
      startDateBase = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    // Get start of day in the TARGET timezone (not server timezone)
    // This fixes the bug where server timezone caused off-by-one day errors
    const startDate = getStartOfDayInTimezone(startDateBase, timezone);

    console.log(`[getMultiAttendeeAvailability] Start date (${timezone}):`, startDate.toLocaleString('en-US', { timeZone: timezone }));

    const endDate = new Date(startDate);
    let businessDaysAdded = 0;
    while (businessDaysAdded < daysAhead) {
      endDate.setDate(endDate.getDate() + 1);
      const dayOfWeek = getDayOfWeekInTimezone(endDate, timezone);
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDaysAdded++;
      }
    }

    // Get busy blocks from primary user's calendar
    console.log(`[getMultiAttendeeAvailability] Fetching calendar events from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const eventsResult = await graphClient.getCalendarEvents({
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
      top: 100,
      timezone,
    });

    console.log(`[getMultiAttendeeAvailability] Found ${eventsResult.value?.length || 0} calendar events`);

    const primaryBusyBlocks: Array<{ start: Date; end: Date; subject?: string }> = [];
    for (const event of eventsResult.value || []) {
      if (event.isCancelled) {
        console.log(`[getMultiAttendeeAvailability] Skipping cancelled: ${event.subject}`);
        continue;
      }
      if (event.showAs === 'free' || event.showAs === 'workingElsewhere') {
        console.log(`[getMultiAttendeeAvailability] Skipping free/working elsewhere: ${event.subject}`);
        continue;
      }

      // Parse the datetime - Graph returns local time in the requested timezone
      const startDateTime = event.start.dateTime;
      const endDateTime = event.end.dateTime;

      // Graph returns times in the timezone we requested (e.g., "2025-01-06T09:00:00" means 9 AM ET)
      // We need to convert this to UTC for proper comparison with our slots
      const parseEventDateTime = (dt: string): Date => {
        const [datePart, timePart] = dt.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map((s) => parseInt(s));
        return createDateInTimezone(year, month - 1, day, hour, minute, timezone);
      };

      const eventStart = parseEventDateTime(startDateTime);
      const eventEnd = parseEventDateTime(endDateTime);

      console.log(`[getMultiAttendeeAvailability] Busy block: "${event.subject}" from ${startDateTime} to ${endDateTime} (showAs: ${event.showAs})`);

      primaryBusyBlocks.push({
        start: eventStart,
        end: eventEnd,
        subject: event.subject,
      });
    }

    console.log(`[getMultiAttendeeAvailability] Primary user has ${primaryBusyBlocks.length} busy blocks`);

    // Get busy blocks for other attendees using getSchedule
    const otherAttendeeBusyBlocks: Array<{ start: Date; end: Date }> = [];

    // Helper to parse Graph datetime strings from getSchedule API
    // The getSchedule API returns times in the calendar owner's timezone (not UTC, not our requested timezone)
    // The timeZone field indicates what timezone the dateTime is in
    const parseScheduleDateTime = (dt: string, itemTimeZone?: string): Date => {
      // Remove trailing fractional zeros
      const cleanDt = dt.replace(/\.0+$/, '');

      // Log for debugging
      console.log(`[parseScheduleDateTime] Parsing: ${dt}, timeZone: ${itemTimeZone}`);

      // If itemTimeZone is provided and it's a known timezone, parse accordingly
      // Most commonly it will be 'Eastern Standard Time' or 'UTC'
      if (itemTimeZone) {
        // Map common Microsoft timezone names to IANA names
        const tzMap: Record<string, string> = {
          'Eastern Standard Time': 'America/New_York',
          'Eastern Daylight Time': 'America/New_York',
          'Pacific Standard Time': 'America/Los_Angeles',
          'Pacific Daylight Time': 'America/Los_Angeles',
          'Central Standard Time': 'America/Chicago',
          'Central Daylight Time': 'America/Chicago',
          'UTC': 'UTC',
        };

        const mappedTz = tzMap[itemTimeZone];
        if (mappedTz) {
          // Parse the datetime components
          const [datePart, timePart] = cleanDt.split('T');
          const [year, month, day] = datePart.split('-').map(Number);
          const [hour, minute] = timePart.split(':').map((s) => parseInt(s));

          // Create date in the item's timezone
          return createDateInTimezone(year, month - 1, day, hour, minute, mappedTz);
        }
      }

      // Fallback: if no timezone info, assume it's in our target timezone
      const [datePart, timePart] = cleanDt.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':').map((s) => parseInt(s));
      return createDateInTimezone(year, month - 1, day, hour, minute, timezone);
    };

    if (attendeeEmails.length > 0) {
      try {
        console.log(`[getMultiAttendeeAvailability] Checking availability for attendees:`, attendeeEmails);
        // Format datetimes as local time strings (without Z suffix) for the specified timezone
        // Microsoft Graph expects the dateTime to be in the timezone specified, not UTC
        const formatForGraph = (date: Date, tz: string): string => {
          const year = parseInt(date.toLocaleDateString('en-US', { year: 'numeric', timeZone: tz }));
          const month = String(parseInt(date.toLocaleDateString('en-US', { month: 'numeric', timeZone: tz }))).padStart(2, '0');
          const day = String(parseInt(date.toLocaleDateString('en-US', { day: 'numeric', timeZone: tz }))).padStart(2, '0');
          const hour = String(parseInt(date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: tz }))).padStart(2, '0');
          const minute = String(parseInt(date.toLocaleTimeString('en-US', { minute: 'numeric', timeZone: tz }))).padStart(2, '0');
          return `${year}-${month}-${day}T${hour}:${minute}:00`;
        };

        const startDateTimeStr = formatForGraph(startDate, timezone);
        const endDateTimeStr = formatForGraph(endDate, timezone);

        console.log(`[getMultiAttendeeAvailability] Date range for schedule query:`, {
          startLocal: startDateTimeStr,
          startUTC: startDate.toISOString(),
          startET: startDate.toLocaleString('en-US', { timeZone: timezone }),
          endLocal: endDateTimeStr,
          endUTC: endDate.toISOString(),
          endET: endDate.toLocaleString('en-US', { timeZone: timezone }),
          timezone,
        });

        const scheduleResult = await graphClient.getSchedule({
          schedules: attendeeEmails,
          startTime: { dateTime: startDateTimeStr, timeZone: timezone },
          endTime: { dateTime: endDateTimeStr, timeZone: timezone },
          availabilityViewInterval: slotDuration,
        });

        // Log raw response for debugging
        console.log(`[getMultiAttendeeAvailability] Raw schedule response:`, JSON.stringify(scheduleResult, null, 2));

        // Track which attendees we successfully got data for
        const checkedAttendees = new Set<string>();
        const failedAttendees: string[] = [];

        for (const schedule of scheduleResult.value || []) {
          const scheduleEmail = schedule.scheduleId?.toLowerCase() || '';
          checkedAttendees.add(scheduleEmail);

          // Check for error responses (e.g., permission denied)
          // Microsoft Graph can return error objects in schedule responses
          const scheduleWithError = schedule as { error?: { code?: string; message?: string } };
          if (scheduleWithError.error) {
            console.warn(`[getMultiAttendeeAvailability] Error for ${scheduleEmail}:`, scheduleWithError.error);
            failedAttendees.push(scheduleEmail);
            continue;
          }

          console.log(`[getMultiAttendeeAvailability] Schedule for ${schedule.scheduleId}: ${schedule.scheduleItems?.length || 0} items`);

          // Log availabilityView to see the bitmap of busy times
          // "0"=free, "1"=tentative, "2"=busy, "3"=OOF, "4"=working elsewhere
          if (schedule.availabilityView) {
            console.log(`[getMultiAttendeeAvailability] availabilityView for ${schedule.scheduleId} (length: ${schedule.availabilityView.length}):`, schedule.availabilityView.substring(0, 100) + '...');

            // Parse the availability view to create busy blocks
            // This is MORE RELIABLE than scheduleItems because it properly includes ALL events including recurring ones
            // Each character represents one interval (e.g., 30 min)
            let busyStartIndex: number | null = null;

            for (let i = 0; i <= schedule.availabilityView.length; i++) {
              const status = i < schedule.availabilityView.length ? schedule.availabilityView[i] : '0';
              const isBusy = status === '1' || status === '2' || status === '3';

              if (isBusy && busyStartIndex === null) {
                // Start of a busy block
                busyStartIndex = i;
              } else if (!isBusy && busyStartIndex !== null) {
                // End of a busy block - create the block
                const blockStart = new Date(startDate.getTime() + busyStartIndex * slotDuration * 60 * 1000);
                const blockEnd = new Date(startDate.getTime() + i * slotDuration * 60 * 1000);

                // Log for debugging (first few blocks only)
                if (otherAttendeeBusyBlocks.length < 10) {
                  const startET = blockStart.toLocaleString('en-US', {
                    timeZone: timezone,
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  });
                  const endET = blockEnd.toLocaleString('en-US', {
                    timeZone: timezone,
                    hour: 'numeric',
                    minute: '2-digit'
                  });
                  console.log(`[getMultiAttendeeAvailability] Attendee busy (from availabilityView): ${startET} - ${endET} ET`);
                }

                otherAttendeeBusyBlocks.push({
                  start: blockStart,
                  end: blockEnd,
                });

                busyStartIndex = null;
              }
            }

            console.log(`[getMultiAttendeeAvailability] Created ${otherAttendeeBusyBlocks.length} busy blocks from availabilityView for ${schedule.scheduleId}`);
          } else {
            // Fallback to scheduleItems if availabilityView is not available
            console.log(`[getMultiAttendeeAvailability] No availabilityView, falling back to scheduleItems for ${schedule.scheduleId}`);

            for (const item of schedule.scheduleItems || []) {
              // Include busy, tentative, and OOF as blocking
              if (item.status === 'busy' || item.status === 'tentative' || item.status === 'oof') {
                const itemStart = parseScheduleDateTime(item.start.dateTime, item.start.timeZone);
                const itemEnd = parseScheduleDateTime(item.end.dateTime, item.end.timeZone);

                // Log in ET for easier debugging
                const startET = itemStart.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' });
                const endET = itemEnd.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' });
                console.log(`[getMultiAttendeeAvailability] Attendee busy: ${item.start.dateTime} → ${startET}-${endET} ET (${item.status})`);

                otherAttendeeBusyBlocks.push({
                  start: itemStart,
                  end: itemEnd,
                });
              }
            }
          }
        }

        // Check for attendees we didn't get any response for
        for (const email of attendeeEmails) {
          if (!checkedAttendees.has(email.toLowerCase())) {
            failedAttendees.push(email);
          }
        }

        // Add specific warnings for failed attendees
        if (failedAttendees.length > 0) {
          const names = failedAttendees.map((e) => e.split('@')[0]).join(', ');
          warnings.push(`Could not verify calendar availability for: ${names}. Please confirm their availability manually.`);
          console.warn(`[getMultiAttendeeAvailability] Failed to check calendars for: ${failedAttendees.join(', ')}`);
        }

        console.log(`[getMultiAttendeeAvailability] Checked ${checkedAttendees.size}/${attendeeEmails.length} attendee(s), found ${otherAttendeeBusyBlocks.length} busy blocks`);
      } catch (scheduleError) {
        // getSchedule might fail if we don't have permission to view others' calendars
        console.error('[getMultiAttendeeAvailability] Could not check attendee calendars:', scheduleError);
        const attendeeNames = attendeeEmails.map((e) => e.split('@')[0]).join(', ');
        warnings.push(`⚠️ IMPORTANT: Could not verify calendar availability for: ${attendeeNames}. These times may conflict with their schedule - please verify before sending.`);
      }
    }

    // Merge all busy blocks
    const allBusyBlocks = [...primaryBusyBlocks, ...otherAttendeeBusyBlocks].sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );

    console.log(`[getMultiAttendeeAvailability] Total busy blocks: ${allBusyBlocks.length} (primary: ${primaryBusyBlocks.length}, attendees: ${otherAttendeeBusyBlocks.length})`);

    // Get holidays for the date range
    const holidaysThisYear = getUSHolidays(startDate.getFullYear());
    const holidaysNextYear = getUSHolidays(startDate.getFullYear() + 1);
    const allHolidays = new Set([...holidaysThisYear, ...holidaysNextYear]);

    // Generate candidate slots using TIMEZONE-AWARE date handling
    const slotsByDay: Map<string, MultiAttendeeSlot[]> = new Map();
    const current = new Date(startDate);

    console.log(`[getMultiAttendeeAvailability] Generating slots from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`[getMultiAttendeeAvailability] Found ${allBusyBlocks.length} busy blocks to check against`);

    while (current < endDate) {
      // Use timezone-aware day of week check
      const dayOfWeek = getDayOfWeekInTimezone(current, timezone);
      const dateStr = getDateStringInTimezone(current, timezone);

      // Skip weekends (in target timezone)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      // Skip holidays
      if (allHolidays.has(dateStr)) {
        console.log(`[getMultiAttendeeAvailability] Skipping holiday: ${dateStr}`);
        current.setDate(current.getDate() + 1);
        continue;
      }

      const dayKey = dateStr; // Use timezone-aware date string
      const daySlotsArr: MultiAttendeeSlot[] = [];

      // Get date components in target timezone for slot creation
      const yearInTz = parseInt(current.toLocaleDateString('en-US', { year: 'numeric', timeZone: timezone }));
      const monthInTz = parseInt(current.toLocaleDateString('en-US', { month: 'numeric', timeZone: timezone })) - 1;
      const dayInTz = parseInt(current.toLocaleDateString('en-US', { day: 'numeric', timeZone: timezone }));

      // Generate slots for this day
      for (let hour = businessHoursStart; hour < businessHoursEnd; hour++) {
        for (const minute of [0, 30]) {
          // Create slot time in the target timezone
          const slotStart = createDateInTimezone(yearInTz, monthInTz, dayInTz, hour, minute, timezone);

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

          // Skip if slot is in the past (compare actual times)
          if (slotStart <= new Date()) continue;

          // Skip if slot end is after business hours
          const endHourInTz = parseInt(slotEnd.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }));
          const endMinuteInTz = parseInt(slotEnd.toLocaleTimeString('en-US', { minute: 'numeric', timeZone: timezone }));
          if (endHourInTz > businessHoursEnd || (endHourInTz === businessHoursEnd && endMinuteInTz > 0)) {
            continue;
          }

          // Check if slot conflicts with any busy block
          const hasConflict = allBusyBlocks.some((busy) => {
            return slotStart < busy.end && slotEnd > busy.start;
          });

          if (!hasConflict) {
            // Format in EXACT email style so AI can copy directly without modification
            const dayName = slotStart.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });
            const month = slotStart.toLocaleDateString('en-US', { month: 'long', timeZone: timezone });
            const dayNum = slotStart.toLocaleDateString('en-US', { day: 'numeric', timeZone: timezone });
            const time = slotStart.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: timezone,
            });
            // Format: "Monday, January 5th at 9:00 AM ET" - ready for email
            const daySuffix = getDaySuffix(parseInt(dayNum));
            const formatted = `${dayName}, ${month} ${dayNum}${daySuffix} at ${time} ET`;

            daySlotsArr.push({
              start: slotStart,
              end: slotEnd,
              formatted,
            });
          }
        }
      }

      if (daySlotsArr.length > 0) {
        slotsByDay.set(dayKey, daySlotsArr);
      }

      current.setDate(current.getDate() + 1);

      if (slotsByDay.size >= 5) break;
    }

    // Get pending proposal counts if avoiding overbooked slots
    let pendingProposalCounts: Map<string, number> = new Map();
    if (avoidOverbooked) {
      try {
        pendingProposalCounts = await getPendingProposalCounts(primaryUserId, timezone);
        console.log(`[getMultiAttendeeAvailability] Found ${pendingProposalCounts.size} time slots with pending proposals`);
      } catch (err) {
        console.warn('[getMultiAttendeeAvailability] Could not fetch pending proposals:', err);
      }
    }

    // Select diverse slots with randomization and overbooked awareness
    const diverseSlots = selectDiverseSlotsAcrossDays(
      slotsByDay,
      maxSlots,
      seededRandom,
      pendingProposalCounts
    );

    const totalSlots = Array.from(slotsByDay.values()).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[getMultiAttendeeAvailability] Found ${totalSlots} slots across ${slotsByDay.size} days, returning ${diverseSlots.length} diverse slots (seed: ${seed.substring(0, 8)}...)`);

    return { slots: diverseSlots, warnings: warnings.length > 0 ? warnings : undefined };
  } catch (error) {
    console.error('[getMultiAttendeeAvailability] Error:', error);
    return { slots: [], error: (error as Error).message };
  }
}
