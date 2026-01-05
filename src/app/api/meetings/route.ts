import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { startOfDay, endOfDay, addDays, format, isToday, isTomorrow } from 'date-fns';

interface MeetingActivity {
  id: string;
  type: string;
  subject: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  company_id: string | null;
  contact_id: string | null;
  external_id: string | null;
  excluded_at: string | null;
  excluded_by: string | null;
  exclusion_reason: string | null;
  company?: Array<{ id: string; name: string }> | { id: string; name: string } | null;
  contact?: Array<{ id: string; name: string; email: string }> | { id: string; name: string; email: string } | null;
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

export interface TranscriptData {
  id: string;
  title: string;
  summary: string | null;
  analysis: {
    sentiment: string | null;
    buyingSignals: number;
    actionItems: number;
    headline: string | null;
    topics?: string[];
    nextSteps?: string[];
  } | null;
}

export interface MeetingWithContent {
  id: string;
  subject: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  company_id: string | null;
  external_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  attendee_count: number;
  duration_minutes: number | null;
  join_url: string | null;
  hasTranscript: boolean;
  hasNotes: boolean;
  hasAnalysis: boolean;
  transcription_id: string | null;
  transcript: TranscriptData | null;
  needsCompanyAssignment: boolean;
  excluded_at: string | null;
  exclusion_reason: string | null;
}

interface GroupedUpcoming {
  today: MeetingWithContent[];
  tomorrow: MeetingWithContent[];
  later: MeetingWithContent[];
  totalCount: number;
}

interface GroupedPast {
  byDate: Record<string, MeetingWithContent[]>;
  totalCount: number;
}

interface MeetingsStats {
  today_count: number;
  this_week_count: number;
  analyzed_count: number;
  pending_actions_count: number;
  processing_count: number;
  excluded_count: number;
}

interface ProcessingTranscript {
  id: string;
  activity_id: string | null;
  title: string;
  status: string;
  progress: number;
  word_count: number;
  source: string | null;
}

/**
 * GET /api/meetings
 *
 * Returns upcoming and past meetings with content indicators
 *
 * Query params:
 * - pastDays: Number of days of past meetings (default 7)
 * - upcomingDays: Number of days of upcoming meetings (default 2, max 14)
 * - showExcluded: Show excluded meetings (default false)
 * - expandUpcoming: Show all upcoming meetings beyond 2 days (default false)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const pastDays = Math.min(parseInt(searchParams.get('pastDays') || '7', 10), 90);
    const upcomingDays = searchParams.get('expandUpcoming') === 'true' ? 14 : 2;
    const showExcluded = searchParams.get('showExcluded') === 'true';

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

    const now = new Date();
    const upcomingEnd = endOfDay(addDays(now, upcomingDays)).toISOString();
    const pastCutoff = startOfDay(addDays(now, -pastDays)).toISOString();

    // Build base query for upcoming meetings
    let upcomingQuery = supabase
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
        excluded_at,
        excluded_by,
        exclusion_reason,
        company:companies(id, name),
        contact:contacts(id, name, email)
      `)
      .eq('type', 'meeting')
      .eq('user_id', profile.id)
      .gte('occurred_at', now.toISOString())
      .lte('occurred_at', upcomingEnd)
      .order('occurred_at', { ascending: true });

    // Filter exclusions unless showing excluded
    if (!showExcluded) {
      upcomingQuery = upcomingQuery.is('excluded_at', null);
    }

    const { data: upcomingMeetings, error: upcomingError } = await upcomingQuery;

    if (upcomingError) {
      console.error('[Meetings API] Upcoming error:', upcomingError);
      return NextResponse.json({ error: 'Failed to fetch upcoming meetings' }, { status: 500 });
    }

    // Build base query for past meetings
    let pastQuery = supabase
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
        excluded_at,
        excluded_by,
        exclusion_reason,
        company:companies(id, name),
        contact:contacts(id, name, email)
      `)
      .eq('type', 'meeting')
      .eq('user_id', profile.id)
      .lt('occurred_at', now.toISOString())
      .gte('occurred_at', pastCutoff)
      .order('occurred_at', { ascending: false });

    // Filter exclusions unless showing excluded
    if (!showExcluded) {
      pastQuery = pastQuery.is('excluded_at', null);
    }

    const { data: pastMeetings, error: pastError } = await pastQuery;

    if (pastError) {
      console.error('[Meetings API] Past error:', pastError);
      return NextResponse.json({ error: 'Failed to fetch past meetings' }, { status: 500 });
    }

    // Deduplicate meetings by:
    // 1. Exact external_id match (same event synced twice)
    // 2. Subject + time proximity (same meeting with different external_ids)
    const deduplicateMeetings = (meetings: MeetingActivity[]): MeetingActivity[] => {
      const result: MeetingActivity[] = [];
      const seenExternalIds = new Set<string>();
      const seenSubjectTimes: Array<{ subject: string; time: number; meeting: MeetingActivity }> = [];

      for (const meeting of meetings) {
        // Check 1: Exact external_id match
        if (meeting.external_id && seenExternalIds.has(meeting.external_id)) {
          continue; // Skip exact duplicate
        }

        // Check 2: Subject + time proximity (catches same meeting with different external_ids)
        const meetingTime = new Date(meeting.occurred_at).getTime();
        const subjectKey = (meeting.subject || '').toLowerCase().trim();
        const thirtyMinutes = 30 * 60 * 1000;

        const isDuplicate = seenSubjectTimes.some(seen => {
          const timeDiff = Math.abs(meetingTime - seen.time);
          return seen.subject === subjectKey && timeDiff < thirtyMinutes;
        });

        if (isDuplicate) {
          continue; // Skip - we already have this meeting
        }

        // Not a duplicate - add to results and tracking
        if (meeting.external_id) {
          seenExternalIds.add(meeting.external_id);
        }
        seenSubjectTimes.push({ subject: subjectKey, time: meetingTime, meeting });
        result.push(meeting);
      }

      return result;
    };

    const dedupedUpcoming = deduplicateMeetings(upcomingMeetings || []);
    const dedupedPast = deduplicateMeetings(pastMeetings || []);

    // Get activity IDs for lookups
    const allActivityIds = [...dedupedUpcoming, ...dedupedPast].map(m => m.id);
    const allExternalIds = [...dedupedUpcoming, ...dedupedPast]
      .map(m => m.external_id)
      .filter((id): id is string => id !== null);

    // Fetch transcriptions and prep notes
    const [{ data: transcriptions }, { data: prepNotes }] = await Promise.all([
      supabase
        .from('meeting_transcriptions')
        .select('id, activity_id, title, analysis, summary')
        .in('activity_id', allActivityIds.length > 0 ? allActivityIds : ['__none__']),
      supabase
        .from('meeting_prep_notes')
        .select('id, meeting_id, prep_notes, meeting_notes')
        .in('meeting_id', allExternalIds.length > 0 ? allExternalIds : ['__none__'])
    ]);

    // Build lookup maps
    const transcriptMap = new Map<string, MeetingTranscription>();
    (transcriptions || []).forEach((t: MeetingTranscription) => {
      if (t.activity_id) transcriptMap.set(t.activity_id, t);
    });

    const notesMap = new Map<string, MeetingPrepNote>();
    (prepNotes || []).forEach((n: MeetingPrepNote) => {
      if (n.meeting_id) notesMap.set(n.meeting_id, n);
    });

    // Transform meeting to enriched format
    const enrichMeeting = (meeting: MeetingActivity): MeetingWithContent => {
      const transcript = transcriptMap.get(meeting.id);
      const notes = meeting.external_id ? notesMap.get(meeting.external_id) : null;
      // Supabase returns object for many-to-one, array for one-to-many
      const companyData = Array.isArray(meeting.company)
        ? meeting.company?.[0] ?? null
        : meeting.company ?? null;
      const contactData = Array.isArray(meeting.contact)
        ? meeting.contact?.[0] ?? null
        : meeting.contact ?? null;
      const metadata = meeting.metadata || {};
      const attendees = (metadata.attendees as Array<Record<string, unknown>>) || [];

      // Calculate duration from metadata if available
      const startTime = metadata.start_time || metadata.startTime;
      const endTime = metadata.end_time || metadata.endTime;
      let durationMinutes: number | null = null;

      if (startTime && endTime) {
        const start = new Date(startTime as string);
        const end = new Date(endTime as string);
        durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
      }

      // Build transcript data if available
      let transcriptData: TranscriptData | null = null;
      if (transcript) {
        const analysis = transcript.analysis as Record<string, unknown> | null;
        transcriptData = {
          id: transcript.id,
          title: transcript.title,
          summary: transcript.summary,
          analysis: analysis ? {
            sentiment: (analysis.sentiment as string) || null,
            buyingSignals: (analysis.buying_signals as number) || (analysis.buyingSignals as number) || 0,
            actionItems: Array.isArray(analysis.action_items)
              ? analysis.action_items.length
              : (analysis.actionItems as number) || 0,
            headline: (analysis.headline as string) || null,
            topics: (analysis.topics as string[]) || [],
            nextSteps: (analysis.next_steps as string[]) || (analysis.nextSteps as string[]) || [],
          } : null,
        };
      }

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
        duration_minutes: durationMinutes,
        join_url: (metadata.joinUrl || metadata.join_url || null) as string | null,
        hasTranscript: !!transcript,
        hasNotes: !!(notes?.prep_notes || notes?.meeting_notes),
        hasAnalysis: !!(transcript?.analysis),
        transcription_id: transcript?.id || null,
        transcript: transcriptData,
        needsCompanyAssignment: meeting.company_id === null,
        excluded_at: meeting.excluded_at,
        exclusion_reason: meeting.exclusion_reason,
      };
    };

    // Group upcoming meetings by day
    const groupedUpcoming: GroupedUpcoming = {
      today: [],
      tomorrow: [],
      later: [],
      totalCount: dedupedUpcoming.length,
    };

    dedupedUpcoming.forEach(meeting => {
      const enriched = enrichMeeting(meeting);
      const meetingDate = new Date(meeting.occurred_at);

      if (isToday(meetingDate)) {
        groupedUpcoming.today.push(enriched);
      } else if (isTomorrow(meetingDate)) {
        groupedUpcoming.tomorrow.push(enriched);
      } else {
        groupedUpcoming.later.push(enriched);
      }
    });

    // Sort each group by time
    groupedUpcoming.today.sort((a, b) =>
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );
    groupedUpcoming.tomorrow.sort((a, b) =>
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );
    groupedUpcoming.later.sort((a, b) =>
      new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );

    // Group past meetings by date
    const groupedPast: GroupedPast = {
      byDate: {},
      totalCount: dedupedPast.length,
    };

    dedupedPast.forEach(meeting => {
      const enriched = enrichMeeting(meeting);
      const dateKey = format(new Date(meeting.occurred_at), 'yyyy-MM-dd');

      if (!groupedPast.byDate[dateKey]) {
        groupedPast.byDate[dateKey] = [];
      }
      groupedPast.byDate[dateKey].push(enriched);
    });

    // Sort meetings within each date group by time (descending - most recent first)
    Object.keys(groupedPast.byDate).forEach(dateKey => {
      groupedPast.byDate[dateKey].sort((a, b) =>
        new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      );
    });

    // Fetch processing queue (transcripts being analyzed)
    const { data: processingTranscripts } = await supabase
      .from('meeting_transcriptions')
      .select('id, activity_id, title, status, processing_progress, word_count, source')
      .eq('user_id', profile.id)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(20);

    const processing: ProcessingTranscript[] = (processingTranscripts || []).map(t => ({
      id: t.id,
      activity_id: t.activity_id,
      title: t.title,
      status: t.status,
      progress: t.processing_progress || 0,
      word_count: t.word_count || 0,
      source: t.source,
    }));

    // Get excluded count for stats
    const { count: excludedCount } = await supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'meeting')
      .eq('user_id', profile.id)
      .not('excluded_at', 'is', null);

    // Calculate stats
    const stats: MeetingsStats = {
      today_count: groupedUpcoming.today.length,
      this_week_count: dedupedUpcoming.length + dedupedPast.filter(m => {
        const meetingDate = new Date(m.occurred_at);
        const weekAgo = addDays(now, -7);
        return meetingDate >= weekAgo;
      }).length,
      analyzed_count: [...dedupedUpcoming, ...dedupedPast].filter(m =>
        transcriptMap.has(m.id) && transcriptMap.get(m.id)?.analysis
      ).length,
      pending_actions_count: 0, // Can be populated later from action_items table
      processing_count: processing.length,
      excluded_count: excludedCount || 0,
    };

    return NextResponse.json({
      upcoming: groupedUpcoming,
      past: groupedPast,
      processing,
      stats,
    });

  } catch (error) {
    console.error('[Meetings API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meetings' },
      { status: 500 }
    );
  }
}
