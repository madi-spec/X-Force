/**
 * Scheduler Preview API
 *
 * POST - Generate a preview of the scheduling email before creating the request
 * GET - Get company rep suggestion and context
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSchedulingEmail } from '@/lib/scheduler/emailGeneration';
import { getMultiAttendeeAvailability } from '@/lib/scheduler/calendarIntegration';
import { ATTENDEE_SIDE, INVITE_STATUS, MeetingType, ProposedTimeSlot } from '@/lib/scheduler/types';

/**
 * GET - Get company rep suggestion and context for scheduling
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get company products with owner (rep)
    const { data: companyProducts } = await admin
      .from('company_products')
      .select(`
        id,
        product_id,
        status,
        owner_user_id,
        owner:users!company_products_owner_user_id_fkey(id, name, email)
      `)
      .eq('company_id', companyId)
      .not('owner_user_id', 'is', null);

    // Get unique reps from company products
    // Note: Supabase joins return arrays, so we need to handle that
    const reps: Array<{ id: string; name: string; email: string }> = [];
    const seenIds = new Set<string>();

    for (const cp of companyProducts || []) {
      // Supabase returns joined data as an array
      const ownerData = cp.owner as { id: string; name: string; email: string }[] | null;
      const owner = Array.isArray(ownerData) ? ownerData[0] : ownerData;
      if (owner && !seenIds.has(owner.id)) {
        seenIds.add(owner.id);
        reps.push(owner);
      }
    }

    // Get company context
    const { data: company } = await admin
      .from('companies')
      .select('id, name, domain, industry')
      .eq('id', companyId)
      .single();

    // Get recent communications for context
    const { data: recentComms } = await admin
      .from('communications')
      .select('subject, content_preview, occurred_at')
      .eq('company_id', companyId)
      .order('occurred_at', { ascending: false })
      .limit(3);

    return NextResponse.json({
      suggestedReps: reps,
      company: company || null,
      recentActivity: recentComms?.map(c => c.subject).join('; ') || null,
    });
  } catch (error) {
    console.error('Error getting scheduler preview data:', error);
    return NextResponse.json(
      { error: 'Failed to get preview data' },
      { status: 500 }
    );
  }
}

/**
 * POST - Generate a preview email for the scheduling request
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      companyId,
      companyName,
      meetingType,
      durationMinutes,
      title,
      context,
      contactEmail,
      contactName,
      internalAttendeeEmails, // Array of internal attendee emails to check availability
    } = body;

    if (!companyId || !contactEmail) {
      return NextResponse.json(
        { error: 'companyId and contactEmail are required' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Get sender info - look up by auth_id
    const { data: sender } = await admin
      .from('users')
      .select('id, name, email')
      .eq('auth_id', user.id)
      .single();

    if (!sender) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get REAL available time slots by checking calendars
    // This checks the sender's calendar AND all internal attendees' calendars
    // Also excludes US holidays (like New Year's Day!)
    const attendeeEmails = (internalAttendeeEmails || []).filter(
      (email: string) => email !== sender.email
    );

    console.log('[Preview] Checking availability for:', {
      primaryUser: sender.email,
      otherAttendees: attendeeEmails,
      duration: durationMinutes || 30,
    });

    const availabilityResult = await getMultiAttendeeAvailability(
      sender.id,
      attendeeEmails,
      {
        slotDuration: durationMinutes || 30,
        maxSlots: 3,
        daysAhead: 10,
      }
    );

    const { slots, error: availError, warnings, source, calendarChecked } = availabilityResult;

    if (availError) {
      console.error('[Preview] Availability error:', availError);
    }
    console.log(`[Preview] Availability source: ${source}, calendarChecked: ${calendarChecked}`);

    // Convert slots to ProposedTimeSlot format
    const proposedTimes: ProposedTimeSlot[] = slots.map(slot => ({
      start: slot.start,
      end: slot.end,
      formatted: slot.formatted,
    }));

    // Debug: Log the formatted times being sent to email generation
    console.log('[Preview] Generated time slots:', proposedTimes.map(t => ({
      formatted: t.formatted,
      startISO: t.start.toISOString(),
      startET: t.start.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    })));
    console.log('[Preview] Current server time:', new Date().toISOString());
    console.log('[Preview] Current time in ET:', new Date().toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }));

    // Find available time slots for the next 2 weeks
    const dateRangeStart = new Date();
    dateRangeStart.setDate(dateRangeStart.getDate() + 1);
    const dateRangeEnd = new Date();
    dateRangeEnd.setDate(dateRangeEnd.getDate() + 14);

    // Build a minimal request object for email generation
    const mockRequest = {
      id: 'preview',
      created_by: sender?.id || user.id,
      deal_id: null,
      company_product_id: null,
      company_id: companyId,
      source_communication_id: null,
      meeting_type: (meetingType || 'discovery') as MeetingType,
      duration_minutes: durationMinutes || 30,
      title: title || `${meetingType || 'Meeting'} with ${companyName}`,
      context: context || null,
      meeting_platform: 'teams' as const,
      meeting_location: null,
      meeting_link: null,
      date_range_start: dateRangeStart.toISOString(),
      date_range_end: dateRangeEnd.toISOString(),
      preferred_times: { morning: true, afternoon: true, evening: false },
      avoid_days: [] as string[],
      timezone: 'America/New_York',
      status: 'initiated' as const,
      attempt_count: 0,
      no_show_count: 0,
      last_action_at: null,
      next_action_at: null,
      next_action_type: null,
      proposed_times: proposedTimes.map(t => t.start.toISOString()),
      scheduled_time: null,
      calendar_event_id: null,
      invite_accepted: false,
      completed_at: null,
      outcome: null,
      outcome_notes: null,
      email_thread_id: null,
      last_inbound_message_id: null,
      conversation_history: [] as never[],
      current_channel: 'email' as const,
      channel_progression: null,
      deescalation_state: null,
      persona: null,
      urgency: 'medium' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Build attendees array
    const attendees = [
      {
        id: 'preview-external',
        scheduling_request_id: 'preview',
        side: ATTENDEE_SIDE.EXTERNAL,
        user_id: null,
        contact_id: null,
        name: contactName || null,
        email: contactEmail,
        title: null,
        is_required: true,
        is_organizer: false,
        is_primary_contact: true,
        invite_status: INVITE_STATUS.PENDING,
        responded_at: null,
        created_at: new Date().toISOString(),
      },
    ];

    // Generate the email
    const { email, reasoning } = await generateSchedulingEmail({
      emailType: 'initial_outreach',
      request: mockRequest,
      attendees,
      proposedTimes,
      senderName: sender?.name || 'Sales Team',
      companyContext: {
        name: companyName,
      },
    });

    return NextResponse.json({
      email,
      reasoning,
      proposedTimes: proposedTimes.map(t => ({
        start: t.start.toISOString(),
        end: t.end.toISOString(),
        formatted: t.formatted,
      })),
      availability: {
        source,
        calendarChecked,
        warnings: warnings || [],
        error: availError || null,
      },
      // Keep legacy fields for backwards compatibility
      availabilityWarnings: warnings || [],
      availabilityError: availError || null,
    });
  } catch (error) {
    console.error('Error generating preview email:', error);
    return NextResponse.json(
      { error: 'Failed to generate email preview' },
      { status: 500 }
    );
  }
}
