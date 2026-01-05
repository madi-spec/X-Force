# Phase 2: API Routes and Server Actions

## Objective
Create all server-side data fetching and mutation functions for the Meetings page.

## Prerequisites
- Phase 1 complete (database tables exist)
- TypeScript types from Phase 1 available
- Supabase client configured

---

## Step 2.1: Create Supabase Query Helpers

Create file: `lib/supabase/meetings.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import type {
  Meeting,
  MeetingWithDetails,
  ActionItemWithAssignee,
  TranscriptWithAnalysis,
  ProcessingTranscript,
  MeetingsStats,
  UpdateMeetingInput,
  CreateActionItemInput,
  UpdateActionItemInput,
} from '@/types/meetings';

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
}): Promise<MeetingWithDetails[]> {
  const supabase = await createClient();

  let query = supabase
    .from('meetings')
    .select(`
      *,
      customer:customers(id, name),
      attendees:meeting_attendees(*),
      prep:meeting_prep(*),
      transcript:transcripts(
        *,
        analysis:transcript_analysis(*)
      ),
      action_items(
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
): Promise<MeetingWithDetails[]> {
  const now = new Date().toISOString();
  
  return getMeetings({
    organizationId,
    startDate: now,
    includeExcluded,
    limit: 20,
  });
}

