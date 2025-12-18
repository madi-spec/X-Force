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
