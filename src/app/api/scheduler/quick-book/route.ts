import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createCalendarEvent } from '@/lib/microsoft/calendarSync';

/**
 * POST /api/scheduler/quick-book
 *
 * Directly books a meeting without the AI scheduler flow
 * Creates calendar event immediately and sends invites
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's internal ID
    const { data: profile } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      meeting_type,
      duration_minutes,
      title,
      meeting_platform,
      meeting_location,
      scheduled_time,
      deal_id,
      company_id,
      internal_attendees = [],
      external_attendees = [],
    } = body;

    // Validate required fields
    if (!scheduled_time) {
      return NextResponse.json({ error: 'Scheduled time is required' }, { status: 400 });
    }

    if (!external_attendees.length) {
      return NextResponse.json({ error: 'At least one external attendee is required' }, { status: 400 });
    }

    // Calculate end time
    const startTime = new Date(scheduled_time);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + (duration_minutes || 30));

    // Build attendee list (emails only)
    const attendeeEmails: string[] = [];

    // Add external attendees
    for (const ext of external_attendees) {
      if (ext.email) {
        attendeeEmails.push(ext.email);
      }
    }

    // Add internal attendees (get their emails)
    if (internal_attendees.length > 0) {
      const adminSupabase = createAdminClient();
      const { data: internalUsers } = await adminSupabase
        .from('users')
        .select('email')
        .in('id', internal_attendees);

      for (const u of internalUsers || []) {
        if (u.email && u.email !== profile.email) {
          attendeeEmails.push(u.email);
        }
      }
    }

    // Determine if it's an online meeting
    const isOnlineMeeting = ['teams', 'zoom', 'google_meet'].includes(meeting_platform);

    // Build meeting description
    const description = buildMeetingDescription({
      meeting_type,
      external_attendees,
      company_id,
    });

    // Create the calendar event
    // Note: location is included in the description for now
    const calendarResult = await createCalendarEvent(profile.id, {
      subject: title,
      body: meeting_location ? `<p><strong>Location:</strong> ${meeting_location}</p>${description}` : description,
      start: startTime,
      end: endTime,
      attendees: attendeeEmails,
      isOnlineMeeting,
    });

    if (!calendarResult.success) {
      console.error('[QuickBook] Calendar event creation failed:', calendarResult.error);
      return NextResponse.json(
        { error: calendarResult.error || 'Failed to create calendar event' },
        { status: 500 }
      );
    }

    // Optionally create a scheduling_requests record for tracking (status: confirmed)
    const adminSupabase = createAdminClient();

    const { data: schedulingRequest, error: requestError } = await adminSupabase
      .from('scheduling_requests')
      .insert({
        created_by: profile.id,
        meeting_type: meeting_type || 'custom',
        duration_minutes: duration_minutes || 30,
        title,
        meeting_platform: meeting_platform || 'teams',
        meeting_location,
        scheduled_time: startTime.toISOString(),
        calendar_event_id: calendarResult.eventId,
        meeting_link: calendarResult.joinUrl,
        status: 'confirmed',
        deal_id: deal_id || null,
        company_id: company_id || null,
        timezone: 'America/New_York',
        date_range_start: startTime.toISOString().split('T')[0],
        date_range_end: startTime.toISOString().split('T')[0],
        preferred_times: { morning: true, afternoon: true, evening: false },
        avoid_days: [],
      })
      .select()
      .single();

    if (requestError) {
      console.warn('[QuickBook] Failed to create tracking record:', requestError);
      // Don't fail the request - the calendar event was created successfully
    }

    // Add attendees to the scheduling request if created
    if (schedulingRequest) {
      const attendeesToInsert = [];

      // Add internal attendees
      for (const userId of internal_attendees) {
        const user = await adminSupabase
          .from('users')
          .select('email, name')
          .eq('id', userId)
          .single();

        attendeesToInsert.push({
          scheduling_request_id: schedulingRequest.id,
          user_id: userId,
          email: user.data?.email || '',
          name: user.data?.name || '',
          side: 'internal',
          is_organizer: userId === profile.id,
          is_primary_contact: false,
        });
      }

      // Add external attendees
      for (const ext of external_attendees) {
        attendeesToInsert.push({
          scheduling_request_id: schedulingRequest.id,
          email: ext.email,
          name: ext.name || '',
          side: 'external',
          is_organizer: false,
          is_primary_contact: external_attendees.indexOf(ext) === 0,
        });
      }

      if (attendeesToInsert.length > 0) {
        await adminSupabase
          .from('scheduling_attendees')
          .insert(attendeesToInsert);
      }

      // Log the action
      await adminSupabase
        .from('scheduling_actions')
        .insert({
          scheduling_request_id: schedulingRequest.id,
          action_type: 'quick_booked',
          actor: 'user',
          message_content: `Meeting booked via Quick Book for ${startTime.toLocaleString()}`,
        });
    }

    return NextResponse.json({
      success: true,
      eventId: calendarResult.eventId,
      joinUrl: calendarResult.joinUrl,
      schedulingRequestId: schedulingRequest?.id,
    });

  } catch (err) {
    console.error('[QuickBook API] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildMeetingDescription(options: {
  meeting_type?: string;
  external_attendees: Array<{ name?: string; email: string }>;
  company_id?: string;
}): string {
  const lines: string[] = [];

  if (options.meeting_type) {
    const typeLabels: Record<string, string> = {
      discovery: 'Discovery Call',
      demo: 'Product Demo',
      follow_up: 'Follow-up Call',
      technical: 'Technical Discussion',
      executive: 'Executive Briefing',
      custom: 'Meeting',
    };
    lines.push(`<p><strong>Type:</strong> ${typeLabels[options.meeting_type] || options.meeting_type}</p>`);
  }

  if (options.external_attendees.length > 0) {
    lines.push('<p><strong>External Attendees:</strong></p><ul>');
    for (const attendee of options.external_attendees) {
      lines.push(`<li>${attendee.name || attendee.email}</li>`);
    }
    lines.push('</ul>');
  }

  lines.push('<hr/>');
  lines.push('<p><em>Booked via X-FORCE Quick Book</em></p>');

  return lines.join('\n');
}
