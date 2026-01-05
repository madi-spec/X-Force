import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { MeetingsStats, ProcessingTranscript, TranscriptStatus, TranscriptSource } from '@/types/meetings';
import { startOfDay, endOfDay, addDays, isToday, isTomorrow } from 'date-fns';

// Meeting as returned from activities table
export interface MeetingFromActivity {
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
  transcript: {
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
  } | null;
  needsCompanyAssignment: boolean;
  excluded_at: string | null;
  exclusion_reason: string | null;
}

export interface GroupedUpcoming {
  today: MeetingFromActivity[];
  tomorrow: MeetingFromActivity[];
  later: MeetingFromActivity[];
  totalCount: number;
}

export interface GroupedPast {
  byDate: Record<string, MeetingFromActivity[]>;
  totalCount: number;
}

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

// Helper to return empty data structure
function getEmptyData(): {
  upcoming: GroupedUpcoming;
  past: GroupedPast;
  processing: ProcessingTranscript[];
  stats: MeetingsStats;
  customers: { id: string; name: string }[];
  teamMembers: { id: string; name: string; email: string }[];
  userId: string | null;
} {
  return {
    upcoming: { today: [], tomorrow: [], later: [], totalCount: 0 },
    past: { byDate: {}, totalCount: 0 },
    processing: [],
    stats: {
      today_count: 0,
      this_week_count: 0,
      analyzed_count: 0,
      pending_actions_count: 0,
      processing_count: 0,
      excluded_count: 0,
    },
    customers: [],
    teamMembers: [],
    userId: null,
  };
}

