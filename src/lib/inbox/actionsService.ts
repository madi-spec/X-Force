/**
 * Inbox Actions Service
 *
 * Handles conversation actions: archive, snooze, link, undo
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MicrosoftGraphClient } from '@/lib/microsoft/graph';
import { getValidToken } from '@/lib/microsoft/auth';
import { getOutlookFolders } from './inboxService';

// ============================================================================
// Types
// ============================================================================

export interface ActionResult {
  success: boolean;
  undoToken?: string;
  error?: string;
}

export interface SnoozeOptions {
  until: Date;
  reason?: string;
}

export interface LinkOptions {
  dealId?: string;
  companyId?: string;
  contactId?: string;
}

// ============================================================================
// Archive
// ============================================================================

/**
 * Archive a conversation (move to processed)
 */
export async function archiveConversation(
  userId: string,
  conversationId: string,
  options?: { logToDeal?: string }
): Promise<ActionResult> {
  const supabase = createAdminClient();

  // Get conversation
  const { data: conversation, error: fetchError } = await supabase
    .from('email_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !conversation) {
    return { success: false, error: 'Conversation not found' };
  }

  const previousStatus = conversation.status;

  // Move emails in Outlook (unless user-managed)
  if (!conversation.user_managed) {
    try {
      const folders = await getOutlookFolders(userId);

      if (folders?.folder_mode === 'move' && folders.processed_folder_id) {
        const token = await getValidToken(userId);
        if (token) {
          const graph = new MicrosoftGraphClient(token);

          // Get messages for this conversation
          const { data: messages } = await supabase
            .from('email_messages')
            .select('message_id')
            .eq('conversation_ref', conversationId);

          // Move each message
          for (const msg of messages || []) {
            try {
              await graph.moveMessage(msg.message_id, folders.processed_folder_id);
            } catch {
              // Continue even if some moves fail
            }
          }
        }
      }
    } catch {
      // Don't fail the archive if Outlook move fails
    }
  }

  // Update conversation status
  const { error: updateError } = await supabase
    .from('email_conversations')
    .update({
      status: 'processed',
      deal_id: options?.logToDeal || conversation.deal_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Log action
  const { data: action } = await supabase
    .from('email_actions')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      action: 'archived',
      from_status: previousStatus,
      to_status: 'processed',
      deal_id: options?.logToDeal,
      source: 'xforce_ui',
    })
    .select()
    .single();

  return { success: true, undoToken: action?.id };
}

/**
 * Unarchive a conversation
 */
export async function unarchiveConversation(
  userId: string,
  conversationId: string
): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { data: conversation } = await supabase
    .from('email_conversations')
    .select('last_outbound_at, last_inbound_at')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (!conversation) {
    return { success: false, error: 'Conversation not found' };
  }

  // Determine appropriate status based on last message direction
  const newStatus =
    conversation.last_outbound_at &&
    (!conversation.last_inbound_at ||
      new Date(conversation.last_outbound_at) > new Date(conversation.last_inbound_at))
      ? 'awaiting_response'
      : 'pending';

  const { error } = await supabase
    .from('email_conversations')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.from('email_actions').insert({
    conversation_id: conversationId,
    user_id: userId,
    action: 'unarchived',
    from_status: 'processed',
    to_status: newStatus,
    source: 'xforce_ui',
  });

  return { success: true };
}

// ============================================================================
// Snooze
// ============================================================================

/**
 * Snooze a conversation
 */
export async function snoozeConversation(
  userId: string,
  conversationId: string,
  options: SnoozeOptions
): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { data: conversation } = await supabase
    .from('email_conversations')
    .select('status')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (!conversation) {
    return { success: false, error: 'Conversation not found' };
  }

  const previousStatus = conversation.status;

  const { error } = await supabase
    .from('email_conversations')
    .update({
      status: 'snoozed',
      snoozed_until: options.until.toISOString(),
      snooze_reason: options.reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (error) {
    return { success: false, error: error.message };
  }

  const { data: action } = await supabase
    .from('email_actions')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      action: 'snoozed',
      from_status: previousStatus,
      to_status: 'snoozed',
      snooze_until: options.until.toISOString(),
      notes: options.reason,
      source: 'xforce_ui',
    })
    .select()
    .single();

  return { success: true, undoToken: action?.id };
}

/**
 * Unsnooze a conversation
 */
