/**
 * Daily Planning Engine
 *
 * Calculates available work time from calendar and fills it with
 * highest-momentum actions.
 *
 * Key Functions:
 * - calculateDailyCapacity: Get available minutes from calendar
 * - buildTimeBlocks: Create time slots around meetings
 * - planDayActions: Fill blocks with items sorted by momentum
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { MicrosoftGraphClient } from '@/lib/microsoft/graph';
import { getValidToken } from '@/lib/microsoft/auth';
import {
  DailyCapacity,
  DailyPlan,
  TimeBlock,
  CommandCenterItem,
  RepTimeProfile,
  PlannedAction,
} from '@/types/commandCenter';
import { getDuration } from './actionDurations';
import { calculateMomentumScore } from './momentumScoring';

// ============================================
// TYPES
// ============================================

interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: Array<{ emailAddress: { address: string; name?: string } }>;
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string;
  showAs?: string;
}

// ============================================
// GET REP TIME PROFILE
// ============================================

const DEFAULT_PROFILE: Omit<RepTimeProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  work_start_time: '09:00',
  work_end_time: '17:00',
  work_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  timezone: 'America/New_York',
  meeting_prep_buffer: 15,
  reactive_buffer: 60,
  focus_block_preference: 60,
  action_durations: {},
  prefer_calls_morning: true,
  prefer_email_batching: true,
  max_calls_per_day: 20,
  max_emails_per_day: 50,
  total_actions_completed: 0,
  avg_actions_per_day: 0,
};

export async function getRepTimeProfile(userId: string): Promise<RepTimeProfile> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('rep_time_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data) {
    return data as RepTimeProfile;
  }

  // Create default profile if none exists
  const { data: newProfile, error } = await supabase
    .from('rep_time_profiles')
    .insert({ user_id: userId, ...DEFAULT_PROFILE })
    .select()
    .single();

  if (error) {
    console.error('[DailyPlanner] Error creating profile:', error);
    return { id: '', user_id: userId, created_at: '', updated_at: '', ...DEFAULT_PROFILE };
  }

  return newProfile as RepTimeProfile;
}

// ============================================
// FETCH CALENDAR EVENTS
// ============================================

async function getCalendarEventsForDay(
  userId: string,
  date: Date,
  timezone: string = 'America/New_York'
): Promise<CalendarEvent[]> {
  const token = await getValidToken(userId);
  if (!token) {
    return [];
  }

  const client = new MicrosoftGraphClient(token);

  // Format dates for the user's timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const startDateTime = `${dateStr}T00:00:00`;
  const endDateTime = `${dateStr}T23:59:59`;

  try {
    const events = await client.getCalendarEvents({
      startDateTime,
      endDateTime,
      top: 50,
      timezone,
    });

    return events.value || [];
  } catch (error) {
    console.error('[DailyPlanner] Error fetching calendar:', error);
    return [];
  }
}

// ============================================
// CALCULATE DAILY CAPACITY
// ============================================

/**
 * Calculate available work time for a given day
 */
