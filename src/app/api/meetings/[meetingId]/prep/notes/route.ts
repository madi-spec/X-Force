/**
 * POST /api/meetings/[meetingId]/prep/notes
 *
 * Upsert meeting prep notes for a user.
 * Supports auto-save with debouncing from the client.
 * When meeting_notes are saved, also creates an activity record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface NotesPayload {
  prep_notes?: string | null;
  meeting_notes?: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: NotesPayload = await request.json();

    // Validate - at least one field should be present
    if (body.prep_notes === undefined && body.meeting_notes === undefined) {
      return NextResponse.json(
        { error: 'No notes provided' },
        { status: 400 }
      );
    }

    // Get the meeting with context for activity creation
    const { data: meeting, error: meetingError } = await adminClient
      .from('activities')
      .select('id, subject, deal_id, company_id')
      .or(`id.eq.${meetingId},external_id.eq.${meetingId}`)
      .eq('type', 'meeting')
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Get user's internal ID
    const { data: userData } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    const internalUserId = userData?.id;

    // Upsert the notes
    const { data: notes, error: notesError } = await adminClient
      .from('meeting_prep_notes')
      .upsert(
        {
          meeting_id: meeting.id,
          user_id: user.id,
          prep_notes: body.prep_notes,
          meeting_notes: body.meeting_notes,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'meeting_id,user_id',
        }
      )
      .select()
      .single();

    if (notesError) {
      console.error('[MeetingNotesAPI] Error upserting notes:', notesError);
      return NextResponse.json(
        { error: 'Failed to save notes' },
        { status: 500 }
      );
    }

    // Create activity record when meeting_notes are provided and we have context
    if (body.meeting_notes && body.meeting_notes.trim() && internalUserId) {
      const notePreview = body.meeting_notes.length > 500
        ? body.meeting_notes.substring(0, 500) + '...'
        : body.meeting_notes;

      try {
        await adminClient.from('activities').insert({
          user_id: internalUserId,
          deal_id: meeting.deal_id,
          company_id: meeting.company_id,
          type: 'note',
          subject: `Meeting notes: ${meeting.subject || 'Untitled meeting'}`,
          body: notePreview,
          metadata: {
            source: 'meeting_prep',
            meeting_id: meeting.id,
            full_notes_available: body.meeting_notes.length > 500,
          },
          occurred_at: new Date().toISOString(),
        });
      } catch (activityErr) {
        // Log but don't fail the main request
        console.error('[MeetingNotesAPI] Error creating activity:', activityErr);
      }
    }

    return NextResponse.json({
      success: true,
      notes,
    });

  } catch (error) {
    console.error('[MeetingNotesAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save notes' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/meetings/[meetingId]/prep/notes
 *
 * Get meeting prep notes for a user.
 */
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

    // Get the meeting ID (handle both direct ID and external_id)
    const { data: meeting, error: meetingError } = await supabase
      .from('activities')
      .select('id')
      .or(`id.eq.${meetingId},external_id.eq.${meetingId}`)
      .eq('type', 'meeting')
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Get the notes
    const { data: notes, error: notesError } = await supabase
      .from('meeting_prep_notes')
      .select('prep_notes, meeting_notes, updated_at')
      .eq('meeting_id', meeting.id)
      .eq('user_id', user.id)
      .single();

    if (notesError && notesError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error('[MeetingNotesAPI] Error fetching notes:', notesError);
      return NextResponse.json(
        { error: 'Failed to fetch notes' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      notes: notes || { prep_notes: null, meeting_notes: null },
    });

  } catch (error) {
    console.error('[MeetingNotesAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}
