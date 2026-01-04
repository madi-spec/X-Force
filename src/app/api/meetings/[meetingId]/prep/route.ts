/**
 * GET /api/meetings/[meetingId]/prep
 *
 * Returns enhanced meeting prep data including:
 * - AI-generated prep (reusing existing functions)
 * - Matched collateral
 * - Software links
 * - Past context links
 * - User notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildEnhancedMeetingPrep, type MeetingInput } from '@/lib/meetingPrep/buildEnhancedPrep';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Look up the meeting - check both ID and external_id (Microsoft Graph ID)
    const { data: meeting, error: meetingError } = await supabase
      .from('activities')
      .select(`
        id,
        title,
        scheduled_at,
        duration_minutes,
        metadata,
        company_id,
        companies (
          id,
          name
        )
      `)
      .or(`id.eq.${meetingId},external_id.eq.${meetingId}`)
      .eq('activity_type', 'meeting')
      .single();

    if (meetingError || !meeting) {
      console.error('[MeetingPrepAPI] Meeting not found:', meetingError);
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Extract meeting data
    const metadata = meeting.metadata as Record<string, unknown> || {};
    const attendees = (metadata.attendees as Array<{ email?: string; emailAddress?: { address?: string } }>) || [];
    const attendeeEmails = attendees
      .map(a => a.email || a.emailAddress?.address)
      .filter((email): email is string => Boolean(email));

    // Calculate end time from start time and duration
    const startTime = new Date(meeting.scheduled_at);
    const endTime = new Date(startTime.getTime() + (meeting.duration_minutes || 30) * 60000);

    // Get deal ID if associated
    const dealId = metadata.deal_id as string | null;

    // Build the meeting input
    const meetingInput: MeetingInput = {
      title: meeting.title || 'Untitled Meeting',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      attendeeEmails,
      joinUrl: metadata.joinUrl as string | null || metadata.join_url as string | null,
      dealId,
      companyId: meeting.company_id,
    };

    // Build enhanced prep
    const enhancedPrep = await buildEnhancedMeetingPrep(
      user.id,
      meeting.id,
      meetingInput
    );

    return NextResponse.json({
      success: true,
      prep: enhancedPrep,
    });

  } catch (error) {
    console.error('[MeetingPrepAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate meeting prep' },
      { status: 500 }
    );
  }
}