export async function calculateDailyCapacity(
  userId: string,
  date: Date
): Promise<DailyCapacity> {
  const profile = await getRepTimeProfile(userId);
  const timezone = profile.timezone || 'America/New_York';
  const events = await getCalendarEventsForDay(userId, date, timezone);

  // Parse work hours (these are in user's local timezone, e.g. 9 = 9 AM EST)
  const [startHour, startMin] = profile.work_start_time.split(':').map(Number);
  const [endHour, endMin] = profile.work_end_time.split(':').map(Number);

  // Work hours in minutes since midnight (user's timezone)
  const workStartMinutes = startHour * 60 + startMin;
  const workEndMinutes = endHour * 60 + endMin;

  // Total work minutes
  const totalWorkMinutes = workEndMinutes - workStartMinutes;

  // Get the date string we're looking at (in user's timezone)
  const targetDateStr = getDateStrInTimezone(date, timezone);

  // Calculate meeting time and identify external meetings
  let meetingMinutes = 0;
  const externalMeetings: CalendarEvent[] = [];
  const validEvents: CalendarEvent[] = [];

  for (const event of events) {
    // Parse event times (UTC)
    const eventStart = parseGraphDateTime(event.start.dateTime, event.start.timeZone);
    const eventEnd = parseGraphDateTime(event.end.dateTime, event.end.timeZone);

    // Get event times in user's timezone (minutes since midnight)
    const eventStartMinutes = getMinutesSinceMidnight(eventStart, timezone);
    const eventEndMinutes = getMinutesSinceMidnight(eventEnd, timezone);

    // Check if event is on the target date (in user's timezone)
    const eventDateStr = getDateStrInTimezone(eventStart, timezone);
    if (eventDateStr !== targetDateStr) {
      continue;
    }

    // Skip if entirely outside work hours (in user's timezone)
    if (eventEndMinutes <= workStartMinutes || eventStartMinutes >= workEndMinutes) {
      continue;
    }

    validEvents.push(event);

    // Clamp to work hours
    const clampedStartMinutes = Math.max(eventStartMinutes, workStartMinutes);
    const clampedEndMinutes = Math.min(eventEndMinutes, workEndMinutes);
    const duration = clampedEndMinutes - clampedStartMinutes;
    meetingMinutes += duration;

    // Check if external (has non-company attendees)
    const hasExternalAttendees = event.attendees?.some(
      (a) => !isInternalEmail(a.emailAddress.address)
    );

    if (hasExternalAttendees) {
      externalMeetings.push(event);
    }
  }

  // Prep buffer (15 min before each external meeting)
  const prepBufferMinutes = externalMeetings.length * profile.meeting_prep_buffer;

  // Reactive buffer
  const reactiveBufferMinutes = profile.reactive_buffer;

  // Available time
  const availableMinutes = Math.max(
    0,
    totalWorkMinutes - meetingMinutes - prepBufferMinutes - reactiveBufferMinutes
  );

  // Build time blocks (pass timezone for proper calculations)
  const timeBlocks = buildTimeBlocks(
    workStartMinutes,
    workEndMinutes,
    validEvents,
    profile.meeting_prep_buffer,
    timezone,
    targetDateStr
  );

  return {
    total_work_minutes: totalWorkMinutes,
    meeting_minutes: meetingMinutes,
    prep_buffer_minutes: prepBufferMinutes,
    reactive_buffer_minutes: reactiveBufferMinutes,
    available_minutes: availableMinutes,
    time_blocks: timeBlocks,
  };
}

// ============================================
// BUILD TIME BLOCKS
// ============================================

function buildTimeBlocks(
  workStartMinutes: number,
  workEndMinutes: number,
  events: CalendarEvent[],
  prepBufferMinutes: number,
  timezone: string,
  targetDateStr: string
): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  let currentMinutes = workStartMinutes;

  // Helper to convert minutes since midnight to a time string (HH:MM)
  const minutesToTimeStr = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Helper to create ISO string from date string and minutes
  const toISOString = (dateStr: string, mins: number) => {
    return `${dateStr}T${minutesToTimeStr(mins)}:00`;
  };

  // Sort events by start time in user's timezone
  const sortedEvents = [...events].sort((a, b) => {
    const aStart = parseGraphDateTime(a.start.dateTime, a.start.timeZone);
    const bStart = parseGraphDateTime(b.start.dateTime, b.start.timeZone);
    return getMinutesSinceMidnight(aStart, timezone) - getMinutesSinceMidnight(bStart, timezone);
  });

  for (const event of sortedEvents) {
    const eventStart = parseGraphDateTime(event.start.dateTime, event.start.timeZone);
    const eventEnd = parseGraphDateTime(event.end.dateTime, event.end.timeZone);

    // Get event times in user's timezone (minutes since midnight)
    const eventStartMinutes = getMinutesSinceMidnight(eventStart, timezone);
    const eventEndMinutes = getMinutesSinceMidnight(eventEnd, timezone);

    // Clamp to work hours
    const clampedStartMinutes = Math.max(eventStartMinutes, workStartMinutes);
    const clampedEndMinutes = Math.min(eventEndMinutes, workEndMinutes);

    // Check if external meeting
    const isExternal = event.attendees?.some(
      (a) => !isInternalEmail(a.emailAddress.address)
    );

    // Add prep block before external meetings
    if (isExternal && prepBufferMinutes > 0) {
      const prepStartMinutes = Math.max(clampedStartMinutes - prepBufferMinutes, workStartMinutes);

      // Available block before prep
      if (currentMinutes < prepStartMinutes) {
        blocks.push({
          start: toISOString(targetDateStr, currentMinutes),
          end: toISOString(targetDateStr, prepStartMinutes),
          duration_minutes: prepStartMinutes - currentMinutes,
          type: 'available',
        });
      }

      // Prep block
      blocks.push({
        start: toISOString(targetDateStr, prepStartMinutes),
        end: toISOString(targetDateStr, clampedStartMinutes),
        duration_minutes: clampedStartMinutes - prepStartMinutes,
        type: 'prep',
        meeting_id: event.id,
        meeting_title: event.subject,
        is_external: true,
      });

      currentMinutes = clampedStartMinutes;
    } else {
      // Available block before meeting
      if (currentMinutes < clampedStartMinutes) {
        blocks.push({
          start: toISOString(targetDateStr, currentMinutes),
          end: toISOString(targetDateStr, clampedStartMinutes),
          duration_minutes: clampedStartMinutes - currentMinutes,
          type: 'available',
        });
      }
    }

    // Meeting block
    blocks.push({
      start: toISOString(targetDateStr, clampedStartMinutes),
      end: toISOString(targetDateStr, clampedEndMinutes),
      duration_minutes: clampedEndMinutes - clampedStartMinutes,
      type: 'meeting',
      meeting_id: event.id,
      meeting_title: event.subject,
      is_external: isExternal,
    });

    currentMinutes = clampedEndMinutes;
  }

  // Final available block after all meetings
  if (currentMinutes < workEndMinutes) {
    blocks.push({
      start: toISOString(targetDateStr, currentMinutes),
      end: toISOString(targetDateStr, workEndMinutes),
      duration_minutes: workEndMinutes - currentMinutes,
      type: 'available',
    });
  }

  return blocks;
}

