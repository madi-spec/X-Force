/**
 * Inbox Service
 *
 * Manages email conversations with conversation-centric approach.
 * Handles sync, linking, actions, and state management.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MicrosoftGraphClient } from '@/lib/microsoft/graph';
import { getValidToken } from '@/lib/microsoft/auth';

// ============================================================================
// Types
// ============================================================================

export type ConversationStatus =
  | 'pending'
  | 'awaiting_response'
  | 'snoozed'
  | 'processed'
  | 'ignored';

export type LinkMethod = 'auto_high' | 'auto_suggested' | 'manual' | 'thread_inherited' | 'none';

export type SlaStatus = 'ok' | 'warning' | 'overdue';

export interface EmailConversation {
  id: string;
  user_id: string;
  conversation_id: string;
  status: ConversationStatus;
  contact_id?: string;
  company_id?: string;
  deal_id?: string;
  link_confidence?: number;
  link_method?: LinkMethod;
  link_reasoning?: string;
  subject?: string;
  participant_emails?: string[];
  participant_names?: string[];
  message_count: number;
  has_attachments: boolean;
  first_message_at?: string;
  last_message_at?: string;
  last_inbound_at?: string;
  last_outbound_at?: string;
  response_due_at?: string;
  sla_hours?: number;
  sla_status: SlaStatus;
  ai_priority?: 'high' | 'medium' | 'low';
  ai_category?: string;
  ai_sentiment?: string;
  ai_sentiment_trend?: string;
  ai_thread_summary?: string;
  ai_suggested_action?: string;
  ai_evidence_quotes?: string[];
  signals?: Record<string, unknown>;
  snoozed_until?: string;
  snooze_reason?: string;
  has_pending_draft: boolean;
  draft_confidence?: number;
  user_managed: boolean;
  last_synced_at?: string;
  sync_conflict: boolean;
  sync_conflict_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailMessage {
  id: string;
  conversation_ref: string;
  user_id: string;
  message_id: string;
  internet_message_id?: string;
  outlook_folder_id?: string;
  outlook_folder_name?: string;
  subject?: string;
  from_email?: string;
  from_name?: string;
  to_emails?: string[];
  to_names?: string[];
  cc_emails?: string[];
  cc_names?: string[];
  body_preview?: string;
  body_text?: string;
  body_html?: string;
  is_read: boolean;
  is_sent_by_user: boolean;
  is_flagged: boolean;
  has_attachments: boolean;
  importance?: string;
  received_at?: string;
  sent_at?: string;
  ai_analysis?: Record<string, unknown>;
  created_at: string;
}

export interface MicrosoftMessage {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType: string; content: string };
  from?: { emailAddress: { address: string; name?: string } };
  toRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  receivedDateTime?: string;
  sentDateTime?: string;
  isRead?: boolean;
  hasAttachments?: boolean;
  importance?: string;
  flag?: { flagStatus: string };
}

export interface SyncResult {
  conversations: number;
  messages: number;
  linked: number;
  errors: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const SYNC_CONFIG = {
  initial_sync_days: 30,
  max_messages_per_batch: 50,
  rate_limit_delay_ms: 100,
};

const LINK_THRESHOLDS = {
  AUTO_HIGH: 85,
  AUTO_SUGGESTED: 60,
};

// ============================================================================
// Folder Setup
// ============================================================================

/**
 * Setup Outlook folders for X-FORCE
 */
