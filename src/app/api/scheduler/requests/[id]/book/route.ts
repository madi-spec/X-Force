import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMeetingCalendarEvent } from '@/lib/scheduler/calendarIntegration';
import { MEETING_PLATFORMS, SCHEDULING_STATUS } from '@/lib/scheduler/types';

/**
 * POST /api/scheduler/requests/[id]/book
 *
 * Manually book a calendar event for a scheduling request.
 * Used when:
 * - Automatic booking failed after time acceptance
 * - User wants to manually confirm a meeting
 * - Rescheduling after counter-proposal
 *
 * Body (optional):
 * - scheduled_time: Override the selected time (ISO string)
 * - duration_minutes: Override duration
 * - title: Custom meeting title
 * - platform: 'teams' | 'zoom' | 'google_meet' | 'phone' | 'in_person'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // Parse optional body
    let body: {
      scheduled_time?: string;
      duration_minutes?: number;
      title?: string;
      platform?: string;
    } = {};

    try {
      body = await request.json();
    } catch {
      // Empty body is ok
    }

    // Get the scheduling request
    const adminSupabase = createAdminClient();
    const { data: schedulingRequest, error: requestError } = await adminSupabase
      .from('scheduling_requests')
      .select(`
        *,
        attendees:scheduling_attendees(*),
        company:companies(id, name)
      `)
      .eq('id', id)
      .single();

    if (requestError || !schedulingRequest) {
      return NextResponse.json(
        { error: 'Scheduling request not found' },
        { status: 404 }
      );
    }

    // Determine the scheduled time
    const scheduledTime = body.scheduled_time
      ? new Date(body.scheduled_time)
      : schedulingRequest.scheduled_time
        ? new Date(schedulingRequest.scheduled_time)
        : null;

    if (!scheduledTime) {
      return NextResponse.json(
        { error: 'No scheduled time available. Please provide scheduled_time in body or select a time first.' },
        { status: 400 }
      );
    }

    // Check if already booked
    if (schedulingRequest.calendar_event_id) {
      return NextResponse.json({
        success: true,
        alreadyBooked: true,
        eventId: schedulingRequest.calendar_event_id,
        message: 'Calendar event already exists for this request',
      });
    }

    // Create calendar event
    const result = await createMeetingCalendarEvent({
      schedulingRequestId: id,
      userId: userData.id,
      scheduledTime,
      durationMinutes: body.duration_minutes || schedulingRequest.duration_minutes,
      title: body.title || schedulingRequest.title || undefined,
      platform: (body.platform || schedulingRequest.meeting_platform || 'teams') as
                typeof MEETING_PLATFORMS[keyof typeof MEETING_PLATFORMS],
      location: schedulingRequest.meeting_location || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: `Failed to create calendar event: ${result.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      eventId: result.eventId,
      meetingLink: result.meetingLink,
      scheduledTime: scheduledTime.toISOString(),
      message: 'Calendar event created and invites sent',
    });
  } catch (err) {
    console.error('Error in scheduler book endpoint:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scheduler/requests/[id]/book
 *
 * Check booking status for a scheduling request.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get booking status
    const adminSupabase = createAdminClient();
    const { data: schedulingRequest, error: requestError } = await adminSupabase
      .from('scheduling_requests')
      .select(`
        id,
        status,
        scheduled_time,
        calendar_event_id,
        meeting_link,
        invite_accepted,
        duration_minutes,
        meeting_platform
      `)
      .eq('id', id)
      .single();

    if (requestError || !schedulingRequest) {
      return NextResponse.json(
        { error: 'Scheduling request not found' },
        { status: 404 }
      );
    }

    const isBooked = !!schedulingRequest.calendar_event_id;
    const bookableStatuses = [SCHEDULING_STATUS.CONFIRMING, SCHEDULING_STATUS.NEGOTIATING] as string[];
    const canBook = schedulingRequest.scheduled_time &&
                    bookableStatuses.includes(schedulingRequest.status as string);

    return NextResponse.json({
      isBooked,
      canBook: !isBooked && canBook,
      scheduledTime: schedulingRequest.scheduled_time,
      calendarEventId: schedulingRequest.calendar_event_id,
      meetingLink: schedulingRequest.meeting_link,
      inviteAccepted: schedulingRequest.invite_accepted,
      status: schedulingRequest.status,
    });
  } catch (err) {
    console.error('Error in scheduler book status endpoint:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
