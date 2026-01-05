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
import type { Meeting } from '@/types/meetings';

// Helper to get current user and organization
async function getCurrentContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get user profile from users table
  const { data: profile } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  if (!profile.organization_id) {
    throw new Error('User has no organization');
  }

  return {
    userId: user.id,
    profileId: profile.id,
    organizationId: profile.organization_id,
  };
}

// ============================================
// MEETING ACTIONS
// ============================================

export async function updateMeetingAction(
  meetingId: string,
  updates: Partial<Meeting>
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

export async function createActionItemAction(input: {
  text: string;
  assignee_id?: string;
  due_date?: string;
  meeting_id?: string;
  transcript_id?: string;
}) {
  try {
    const { profileId, organizationId } = await getCurrentContext();
    const result = await createActionItem(organizationId, input, profileId);
    revalidatePath('/meetings');
    return { success: true, data: result };
  } catch (error) {
    console.error('createActionItemAction error:', error);
    return { success: false, error: 'Failed to create action item' };
  }
}

export async function updateActionItemAction(
  actionItemId: string,
  updates: {
    text?: string;
    assignee_id?: string | null;
    due_date?: string | null;
    status?: 'pending' | 'in_progress' | 'done';
  }
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
