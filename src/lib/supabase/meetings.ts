import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Meeting,
  MeetingWithRelations,
  MeetingActionItem,
  ProcessingTranscript,
  MeetingsStats,
  TranscriptStatus,
  TranscriptSource,
} from '@/types/meetings';

// Type for action item with assignee from database
interface ActionItemWithAssignee extends MeetingActionItem {
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  } | null;
}

// ============================================
// MEETINGS QUERIES
// ============================================

export async function getMeetings({
  organizationId,
  startDate,
  endDate,
  includeExcluded = false,
  customerId,
  limit = 50,
  offset = 0,
}: {
  organizationId: string;
  startDate?: string;
  endDate?: string;
  includeExcluded?: boolean;
  customerId?: string;
  limit?: number;
  offset?: number;
}): Promise<MeetingWithRelations[]> {
  const supabase = await createClient();

  let query = supabase
    .from('meetings')
    .select(`
      *,
      customer:customers(id, name),
      attendees:meeting_attendees(*),
      prep:meeting_prep(*),
      transcript:meeting_transcripts(
        *,
        analysis:meeting_transcript_analysis(*)
      ),
      action_items:meeting_action_items(
        *,
        assignee:users(id, name, email, avatar_url)
      )
    `)
    .eq('organization_id', organizationId)
    .order('start_time', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!includeExcluded) {
    query = query.eq('excluded', false);
  }

  if (startDate) {
    query = query.gte('start_time', startDate);
  }

  if (endDate) {
    query = query.lte('start_time', endDate);
  }

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching meetings:', error);
    throw new Error('Failed to fetch meetings');
  }

  return (data || []).map(transformMeetingRow);
}