export async function unsnoozeConversation(
  userId: string,
  conversationId: string
): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('email_conversations')
    .update({
      status: 'pending',
      snoozed_until: null,
      snooze_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.from('email_actions').insert({
    conversation_id: conversationId,
    user_id: userId,
    action: 'unsnoozed',
    from_status: 'snoozed',
    to_status: 'pending',
    source: 'xforce_ui',
  });

  return { success: true };
}

// ============================================================================
// Linking
// ============================================================================

/**
 * Link conversation to deal/contact/company
 */
export async function linkConversation(
  userId: string,
  conversationId: string,
  options: LinkOptions
): Promise<ActionResult> {
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {
    link_method: 'manual',
    link_confidence: 100,
    link_reasoning: 'Manually linked by user',
    updated_at: new Date().toISOString(),
  };

  if (options.dealId) updates.deal_id = options.dealId;
  if (options.companyId) updates.company_id = options.companyId;
  if (options.contactId) updates.contact_id = options.contactId;

  const { error } = await supabase
    .from('email_conversations')
    .update(updates)
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.from('email_actions').insert({
    conversation_id: conversationId,
    user_id: userId,
    action: 'linked_to_deal',
    deal_id: options.dealId,
    source: 'xforce_ui',
  });

  return { success: true };
}

/**
 * Unlink conversation from deal
 */
export async function unlinkConversation(
  userId: string,
  conversationId: string
): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('email_conversations')
    .update({
      deal_id: null,
      link_method: null,
      link_confidence: null,
      link_reasoning: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.from('email_actions').insert({
    conversation_id: conversationId,
    user_id: userId,
    action: 'unlinked',
    source: 'xforce_ui',
  });

  return { success: true };
}

// ============================================================================
// Ignore
// ============================================================================

/**
 * Mark conversation as ignored
 */
export async function ignoreConversation(
  userId: string,
  conversationId: string
): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { data: conversation } = await supabase
    .from('email_conversations')
    .select('status')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (!conversation) {
    return { success: false, error: 'Conversation not found' };
  }

  const { error } = await supabase
    .from('email_conversations')
    .update({
      status: 'ignored',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (error) {
    return { success: false, error: error.message };
  }

  const { data: action } = await supabase
    .from('email_actions')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      action: 'ignored',
      from_status: conversation.status,
      to_status: 'ignored',
      source: 'xforce_ui',
    })
    .select()
    .single();

  return { success: true, undoToken: action?.id };
}

// ============================================================================
// Priority
// ============================================================================

/**
 * Update conversation priority
 */
export async function updatePriority(
  userId: string,
  conversationId: string,
  priority: 'high' | 'medium' | 'low'
): Promise<ActionResult> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('email_conversations')
    .update({
      ai_priority: priority,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase.from('email_actions').insert({
    conversation_id: conversationId,
    user_id: userId,
    action: 'priority_changed',
    notes: `Priority set to ${priority}`,
    source: 'xforce_ui',
  });

  return { success: true };
}

// ============================================================================
// Undo
// ============================================================================

/**
 * Undo an action within 5 minutes
 */
export async function undoAction(userId: string, actionId: string): Promise<ActionResult> {
  const supabase = createAdminClient();

  // Get action within 5-minute window
  const fiveMinutesAgo = new Date();
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

  const { data: action } = await supabase
    .from('email_actions')
    .select('*')
    .eq('id', actionId)
    .eq('user_id', userId)
    .gte('created_at', fiveMinutesAgo.toISOString())
    .single();

  if (!action || !action.from_status) {
    return { success: false, error: 'Action not found or undo window expired' };
  }

  // Revert the status
  const { error } = await supabase
    .from('email_conversations')
    .update({
      status: action.from_status,
      snoozed_until: null,
      snooze_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', action.conversation_id);

  if (error) {
    return { success: false, error: error.message };
  }

  // Log undo
  await supabase.from('email_actions').insert({
    conversation_id: action.conversation_id,
    user_id: userId,
    action: 'undo',
    from_status: action.to_status,
    to_status: action.from_status,
    notes: `Undid ${action.action}`,
    source: 'xforce_ui',
  });

  return { success: true };
}

// ============================================================================
// Bulk Actions
// ============================================================================

/**
 * Archive multiple conversations
 */
export async function bulkArchive(
  userId: string,
  conversationIds: string[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const id of conversationIds) {
    const result = await archiveConversation(userId, id);
    if (result.success) success++;
    else failed++;
  }

  return { success, failed };
}

/**
 * Snooze multiple conversations
 */
export async function bulkSnooze(
  userId: string,
  conversationIds: string[],
  options: SnoozeOptions
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const id of conversationIds) {
    const result = await snoozeConversation(userId, id, options);
    if (result.success) success++;
    else failed++;
  }

  return { success, failed };
}

/**
 * Link multiple conversations to a deal
 */
export async function bulkLink(
  userId: string,
  conversationIds: string[],
  dealId: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const id of conversationIds) {
    const result = await linkConversation(userId, id, { dealId });
    if (result.success) success++;
    else failed++;
  }

  return { success, failed };
}
