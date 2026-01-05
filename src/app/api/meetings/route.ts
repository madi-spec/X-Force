import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface MeetingActivity {
  id: string;
  type: string;
  subject: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  company_id: string | null;
  contact_id: string | null;
  external_id: string | null;
  // Supabase returns joined relations as arrays
  company?: Array<{ id: string; name: string }> | null;
  contact?: Array<{ id: string; name: string; email: string }> | null;
}

interface MeetingTranscription {
  id: string;
  activity_id: string;
  title: string;
  analysis: Record<string, unknown> | null;
  summary: string | null;
}

interface MeetingPrepNote {
  id: string;
  meeting_id: string;
  prep_notes: string | null;
  meeting_notes: string | null;
}

export interface MeetingWithContent {
  id: string;
  subject: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  company_id: string | null;
  external_id: string | null;
  company_name: string | null;
  hasTranscript: boolean;
  hasNotes: boolean;
  hasAnalysis: boolean;
  transcription_id: string | null;
}

/**
 * GET /api/meetings
 *
 * Returns upcoming and past meetings with content indicators
 *
 * Query params:
 * - pastDays: Number of days of past meetings (default 30)
 * - limit: Max results per section (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const pastDays = parseInt(searchParams.get('pastDays') || '30', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile for user_id
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const pastCutoff = new Date(Date.now() - pastDays * 24 * 60 * 60 * 1000).toISOString();

    // Fetch upcoming meetings
    const { data: upcomingMeetings, error: upcomingError } = await supabase
      .from('activities')
      .select(`
        id,
        type,
        subject,
        occurred_at,
        metadata,
        company_id,
        contact_id,
        external_id,
        company:companies(id, name),
        contact:contacts(id, name, email)
      `)
      .eq('type', 'meeting')
      .eq('user_id', profile.id)
      .gte('occurred_at', now)
      .order('occurred_at', { ascending: true })
      .limit(limit);

    if (upcomingError) {
      console.error('[Meetings API] Upcoming error:', upcomingError);
      return NextResponse.json({ error: 'Failed to fetch upcoming meetings' }, { status: 500 });
    }

    // Fetch past meetings
    const { data: pastMeetings, error: pastError } = await supabase
      .from('activities')
      .select(`
        id,
        type,
        subject,
        occurred_at,
        metadata,
        company_id,
        contact_id,
        external_id,
        company:companies(id, name),
        contact:contacts(id, name, email)
      `)
      .eq('type', 'meeting')
      .eq('user_id', profile.id)
      .lt('occurred_at', now)
      .gte('occurred_at', pastCutoff)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (pastError) {
      console.error('[Meetings API] Past error:', pastError);
      return NextResponse.json({ error: 'Failed to fetch past meetings' }, { status: 500 });
    }

    // Get external_ids for past meetings to check notes
    const pastExternalIds = (pastMeetings || [])
      .map((m) => m.external_id)
      .filter((id): id is string => id !== null);

    // Get activity IDs for transcript lookup
    const pastActivityIds = (pastMeetings || []).map((m) => m.id);

    // Fetch transcriptions for past meetings (by activity_id)
    const { data: transcriptions } = await supabase
      .from('meeting_transcriptions')
      .select('id, activity_id, title, analysis, summary')
      .in('activity_id', pastActivityIds.length > 0 ? pastActivityIds : ['__none__']);

    // Fetch prep notes for past meetings (by external meeting ID)
    const { data: prepNotes } = await supabase
      .from('meeting_prep_notes')
      .select('id, meeting_id, prep_notes, meeting_notes')
      .in('meeting_id', pastExternalIds.length > 0 ? pastExternalIds : ['__none__']);

    // Build transcript lookup by activity_id
    const transcriptMap = new Map<string, MeetingTranscription>();
    (transcriptions || []).forEach((t: MeetingTranscription) => {
      if (t.activity_id) {
        transcriptMap.set(t.activity_id, t);
      }
    });

    // Build notes lookup by external_id (meeting_id in prep_notes)
    const notesMap = new Map<string, MeetingPrepNote>();
    (prepNotes || []).forEach((n: MeetingPrepNote) => {
      if (n.meeting_id) {
        notesMap.set(n.meeting_id, n);
      }
    });

    // Enrich past meetings with content indicators
    const pastMeetingsEnriched: MeetingWithContent[] = (pastMeetings || []).map((meeting) => {
      const transcript = transcriptMap.get(meeting.id);
      const notes = meeting.external_id ? notesMap.get(meeting.external_id) : null;

      const companyData = meeting.company?.[0] ?? null;

      return {
        id: meeting.id,
        subject: meeting.subject || 'Untitled Meeting',
        occurred_at: meeting.occurred_at,
        metadata: meeting.metadata || {},
        company_id: meeting.company_id,
        external_id: meeting.external_id,
        company_name: companyData?.name || null,
        hasTranscript: !!transcript,
        hasNotes: !!(notes?.prep_notes || notes?.meeting_notes),
        hasAnalysis: !!(transcript?.analysis),
        transcription_id: transcript?.id || null,
      };
    });

    // Format upcoming meetings
    const upcomingFormatted = (upcomingMeetings || []).map((meeting) => {
      const companyData = meeting.company?.[0] ?? null;
      const contactData = meeting.contact?.[0] ?? null;
      const metadata = meeting.metadata || {};
      const attendees = (metadata.attendees as Array<Record<string, unknown>>) || [];

      return {
        id: meeting.id,
        subject: meeting.subject || 'Untitled Meeting',
        occurred_at: meeting.occurred_at,
        metadata,
        company_id: meeting.company_id,
        external_id: meeting.external_id,
        company_name: companyData?.name || null,
        contact_name: contactData?.name || null,
        attendee_count: attendees.length,
        join_url: metadata.joinUrl || metadata.join_url || null,
      };
    });

    return NextResponse.json({
      upcoming: upcomingFormatted,
      past: pastMeetingsEnriched,
    });

  } catch (error) {
    console.error('[Meetings API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meetings' },
      { status: 500 }
    );
  }
}