export async function getUpcomingMeetings(
  organizationId: string,
  includeExcluded = false
): Promise<MeetingWithRelations[]> {
  const now = new Date().toISOString();
  const supabase = await createClient();

  let query = supabase
    .from('meetings')
    .select(`
      *,
      customer:customers(id, name),
      attendees:meeting_attendees(*),
      prep:meeting_prep(*),
      transcript:meeting_transcripts(
        *,
        analysis:meeting_transcript_analysis(*)
      ),
      action_items:meeting_action_items(
        *,
        assignee:users(id, name, email, avatar_url)
      )
    `)
    .eq('organization_id', organizationId)
    .gte('start_time', now)
    .order('start_time', { ascending: true })
    .limit(20);

  if (!includeExcluded) {
    query = query.eq('excluded', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching upcoming meetings:', error);
    throw new Error('Failed to fetch upcoming meetings');
  }

  return (data || []).map(transformMeetingRow);
}

export async function getPastMeetings(
  organizationId: string,
  includeExcluded = false,
  limit = 20
): Promise<MeetingWithRelations[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from('meetings')
    .select(`
      *,
      customer:customers(id, name),
      attendees:meeting_attendees(*),
      prep:meeting_prep(*),
      transcript:meeting_transcripts(
        *,
        analysis:meeting_transcript_analysis(*)
      ),
      action_items:meeting_action_items(
        *,
        assignee:users(id, name, email, avatar_url)
      )
    `)
    .eq('organization_id', organizationId)
    .lt('start_time', now)
    .order('start_time', { ascending: false })
    .limit(limit);

  if (!includeExcluded) {
    query = query.eq('excluded', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching past meetings:', error);
    throw new Error('Failed to fetch past meetings');
  }

  return (data || []).map(transformMeetingRow);
}

export async function getMeetingById(
  meetingId: string
): Promise<MeetingWithRelations | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meetings')
    .select(`
      *,
      customer:customers(id, name),
      attendees:meeting_attendees(*),
      prep:meeting_prep(*),
      transcript:meeting_transcripts(
        *,
        analysis:meeting_transcript_analysis(*)
      ),
      action_items:meeting_action_items(
        *,
        assignee:users(id, name, email, avatar_url)
      )
    `)
    .eq('id', meetingId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching meeting:', error);
    throw new Error('Failed to fetch meeting');
  }

  return data ? transformMeetingRow(data) : null;
}

// ============================================
// MEETINGS MUTATIONS
// ============================================

export async function updateMeeting(
  meetingId: string,
  updates: Partial<Meeting>
): Promise<Meeting> {
  // Use admin client to bypass RLS (no UPDATE policy on activities)
  const adminClient = createAdminClient();

  // Meetings are stored in the activities table
  const { data, error } = await adminClient
    .from('activities')
    .update(updates)
    .eq('id', meetingId)
    .select()
    .single();

  if (error) {
    console.error('Error updating meeting:', error);
    throw new Error('Failed to update meeting');
  }

  return data;
}

export async function excludeMeeting(
  meetingId: string,
  userId: string
): Promise<Meeting> {
  // Use admin client to bypass RLS (no UPDATE policy on activities)
  const adminClient = createAdminClient();

  // Meetings are stored in the activities table
  const { data, error } = await adminClient
    .from('activities')
    .update({
      excluded_at: new Date().toISOString(),
      excluded_by: userId,
    })
    .eq('id', meetingId)
    .select()
    .single();

  if (error) {
    console.error('Error excluding meeting:', error);
    throw new Error('Failed to exclude meeting');
  }

  return data;
}

export async function restoreMeeting(meetingId: string): Promise<Meeting> {
  // Use admin client to bypass RLS (no UPDATE policy on activities)
  const adminClient = createAdminClient();

  // Meetings are stored in the activities table
  const { data, error } = await adminClient
    .from('activities')
    .update({
      excluded_at: null,
      excluded_by: null,
      exclusion_reason: null,
    })
    .eq('id', meetingId)
    .select()
    .single();

  if (error) {
    console.error('Error restoring meeting:', error);
    throw new Error('Failed to restore meeting');
  }

  return data;
}

export async function assignCustomerToMeeting(
  meetingId: string,
  customerId: string | null
): Promise<Meeting> {
  // Use admin client to bypass RLS (no UPDATE policy on activities)
  const adminClient = createAdminClient();

  // Meetings are stored in the activities table with company_id
  const { data, error } = await adminClient
    .from('activities')
    .update({ company_id: customerId })
    .eq('id', meetingId)
    .select()
    .single();

  if (error) {
    console.error('Error assigning customer:', error);
    throw new Error('Failed to assign customer');
  }

  return data;
}

// ============================================
// ACTION ITEMS QUERIES
// ============================================

export async function getActionItemsByMeeting(
  meetingId: string
): Promise<ActionItemWithAssignee[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meeting_action_items')
    .select(`
      *,
      assignee:users(id, name, email, avatar_url)
    `)
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching action items:', error);
    throw new Error('Failed to fetch action items');
  }

  return data || [];
}

export async function getPendingActionItems(
  organizationId: string
): Promise<ActionItemWithAssignee[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meeting_action_items')
    .select(`
      *,
      assignee:users(id, name, email, avatar_url)
    `)
    .eq('organization_id', organizationId)
    .neq('status', 'done')
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error fetching pending action items:', error);
    throw new Error('Failed to fetch pending action items');
  }

  return data || [];
}

// ============================================
// ACTION ITEMS MUTATIONS
// ============================================

export async function createActionItem(
  organizationId: string,
  input: {
    text: string;
    assignee_id?: string;
    due_date?: string;
    meeting_id?: string;
    transcript_id?: string;
  },
  createdByUserId: string
): Promise<ActionItemWithAssignee> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meeting_action_items')
    .insert({
      organization_id: organizationId,
      text: input.text,
      assignee_id: input.assignee_id || null,
      due_date: input.due_date || null,
      meeting_id: input.meeting_id || null,
      transcript_id: input.transcript_id || null,
      source: 'manual',
      created_by: createdByUserId,
      status: 'pending',
    })
    .select(`
      *,
      assignee:users(id, name, email, avatar_url)
    `)
    .single();

  if (error) {
    console.error('Error creating action item:', error);
    throw new Error('Failed to create action item');
  }

  return data;
}