export async function getMeetingsPageData(includeExcluded = false) {
  const supabase = await createClient();

  // Get current user from auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    // Return empty data for unauthenticated users
    return getEmptyData();
  }

  // Get user profile to get user_id (activities use user_id, not auth.uid)
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    // Return empty data if no profile found
    return getEmptyData();
  }

  const now = new Date();
  const upcomingEnd = endOfDay(addDays(now, 14)).toISOString();
  const pastCutoff = startOfDay(addDays(now, -30)).toISOString();

  // Build upcoming meetings query
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

  if (!includeExcluded) {
    upcomingQuery = upcomingQuery.is('excluded_at', null);
  }

  // Build past meetings query
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
    .order('occurred_at', { ascending: false })
    .limit(50);

  if (!includeExcluded) {
    pastQuery = pastQuery.is('excluded_at', null);
  }

  // Use admin client for companies/users to bypass RLS (these are reference data)
  const adminClient = createAdminClient();

  // Fetch all data in parallel
  const [
    { data: upcomingMeetings, error: upcomingError },
    { data: pastMeetings, error: pastError },
    { data: customers, error: customersError },
    { data: teamMembers, error: teamMembersError },
  ] = await Promise.all([
    upcomingQuery,
    pastQuery,
    adminClient.from('companies').select('id, name').order('name').limit(2000),
    adminClient
      .from('users')
      .select('id, name, email')
      .order('name'),
  ]);

  if (upcomingError) {
    console.error('Error fetching upcoming meetings:', upcomingError);
  }
  if (pastError) {
    console.error('Error fetching past meetings:', pastError);
  }
  if (customersError) {
    console.error('[Meetings] Error fetching customers:', JSON.stringify(customersError, null, 2));
  }
  if (teamMembersError) {
    console.error('[Meetings] Error fetching team members:', JSON.stringify(teamMembersError, null, 2));
  }

  console.log('[Meetings] Fetched data - customers:', customers?.length ?? 0, 'teamMembers:', teamMembers?.length ?? 0);
  if (customers && customers.length > 0) {
    console.log('[Meetings] First customer:', customers[0]?.name);
  }

  // Deduplicate meetings
  const deduplicateMeetings = (meetings: MeetingActivity[]): MeetingActivity[] => {
    const result: MeetingActivity[] = [];
    const seenExternalIds = new Set<string>();
    const seenSubjectTimes: Array<{ subject: string; time: number }> = [];

    for (const meeting of meetings) {
      if (meeting.external_id && seenExternalIds.has(meeting.external_id)) {
        continue;
      }

      const meetingTime = new Date(meeting.occurred_at).getTime();
      const subjectKey = (meeting.subject || '').toLowerCase().trim();
      const thirtyMinutes = 30 * 60 * 1000;

      const isDuplicate = seenSubjectTimes.some(seen => {
        const timeDiff = Math.abs(meetingTime - seen.time);
        return seen.subject === subjectKey && timeDiff < thirtyMinutes;
      });

      if (isDuplicate) continue;

      if (meeting.external_id) {
        seenExternalIds.add(meeting.external_id);
      }
      seenSubjectTimes.push({ subject: subjectKey, time: meetingTime });
      result.push(meeting);
    }

    return result;
  };

  const dedupedUpcoming = deduplicateMeetings((upcomingMeetings as MeetingActivity[]) || []);
  const dedupedPast = deduplicateMeetings((pastMeetings as MeetingActivity[]) || []);

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
  const enrichMeeting = (meeting: MeetingActivity): MeetingFromActivity => {
    const transcript = transcriptMap.get(meeting.id);
    const notes = meeting.external_id ? notesMap.get(meeting.external_id) : null;

    const companyData = Array.isArray(meeting.company)
      ? meeting.company?.[0] ?? null
      : meeting.company ?? null;
    const contactData = Array.isArray(meeting.contact)
      ? meeting.contact?.[0] ?? null
      : meeting.contact ?? null;
    const metadata = meeting.metadata || {};
    const attendees = (metadata.attendees as Array<Record<string, unknown>>) || [];

    // Calculate duration from metadata
    const startTime = metadata.start_time || metadata.startTime;
    const endTime = metadata.end_time || metadata.endTime;
    let durationMinutes: number | null = null;

    if (startTime && endTime) {
      const start = new Date(startTime as string);
      const end = new Date(endTime as string);
      durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    }

    // Build transcript data if available
    let transcriptData: MeetingFromActivity['transcript'] = null;
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

  // Group past meetings by date
  const groupedPast: GroupedPast = {
    byDate: {},
    totalCount: dedupedPast.length,
  };

  dedupedPast.forEach(meeting => {
    const enriched = enrichMeeting(meeting);
    const dateKey = new Date(meeting.occurred_at).toISOString().split('T')[0];

    if (!groupedPast.byDate[dateKey]) {
      groupedPast.byDate[dateKey] = [];
    }
    groupedPast.byDate[dateKey].push(enriched);
  });

  // Fetch processing queue
  const { data: processingTranscripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, activity_id, title, status, processing_progress, word_count, source')
    .eq('user_id', profile.id)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(20);

  const processing: ProcessingTranscript[] = (processingTranscripts || []).map(t => ({
    id: t.id,
    meeting_id: null,
    activity_id: t.activity_id,
    title: t.title || 'Untitled Transcript',
    status: t.status as TranscriptStatus,
    progress: t.processing_progress || 0,
    word_count: t.word_count || 0,
    source: t.source as TranscriptSource,
  }));

  // Get excluded count for stats
  const { count: excludedCount } = await supabase
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'meeting')
    .eq('user_id', profile.id)
    .not('excluded_at', 'is', null);

  // Calculate stats (only count non-excluded meetings)
  const nonExcludedUpcoming = dedupedUpcoming.filter(m => !m.excluded_at);
  const nonExcludedPast = dedupedPast.filter(m => !m.excluded_at);

  const stats: MeetingsStats = {
    today_count: groupedUpcoming.today.filter(m => !m.excluded_at).length,
    this_week_count: nonExcludedUpcoming.length + nonExcludedPast.filter(m => {
      const meetingDate = new Date(m.occurred_at);
      const weekAgo = addDays(now, -7);
      return meetingDate >= weekAgo;
    }).length,
    analyzed_count: [...nonExcludedUpcoming, ...nonExcludedPast].filter(m =>
      transcriptMap.has(m.id) && transcriptMap.get(m.id)?.analysis
    ).length,
    pending_actions_count: 0,
    processing_count: processing.length,
    excluded_count: excludedCount || 0,
  };

  return {
    upcoming: groupedUpcoming,
    past: groupedPast,
    processing,
    stats,
    customers: customers || [],
    teamMembers: teamMembers || [],
    userId: profile.id,
  };
}

async function getCustomers() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('companies')
    .select('id, name')
    .order('name');

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }

  return data || [];
}

async function getTeamMembers() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')
    .order('name');

  if (error) {
    console.error('Error fetching team members:', error);
    return [];
  }

  return data || [];
}