export async function getPastMeetings(
  organizationId: string,
  includeExcluded = false,
  limit = 20
): Promise<MeetingWithDetails[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase
    .from('meetings')
    .select(`
      *,
      customer:customers(id, name),
      attendees:meeting_attendees(*),
      prep:meeting_prep(*),
      transcript:transcripts(
        *,
        analysis:transcript_analysis(*)
      ),
      action_items(
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
): Promise<MeetingWithDetails | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meetings')
    .select(`
      *,
      customer:customers(id, name),
      attendees:meeting_attendees(*),
      prep:meeting_prep(*),
      transcript:transcripts(
        *,
        analysis:transcript_analysis(*)
      ),
      action_items(
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
  updates: UpdateMeetingInput
): Promise<Meeting> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meetings')
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meetings')
    .update({
      excluded: true,
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meetings')
    .update({
      excluded: false,
      excluded_at: null,
      excluded_by: null,
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meetings')
    .update({ customer_id: customerId })
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
    .from('action_items')
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
    .from('action_items')
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
  input: CreateActionItemInput,
  userId: string
): Promise<ActionItemWithAssignee> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('action_items')
    .insert({
      organization_id: organizationId,
      text: input.text,
      assignee_id: input.assignee_id || null,
      due_date: input.due_date || null,
      meeting_id: input.meeting_id || null,
      transcript_id: input.transcript_id || null,
      source: 'manual',
      created_by: userId,
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
  updates: UpdateActionItemInput
): Promise<ActionItemWithAssignee> {
  const supabase = await createClient();

  // Handle status change to 'done'
  const updateData: Record<string, unknown> = { ...updates };
  if (updates.status === 'done') {
    updateData.completed_at = new Date().toISOString();
  } else if (updates.status && updates.status !== 'done') {
    updateData.completed_at = null;
    updateData.completed_by = null;
  }

  const { data, error } = await supabase
    .from('action_items')
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
    .from('action_items')
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
    .from('transcripts')
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
    title: t.title || 'Untitled Transcript',
    status: t.status,
    progress: t.processing_progress,
    word_count: t.word_count,
    source: t.source,
  }));
}

export async function getTranscriptAnalysis(transcriptId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transcript_analysis')
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
    .from('transcripts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'analyzed');

  // Get pending action items count
  const { count: pendingActionsCount } = await supabase
    .from('action_items')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .neq('status', 'done');

  return {
    today_count: todayCount || 0,
    this_week_count: weekCount || 0,
    analyzed_count: analyzedCount || 0,
    pending_actions_count: pendingActionsCount || 0,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function transformMeetingRow(row: any): MeetingWithDetails {
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
```

---

## Step 2.2: Create Server Actions

Create file: `app/(dashboard)/meetings/actions.ts`

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  updateMeeting,
  excludeMeeting,
  restoreMeeting,
  assignCustomerToMeeting,
  createActionItem,
  updateActionItem,
  deleteActionItem,
} from '@/lib/supabase/meetings';
import type {
  UpdateMeetingInput,
  CreateActionItemInput,
  UpdateActionItemInput,
} from '@/types/meetings';

// Helper to get current user and org
async function getCurrentContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get user's organization (adjust based on your auth setup)
  const { data: userOrg } = await supabase
    .from('user_organizations')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  if (!userOrg) {
    throw new Error('No organization found');
  }

  return {
    userId: user.id,
    organizationId: userOrg.organization_id,
  };
}

// ============================================
// MEETING ACTIONS
// ============================================

export async function updateMeetingAction(
  meetingId: string,
  updates: UpdateMeetingInput
) {
  try {
    await getCurrentContext();
    const result = await updateMeeting(meetingId, updates);
    revalidatePath('/meetings');
    return { success: true, data: result };
  } catch (error) {
    console.error('updateMeetingAction error:', error);
    return { success: false, error: 'Failed to update meeting' };
  }
}

export async function excludeMeetingAction(meetingId: string) {
  try {
    const { userId } = await getCurrentContext();
    const result = await excludeMeeting(meetingId, userId);
    revalidatePath('/meetings');
    return { success: true, data: result };
  } catch (error) {
    console.error('excludeMeetingAction error:', error);
    return { success: false, error: 'Failed to exclude meeting' };
  }
}

export async function restoreMeetingAction(meetingId: string) {
  try {
    await getCurrentContext();
    const result = await restoreMeeting(meetingId);
    revalidatePath('/meetings');
    return { success: true, data: result };
  } catch (error) {
    console.error('restoreMeetingAction error:', error);
    return { success: false, error: 'Failed to restore meeting' };
  }
}

export async function assignCustomerAction(
  meetingId: string,
  customerId: string | null
) {
  try {
    await getCurrentContext();
    const result = await assignCustomerToMeeting(meetingId, customerId);
    revalidatePath('/meetings');
    return { success: true, data: result };
  } catch (error) {
    console.error('assignCustomerAction error:', error);
    return { success: false, error: 'Failed to assign customer' };
  }
}

// ============================================
// ACTION ITEM ACTIONS
// ============================================

export async function createActionItemAction(input: CreateActionItemInput) {
  try {
    const { userId, organizationId } = await getCurrentContext();
    const result = await createActionItem(organizationId, input, userId);
    revalidatePath('/meetings');
    return { success: true, data: result };
  } catch (error) {
    console.error('createActionItemAction error:', error);
    return { success: false, error: 'Failed to create action item' };
  }
}

export async function updateActionItemAction(
  actionItemId: string,
  updates: UpdateActionItemInput
) {
  try {
    await getCurrentContext();
    const result = await updateActionItem(actionItemId, updates);
    revalidatePath('/meetings');
    return { success: true, data: result };
  } catch (error) {
    console.error('updateActionItemAction error:', error);
    return { success: false, error: 'Failed to update action item' };
  }
}

export async function deleteActionItemAction(actionItemId: string) {
  try {
    await getCurrentContext();
    await deleteActionItem(actionItemId);
    revalidatePath('/meetings');
    return { success: true };
  } catch (error) {
    console.error('deleteActionItemAction error:', error);
    return { success: false, error: 'Failed to delete action item' };
  }
}
```

---

## Step 2.3: Create Data Fetching for Page

Create file: `app/(dashboard)/meetings/data.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import {
  getUpcomingMeetings,
  getPastMeetings,
  getProcessingTranscripts,
  getMeetingsStats,
} from '@/lib/supabase/meetings';

export async function getMeetingsPageData(includeExcluded = false) {
  const supabase = await createClient();
  
  // Get current user's organization
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: userOrg } = await supabase
    .from('user_organizations')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  if (!userOrg) {
    throw new Error('No organization found');
  }

  const organizationId = userOrg.organization_id;

  // Fetch all data in parallel
  const [
    upcomingMeetings,
    pastMeetings,
    processingQueue,
    stats,
    customers,
    teamMembers,
  ] = await Promise.all([
    getUpcomingMeetings(organizationId, includeExcluded),
    getPastMeetings(organizationId, includeExcluded, 20),
    getProcessingTranscripts(organizationId),
    getMeetingsStats(organizationId),
    getCustomers(organizationId),
    getTeamMembers(organizationId),
  ]);

  return {
    upcomingMeetings,
    pastMeetings,
    processingQueue,
    stats,
    customers,
    teamMembers,
    organizationId,
  };
}

async function getCustomers(organizationId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('customers')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name');

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }

  return data || [];
}

async function getTeamMembers(organizationId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('organization_id', organizationId)
    .order('name');

  if (error) {
    console.error('Error fetching team members:', error);
    return [];
  }

  return data || [];
}
```

---

## Verification Checklist

Run these checks before proceeding to Phase 3:

### 1. TypeScript compilation
```bash
npx tsc --noEmit
```
Expected: No errors

### 2. Test data fetching (create a simple test)
Create `app/(dashboard)/meetings/test-data.ts`:

```typescript
import { getMeetingsPageData } from './data';

export async function testDataFetching() {
  try {
    const data = await getMeetingsPageData();
    console.log('Data fetched successfully:', {
      upcomingCount: data.upcomingMeetings.length,
      pastCount: data.pastMeetings.length,
      queueCount: data.processingQueue.length,
      stats: data.stats,
    });
    return true;
  } catch (error) {
    console.error('Data fetching failed:', error);
    return false;
  }
}
```

### 3. Verify imports work
```bash
# Check that all imports resolve correctly
npx tsc app/\(dashboard\)/meetings/actions.ts --noEmit
npx tsc app/\(dashboard\)/meetings/data.ts --noEmit
npx tsc lib/supabase/meetings.ts --noEmit
```

### 4. Check for runtime errors
Start the dev server and check console for any import/runtime errors:
```bash
npm run dev
```

---

## Phase 2 Complete

Once all verification checks pass, proceed to `phase-3-components.md`.