export async function setupOutlookFolders(
  userId: string,
  mode: 'move' | 'label_only' = 'move'
): Promise<void> {
  const token = await getValidToken(userId);
  if (!token) throw new Error('No valid token');

  const graph = new MicrosoftGraphClient(token);
  const supabase = createAdminClient();

  // Get standard folders
  const inbox = await graph.getMailFolder('inbox');
  const sentItems = await graph.getMailFolder('sentitems');

  let processedFolderId: string | null = null;

  if (mode === 'move') {
    processedFolderId = await graph.findOrCreateFolder('X-FORCE Processed');
  }

  // Store configuration
  await supabase
    .from('outlook_folders')
    .upsert({
      user_id: userId,
      inbox_id: inbox.id,
      sent_items_id: sentItems.id,
      processed_folder_id: processedFolderId,
      folder_mode: mode,
      folders_created: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}

/**
 * Get folder configuration for user
 */
export async function getOutlookFolders(userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('outlook_folders')
    .select('*')
    .eq('user_id', userId)
    .single();

  return data;
}

// ============================================================================
// Initial Sync
// ============================================================================

/**
 * Perform initial email sync (last 30 days)
 */
export async function performInitialSync(userId: string): Promise<SyncResult> {
  const token = await getValidToken(userId);
  if (!token) throw new Error('No valid token');

  const graph = new MicrosoftGraphClient(token);
  const supabase = createAdminClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - SYNC_CONFIG.initial_sync_days);

  const stats: SyncResult = { conversations: 0, messages: 0, linked: 0, errors: [] };

  try {
    // Sync inbox
    let nextLink: string | undefined =
      `/me/mailFolders/inbox/messages?` +
      `$filter=receivedDateTime ge ${cutoffDate.toISOString()}&` +
      `$top=${SYNC_CONFIG.max_messages_per_batch}&` +
      `$orderby=receivedDateTime desc&` +
      `$select=id,conversationId,internetMessageId,subject,from,toRecipients,ccRecipients,` +
      `receivedDateTime,sentDateTime,isRead,hasAttachments,bodyPreview,body,importance,flag`;

    while (nextLink) {
      const response = await graph.getMessages('inbox', {
        top: SYNC_CONFIG.max_messages_per_batch,
        filter: `receivedDateTime ge ${cutoffDate.toISOString()}`,
        orderby: 'receivedDateTime desc',
        select: [
          'id',
          'conversationId',
          'internetMessageId',
          'subject',
          'from',
          'toRecipients',
          'ccRecipients',
          'receivedDateTime',
          'sentDateTime',
          'isRead',
          'hasAttachments',
          'bodyPreview',
          'body',
          'importance',
          'flag',
        ],
      });

      for (const message of response.value) {
        try {
          const result = await processMessage(userId, message as MicrosoftMessage, 'inbound');
          stats.messages++;
          if (result.newConversation) stats.conversations++;
          if (result.linked) stats.linked++;
        } catch (err) {
          stats.errors.push(`Error processing message ${message.id}: ${err}`);
        }
      }

      nextLink = response['@odata.nextLink']?.replace('https://graph.microsoft.com/v1.0', '');

      if (nextLink) {
        await sleep(SYNC_CONFIG.rate_limit_delay_ms);
      }
    }

    // Sync sent items
    const sentResponse = await graph.getMessages('sentitems', {
      top: SYNC_CONFIG.max_messages_per_batch,
      filter: `sentDateTime ge ${cutoffDate.toISOString()}`,
      orderby: 'sentDateTime desc',
      select: [
        'id',
        'conversationId',
        'internetMessageId',
        'subject',
        'from',
        'toRecipients',
        'ccRecipients',
        'sentDateTime',
        'receivedDateTime',
        'hasAttachments',
        'bodyPreview',
        'body',
        'importance',
        'flag',
      ],
    });

    for (const message of sentResponse.value) {
      try {
        const result = await processMessage(userId, message as MicrosoftMessage, 'outbound');
        stats.messages++;
        if (result.newConversation) stats.conversations++;
        if (result.linked) stats.linked++;
      } catch (err) {
        stats.errors.push(`Error processing sent message ${message.id}: ${err}`);
      }
    }

    // Store sync state
    await supabase
      .from('email_sync_state')
      .upsert({
        user_id: userId,
        last_full_sync_at: new Date().toISOString(),
        total_conversations_synced: stats.conversations,
        total_messages_synced: stats.messages,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

  } catch (err) {
    stats.errors.push(`Sync error: ${err}`);
  }

  return stats;
}

// ============================================================================
// Process Message
// ============================================================================

/**
 * Process a single message into a conversation
 */
async function processMessage(
  userId: string,
  message: MicrosoftMessage,
  direction: 'inbound' | 'outbound'
): Promise<{ newConversation: boolean; linked: boolean }> {
  const supabase = createAdminClient();
  const isInbound = direction === 'inbound';

  const primaryEmail = isInbound
    ? message.from?.emailAddress?.address?.toLowerCase()
    : message.toRecipients?.[0]?.emailAddress?.address?.toLowerCase();

  if (!message.conversationId) {
    return { newConversation: false, linked: false };
  }

  // Check if conversation exists
  const { data: existingConv } = await supabase
    .from('email_conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('conversation_id', message.conversationId)
    .single();

  let newConversation = false;
  let linked = false;
  let conversationId: string;

  if (!existingConv) {
    // NEW CONVERSATION
    newConversation = true;

    // Calculate link confidence
    const linkResult = await calculateLinkConfidence(userId, message, primaryEmail || '');
    linked = linkResult.confidence >= LINK_THRESHOLDS.AUTO_SUGGESTED;

    const status: ConversationStatus = isInbound ? 'pending' : 'awaiting_response';

    const { data: newConv, error } = await supabase
      .from('email_conversations')
      .insert({
        user_id: userId,
        conversation_id: message.conversationId,
        status,
        contact_id: linkResult.contactId,
        company_id: linkResult.companyId,
        deal_id: linkResult.confidence >= LINK_THRESHOLDS.AUTO_HIGH ? linkResult.dealId : null,
        link_confidence: linkResult.confidence,
        link_method: linkResult.method,
        link_reasoning: linkResult.reasoning,
        subject: message.subject,
        participant_emails: extractAllParticipants(message),
        message_count: 1,
        has_attachments: message.hasAttachments || false,
        first_message_at: message.receivedDateTime || message.sentDateTime,
        last_message_at: message.receivedDateTime || message.sentDateTime,
        last_inbound_at: isInbound ? message.receivedDateTime : null,
        last_outbound_at: !isInbound ? message.sentDateTime : null,
        sla_status: 'ok',
      })
      .select()
      .single();

    if (error) throw error;
    conversationId = newConv!.id;

  } else {
    // EXISTING CONVERSATION - update it
    conversationId = existingConv.id;

    const updates: Partial<EmailConversation> = {
      message_count: existingConv.message_count + 1,
      last_message_at: message.receivedDateTime || message.sentDateTime,
      has_attachments: existingConv.has_attachments || message.hasAttachments || false,
      updated_at: new Date().toISOString(),
    };

    if (isInbound) {
      updates.last_inbound_at = message.receivedDateTime;

      if (existingConv.status === 'awaiting_response') {
        updates.status = 'pending';
        updates.sla_status = 'ok';
        updates.response_due_at = undefined;
      }

      if (existingConv.status === 'snoozed') {
        updates.status = 'pending';
        updates.snoozed_until = undefined;
      }
    } else {
      updates.last_outbound_at = message.sentDateTime;

      if (existingConv.status === 'pending') {
        updates.status = 'awaiting_response';
      }
    }

    await supabase
      .from('email_conversations')
      .update(updates)
      .eq('id', conversationId);
  }

  // Store individual message - check if exists first
  const { data: existingMsg } = await supabase
    .from('email_messages')
    .select('id')
    .eq('user_id', userId)
    .eq('message_id', message.id)
    .single();

  const messageData = {
    conversation_ref: conversationId,
    user_id: userId,
    message_id: message.id,
    internet_message_id: message.internetMessageId,
    subject: message.subject,
    from_email: message.from?.emailAddress?.address,
    from_name: message.from?.emailAddress?.name,
    to_emails: message.toRecipients?.map((r) => r.emailAddress?.address) || [],
    to_names: message.toRecipients?.map((r) => r.emailAddress?.name || null) || [],
    cc_emails: message.ccRecipients?.map((r) => r.emailAddress?.address) || [],
    cc_names: message.ccRecipients?.map((r) => r.emailAddress?.name || null) || [],
    body_preview: message.bodyPreview,
    body_html: message.body?.content,
    is_read: message.isRead ?? false,
    is_sent_by_user: !isInbound,
    is_flagged: message.flag?.flagStatus === 'flagged',
    has_attachments: message.hasAttachments ?? false,
    importance: message.importance,
    received_at: message.receivedDateTime,
    sent_at: message.sentDateTime,
  };

  if (existingMsg) {
    await supabase
      .from('email_messages')
      .update(messageData)
      .eq('id', existingMsg.id);
  } else {
    await supabase
      .from('email_messages')
      .insert(messageData);
  }

  return { newConversation, linked };
}

// ============================================================================
// Link Confidence
// ============================================================================

interface LinkResult {
  confidence: number;
  contactId: string | null;
  companyId: string | null;
  dealId: string | null;
  method: LinkMethod;
  reasoning: string;
}

/**
 * Calculate link confidence for a message
 */
async function calculateLinkConfidence(
  userId: string,
  message: MicrosoftMessage,
  primaryEmail: string
): Promise<LinkResult> {
  const supabase = createAdminClient();

  let confidence = 0;
  const reasoning: string[] = [];
  let contactId: string | null = null;
  let companyId: string | null = null;
  let dealId: string | null = null;

  // 1. Check if email matches a known contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, company_id')
    .ilike('email', primaryEmail)
    .single();

  if (contact) {
    contactId = contact.id;
    companyId = contact.company_id;
    reasoning.push(`Matched contact: ${contact.name}`);

    // Check for active deals
    const { data: dealContacts } = await supabase
      .from('deal_contacts')
      .select('deal_id, deals!inner(id, name, stage)')
      .eq('contact_id', contact.id)
      .not('deals.stage', 'in', '("closed_won","closed_lost")');

    if (dealContacts && dealContacts.length === 1) {
      confidence += 40;
      dealId = dealContacts[0].deal_id;
      reasoning.push(`Contact on one active deal`);
    } else if (dealContacts && dealContacts.length > 1) {
      confidence += 20;
      reasoning.push(`Contact on ${dealContacts.length} deals - needs disambiguation`);
    } else {
      confidence += 25;
    }
  } else {
    // Try domain match
    const domain = primaryEmail.split('@')[1];
    if (domain) {
      const { data: company } = await supabase
        .from('companies')
        .select('id, name')
        .or(`website.ilike.%${domain}%,domain.ilike.%${domain}%`)
        .single();

      if (company) {
        companyId = company.id;
        confidence += 15;
        reasoning.push(`Domain matches company: ${company.name}`);
      }
    }
  }

  // 2. Check if part of already-linked thread
  if (message.conversationId) {
    const { data: existingThread } = await supabase
      .from('email_conversations')
      .select('deal_id')
      .eq('user_id', userId)
      .eq('conversation_id', message.conversationId)
      .not('deal_id', 'is', null)
      .single();

    if (existingThread?.deal_id) {
      confidence += 30;
      dealId = existingThread.deal_id;
      reasoning.push('Thread already linked to deal');
    }
  }

  let method: LinkMethod = 'none';
  if (confidence >= LINK_THRESHOLDS.AUTO_HIGH) method = 'auto_high';
  else if (confidence >= LINK_THRESHOLDS.AUTO_SUGGESTED) method = 'auto_suggested';

  return {
    confidence,
    contactId,
    companyId,
    dealId: method !== 'none' ? dealId : null,
    method,
    reasoning: reasoning.join('. '),
  };
}

// ============================================================================
// Conversation Queries
// ============================================================================

/**
 * Get conversations for user
 */
export async function getConversations(
  userId: string,
  filters?: {
    status?: ConversationStatus | ConversationStatus[];
    priority?: 'high' | 'medium' | 'low';
    dealId?: string;
    companyId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ conversations: EmailConversation[]; total: number }> {
  const supabase = await createClient();

  let query = supabase
    .from('email_conversations')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false });

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  if (filters?.priority) {
    query = query.eq('ai_priority', filters.priority);
  }

  if (filters?.dealId) {
    query = query.eq('deal_id', filters.dealId);
  }

  if (filters?.companyId) {
    query = query.eq('company_id', filters.companyId);
  }

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    conversations: data || [],
    total: count || 0,
  };
}

/**
 * Get single conversation with messages
 * Fetches missing messages from Microsoft Graph on-demand
 */
export async function getConversation(
  userId: string,
  conversationId: string
): Promise<{ conversation: EmailConversation; messages: EmailMessage[] } | null> {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: conversation, error } = await supabase
    .from('email_conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('id', conversationId)
    .single();

  if (error || !conversation) return null;

  let { data: rawMessages } = await supabase
    .from('email_messages')
    .select('*')
    .eq('conversation_ref', conversationId)
    .order('received_at', { ascending: true });

  // If we have fewer messages than expected, fetch from Microsoft Graph
  const storedCount = rawMessages?.length || 0;
  const expectedCount = conversation.message_count || 0;

  if (storedCount < expectedCount && conversation.conversation_id) {
    try {
      const token = await getValidToken(userId);
      if (token) {
        const graph = new MicrosoftGraphClient(token);

        // Fetch all messages in this conversation thread from Microsoft
        const response = await graph.searchAllMessages({
          filter: `conversationId eq '${conversation.conversation_id}'`,
          select: [
            'id',
            'conversationId',
            'internetMessageId',
            'subject',
            'from',
            'toRecipients',
            'ccRecipients',
            'receivedDateTime',
            'sentDateTime',
            'isRead',
            'hasAttachments',
            'bodyPreview',
            'body',
            'importance',
            'flag',
          ],
          top: 50,
          orderby: 'receivedDateTime asc',
        });

        // Store new messages
        for (const msg of response.value) {
          // Check if message already exists
          const { data: existing } = await adminSupabase
            .from('email_messages')
            .select('id')
            .eq('user_id', userId)
            .eq('message_id', msg.id)
            .single();

          if (!existing) {
            const isFromUs = msg.from?.emailAddress?.address?.toLowerCase().includes(userId) || false;

            await adminSupabase.from('email_messages').insert({
              conversation_ref: conversationId,
              user_id: userId,
              message_id: msg.id,
              internet_message_id: msg.internetMessageId,
              subject: msg.subject,
              from_email: msg.from?.emailAddress?.address,
              from_name: msg.from?.emailAddress?.name,
              to_emails: msg.toRecipients?.map((r: { emailAddress: { address: string } }) => r.emailAddress?.address) || [],
              to_names: msg.toRecipients?.map((r: { emailAddress: { name?: string } }) => r.emailAddress?.name || null) || [],
              cc_emails: msg.ccRecipients?.map((r: { emailAddress: { address: string } }) => r.emailAddress?.address) || [],
              cc_names: msg.ccRecipients?.map((r: { emailAddress: { name?: string } }) => r.emailAddress?.name || null) || [],
              body_preview: msg.bodyPreview,
              body_html: msg.body?.content,
              is_read: msg.isRead ?? false,
              is_sent_by_user: isFromUs,
              is_flagged: msg.flag?.flagStatus === 'flagged',
              has_attachments: msg.hasAttachments ?? false,
              importance: msg.importance,
              received_at: msg.receivedDateTime || msg.sentDateTime,
              sent_at: msg.sentDateTime,
            });
          }
        }

        // Re-fetch messages from database
        const { data: updatedMessages } = await supabase
          .from('email_messages')
          .select('*')
          .eq('conversation_ref', conversationId)
          .order('received_at', { ascending: true });

        rawMessages = updatedMessages;
      }
    } catch (err) {
      console.error('Error fetching messages from Graph:', err);
      // Continue with whatever messages we have
    }
  }

  return {
    conversation,
    messages: (rawMessages || []) as EmailMessage[],
  };
}

/**
 * Get action queue counts
 */
export async function getActionQueueCounts(userId: string): Promise<{
  overdue: number;
  highPriority: number;
  scheduling: number;
  snoozedExpiring: number;
  draftsReady: number;
  needsLinking: number;
}> {
  const supabase = await createClient();

  const { data } = await supabase.rpc('get_email_action_queue_counts', {
    p_user_id: userId,
  });

  if (!data || data.length === 0) {
    return {
      overdue: 0,
      highPriority: 0,
      scheduling: 0,
      snoozedExpiring: 0,
      draftsReady: 0,
      needsLinking: 0,
    };
  }

  return {
    overdue: data[0].overdue_count || 0,
    highPriority: data[0].high_priority_count || 0,
    scheduling: data[0].scheduling_count || 0,
    snoozedExpiring: data[0].snoozed_expiring_count || 0,
    draftsReady: data[0].drafts_ready_count || 0,
    needsLinking: data[0].needs_linking_count || 0,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function extractAllParticipants(message: MicrosoftMessage): string[] {
  const participants = new Set<string>();

  if (message.from?.emailAddress?.address) {
    participants.add(message.from.emailAddress.address.toLowerCase());
  }

  message.toRecipients?.forEach((r) => {
    if (r.emailAddress?.address) {
      participants.add(r.emailAddress.address.toLowerCase());
    }
  });

  message.ccRecipients?.forEach((r) => {
    if (r.emailAddress?.address) {
      participants.add(r.emailAddress.address.toLowerCase());
    }
  });

  return Array.from(participants);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