// ============================================
// PLAN DAY ACTIONS
// ============================================

/**
 * Generate a daily plan by filling available time blocks with items
 */
export async function generateDailyPlan(userId: string, date?: Date): Promise<DailyPlan> {
  const planDate = date || new Date();

  const supabase = createAdminClient();

  // Get profile first to know user's timezone
  const profile = await getRepTimeProfile(userId);
  const timezone = profile.timezone || 'America/New_York';

  // Get date string in user's timezone
  const dateStr = getDateStrInTimezone(planDate, timezone);

  // Get capacity
  const capacity = await calculateDailyCapacity(userId, planDate);

  // Get pending items sorted by momentum
  const { data: items } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('momentum_score', { ascending: false });

  const pendingItems = (items || []) as CommandCenterItem[];

  // Fill available blocks with items
  const plannedItemIds: string[] = [];
  let totalPlannedMinutes = 0;
  let totalPotentialValue = 0;

  // Process each available block
  const filledBlocks = capacity.time_blocks.map((block) => {
    if (block.type !== 'available') return block;

    const plannedActions: PlannedAction[] = [];
    let remainingMinutes = block.duration_minutes;

    // Find items that fit in this block
    for (const item of pendingItems) {
      if (plannedItemIds.includes(item.id)) continue; // Already planned
      if (remainingMinutes <= 0) break;

      const duration = item.estimated_minutes || getDuration(item.action_type, profile.action_durations);

      if (duration <= remainingMinutes) {
        plannedActions.push({
          item_id: item.id,
          action_type: item.action_type,
          title: item.title,
          estimated_minutes: duration,
          momentum_score: item.momentum_score,
          deal_value: item.deal_value,
        });

        plannedItemIds.push(item.id);
        remainingMinutes -= duration;
        totalPlannedMinutes += duration;
        totalPotentialValue += (item.deal_value || 0) * (item.deal_probability || 0.5);
      }
    }

    return {
      ...block,
      planned_items: plannedActions,
    };
  });

  // Calculate overflow
  const overflowItems = pendingItems.filter((item) => !plannedItemIds.includes(item.id));

  // Upsert daily plan
  const planData: Partial<DailyPlan> = {
    user_id: userId,
    plan_date: dateStr,
    total_work_minutes: capacity.total_work_minutes,
    meeting_minutes: capacity.meeting_minutes,
    prep_buffer_minutes: capacity.prep_buffer_minutes,
    reactive_buffer_minutes: capacity.reactive_buffer_minutes,
    available_minutes: capacity.available_minutes,
    planned_minutes: totalPlannedMinutes,
    time_blocks: filledBlocks,
    planned_item_ids: plannedItemIds,
    total_potential_value: totalPotentialValue,
    items_planned: plannedItemIds.length,
    generated_at: new Date().toISOString(),
    last_refreshed_at: new Date().toISOString(),
  };

  const { data: savedPlan, error } = await supabase
    .from('daily_plans')
    .upsert(planData, { onConflict: 'user_id,plan_date' })
    .select()
    .single();

  if (error) {
    console.error('[DailyPlanner] Error saving plan:', error);
    throw error;
  }

  // Update items with planned date
  if (plannedItemIds.length > 0) {
    await supabase
      .from('command_center_items')
      .update({ planned_for_date: dateStr })
      .in('id', plannedItemIds);
  }

  return savedPlan as DailyPlan;
}

