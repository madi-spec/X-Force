/**
 * Helper function to add a note to a communication.
 * Used by Daily Driver actions to log what was done.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface AddNoteParams {
  communicationId: string;
  userId: string;
  content: string;
  noteType?: 'manual' | 'action' | 'system';
  actionType?: string;
  attentionFlagId?: string;
}

export async function addCommunicationNote(params: AddNoteParams): Promise<void> {
  const {
    communicationId,
    userId,
    content,
    noteType = 'action',
    actionType,
    attentionFlagId,
  } = params;

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('communication_notes')
    .insert({
      communication_id: communicationId,
      user_id: userId,
      note_type: noteType,
      action_type: actionType,
      content,
      attention_flag_id: attentionFlagId,
    });

  if (error) {
    console.error('[addCommunicationNote] Error adding note:', error);
    // Non-critical - log but don't throw
  }
}

/**
 * Get a formatted action description for common Daily Driver actions
 */
export function getActionDescription(actionType: string, details?: Record<string, string>): string {
  switch (actionType) {
    case 'marked_done':
      return 'Marked as done from Daily Driver';
    case 'resolved_flag':
      return `Resolved attention flag${details?.flagType ? `: ${details.flagType.replace(/_/g, ' ')}` : ''}`;
    case 'snoozed':
      return `Snoozed until ${details?.until || 'later'}`;
    case 'sent_email':
      return `Sent follow-up email${details?.subject ? `: "${details.subject}"` : ''}`;
    case 'sent_reply':
      return `Sent reply${details?.subject ? `: "${details.subject}"` : ''}`;
    case 'scheduled_meeting':
      return `Scheduled meeting${details?.title ? `: "${details.title}"` : ''}`;
    case 'assigned_company':
      return `Assigned to company: ${details?.companyName || 'Unknown'}`;
    case 'draft_generated':
      return 'AI draft generated for review';
    default:
      return `Action taken: ${actionType.replace(/_/g, ' ')}`;
  }
}