export async function updateActionItem(
  actionItemId: string,
  updates: {
    text?: string;
    assignee_id?: string | null;
    due_date?: string | null;
    status?: 'pending' | 'in_progress' | 'done';
  }
): Promise<ActionItemWithAssignee> {
  const supabase = await createClient();

  // Handle status change - set completed_at for 'done', clear for others
  const updateData: Record<string, unknown> = { ...updates };
  if (updates.status === 'done') {
    updateData.completed_at = new Date().toISOString();
  } else if (updates.status) {
    // Status is changing but not to 'done', clear completion fields
    updateData.completed_at = null;
    updateData.completed_by = null;
  }

  const { data, error } = await supabase
    .from('meeting_action_items')
    .update(updateData)
    .eq('id', actionItemId)
    .select(`
      *,
      assignee:users(id, name, email, avatar_url)
    `)
    .single();

  if (error) {
    console.error('Error updating action item:', error);
    throw new Error('Failed to update action item');
  }

  return data;
}

export async function deleteActionItem(actionItemId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('meeting_action_items')
    .delete()
    .eq('id', actionItemId);

  if (error) {
    console.error('Error deleting action item:', error);
    throw new Error('Failed to delete action item');
  }
}

// ============================================
// TRANSCRIPTS QUERIES
// ============================================

export async function getProcessingTranscripts(
  organizationId: string
): Promise<ProcessingTranscript[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meeting_transcripts')
    .select('id, meeting_id, title, status, processing_progress, word_count, source')
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching processing transcripts:', error);
    throw new Error('Failed to fetch processing transcripts');
  }

  return (data || []).map((t) => ({
    id: t.id,
    meeting_id: t.meeting_id,
    activity_id: null, // For backwards compatibility
    title: t.title || 'Untitled Transcript',
    status: t.status as TranscriptStatus,
    progress: t.processing_progress,
    word_count: t.word_count,
    source: t.source as TranscriptSource,
  }));
}

export async function getTranscriptAnalysis(transcriptId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meeting_transcript_analysis')
    .select('*')
    .eq('transcript_id', transcriptId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching transcript analysis:', error);
    throw new Error('Failed to fetch transcript analysis');
  }

  return data;
}

// ============================================
// STATS QUERIES
// ============================================

export async function getMeetingsStats(
  organizationId: string
): Promise<MeetingsStats> {
  const supabase = await createClient();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay())).toISOString();

  // Get today's meeting count
  const { count: todayCount } = await supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('excluded', false)
    .gte('start_time', startOfDay)
    .lt('start_time', endOfDay);

  // Get this week's meeting count
  const { count: weekCount } = await supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('excluded', false)
    .gte('start_time', startOfWeek)
    .lt('start_time', endOfWeek);

  // Get analyzed transcript count
  const { count: analyzedCount } = await supabase
    .from('meeting_transcripts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'analyzed');

  // Get pending action items count
  const { count: pendingActionsCount } = await supabase
    .from('meeting_action_items')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .neq('status', 'done');

  // Get processing transcripts count
  const { count: processingCount } = await supabase
    .from('meeting_transcripts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .in('status', ['pending', 'processing']);

  // Get excluded meetings count
  const { count: excludedCount } = await supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('excluded', true);

  return {
    today_count: todayCount || 0,
    this_week_count: weekCount || 0,
    analyzed_count: analyzedCount || 0,
    pending_actions_count: pendingActionsCount || 0,
    processing_count: processingCount || 0,
    excluded_count: excludedCount || 0,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformMeetingRow(row: any): MeetingWithRelations {
  return {
    ...row,
    customer: row.customer || null,
    attendees: row.attendees || [],
    prep: row.prep?.[0] || row.prep || null,
    transcript: row.transcript?.[0] ? {
      ...row.transcript[0],
      analysis: row.transcript[0].analysis?.[0] || row.transcript[0].analysis || null,
    } : null,
    action_items: row.action_items || [],
  };
}