/**
 * Get existing plan or generate new one
 */
export async function getDailyPlan(userId: string, date?: Date): Promise<DailyPlan | null> {
  const planDate = date || new Date();

  // Get profile to know user's timezone
  const profile = await getRepTimeProfile(userId);
  const timezone = profile.timezone || 'America/New_York';

  // Get date string in user's timezone
  const dateStr = getDateStrInTimezone(planDate, timezone);

  const supabase = createAdminClient();

  const { data: existingPlan } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_date', dateStr)
    .single();

  if (existingPlan) {
    return existingPlan as DailyPlan;
  }

  return null;
}

/**
 * Refresh an existing plan (e.g., after calendar change)
 */
export async function refreshDailyPlan(userId: string, date?: Date): Promise<DailyPlan> {
  return generateDailyPlan(userId, date);
}

// ============================================
// HELPERS
// ============================================

const INTERNAL_DOMAINS = new Set([
  'x-rai.com',
  'xrai.com',
  'xrailabs.com',
  'affiliatedtech.com',
]);

function isInternalEmail(email: string): boolean {
  const domain = email.toLowerCase().split('@')[1];
  return domain ? INTERNAL_DOMAINS.has(domain) : false;
}

/**
 * Parse Microsoft Graph datetime string correctly
 * Graph returns times like "2025-12-19T15:00:00.0000000" with timeZone: "UTC"
 * But without the 'Z' suffix, new Date() treats it as local time
 */
function parseGraphDateTime(dateTimeStr: string, timeZone?: string): Date {
  // If the timezone is UTC and there's no Z suffix, add it
  if (timeZone === 'UTC' && !dateTimeStr.endsWith('Z')) {
    return new Date(dateTimeStr + 'Z');
  }
  // If no timezone specified but string lacks timezone info, assume UTC
  if (!dateTimeStr.includes('Z') && !dateTimeStr.includes('+') && !dateTimeStr.includes('-', 10)) {
    return new Date(dateTimeStr + 'Z');
  }
  return new Date(dateTimeStr);
}

/**
 * Get the hour (0-23) of a Date in a specific timezone
 */
function getHourInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  });
  const hourStr = formatter.format(date);
  return parseInt(hourStr, 10);
}

/**
 * Get the date string (YYYY-MM-DD) in a specific timezone
 */
function getDateStrInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);  // Returns YYYY-MM-DD format
}

/**
 * Check if a time (in UTC) falls within work hours in a specific timezone
 */
function isWithinWorkHours(
  eventTime: Date,
  workStartHour: number,
  workEndHour: number,
  timezone: string
): boolean {
  const eventHour = getHourInTimezone(eventTime, timezone);
  return eventHour >= workStartHour && eventHour < workEndHour;
}

/**
 * Get the minutes since midnight for a Date in a specific timezone
 */
function getMinutesSinceMidnight(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return hour * 60 + minute;
}

/**
 * Get current time block index
 */
export function getCurrentBlockIndex(blocks: TimeBlock[]): number {
  const now = new Date();

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const start = new Date(block.start);
    const end = new Date(block.end);

    if (now >= start && now < end) {
      return i;
    }
  }

  return -1;
}

/**
 * Get next available block
 */
export function getNextAvailableBlock(blocks: TimeBlock[]): TimeBlock | null {
  const now = new Date();

  for (const block of blocks) {
    if (block.type !== 'available') continue;

    const end = new Date(block.end);
    if (end > now) {
      return block;
    }
  }

  return null;
}
