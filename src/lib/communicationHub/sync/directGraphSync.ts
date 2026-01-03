/**
 * Direct Microsoft Graph to Communications Sync
 *
 * This is the consolidated email sync path that bypasses the email_messages
 * and activities tables, writing directly to the communications table.
 *
 * Flow: Microsoft Graph API → communications table → matching → analysis
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { MicrosoftGraphClient } from '@/lib/microsoft/graph';
import { getValidToken, updateLastSync } from '@/lib/microsoft/auth';
import { isInternalEmail, getExternalEmails, matchCommunicationToCompany } from '../matching/matchEmailToCompany';
import { classifyEmailNoise } from '@/lib/email/noiseDetection';
import { analyzeCommunication } from '../analysis/analyzeCommunication';
import type { Communication } from '@/types/communicationHub';

// Folders to exclude from sync
const EXCLUDED_FOLDER_NAMES = [
  'deleted items',
  'deleteditems',
  'junk email',
  'junk',
  'spam',
  'deleted',
  'trash',
  'drafts',
];

interface GraphMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body?: { contentType: string; content: string };
  from?: { emailAddress: { address: string; name?: string } };
  toRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  ccRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  receivedDateTime?: string;
  sentDateTime?: string;
  conversationId?: string;
  internetMessageId?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
}

export interface DirectSyncResult {
  imported: number;
  skipped: number;
  matched: number;
  errors: string[];
  folders?: number;
}

export interface DirectSyncOptions {
  sinceDate?: Date;
  maxMessages?: number;
  folders?: 'inbox-sent' | 'all';
}

/**
 * Normalize external_id by stripping common prefixes
 */
function normalizeExternalId(externalId: string | null): string | null {
  if (!externalId) return null;
  return externalId.replace(/^ms_email_/, '').replace(/^graph_/, '');
}

/**
 * Check if a communication with this external_id already exists
 */
async function findExistingByExternalId(
  supabase: ReturnType<typeof createAdminClient>,
  externalId: string | null
): Promise<{ id: string } | null> {
  if (!externalId) return null;

  const normalizedId = normalizeExternalId(externalId);
  if (!normalizedId) return null;

  // Check for exact match first
  const { data: exact } = await supabase
    .from('communications')
    .select('id')
    .eq('external_id', externalId)
    .single();

  if (exact) return exact;

  // Check for normalized match (with or without prefix)
  const { data: withPrefix } = await supabase
    .from('communications')
    .select('id')
    .eq('external_id', `ms_email_${normalizedId}`)
    .single();

  if (withPrefix) return withPrefix;

  // Check without prefix
  const { data: withoutPrefix } = await supabase
    .from('communications')
    .select('id')
    .eq('external_id', normalizedId)
    .single();

  return withoutPrefix || null;
}

/**
 * Convert a Microsoft Graph message to our Communication format
 */
function graphMessageToCommunication(
  message: GraphMessage,
  direction: 'inbound' | 'outbound',
  userId: string
): Partial<Communication> {
  const isOutbound = direction === 'outbound';

  // Build participants arrays
  const toParticipants = (message.toRecipients || []).map(r => ({
    email: r.emailAddress?.address || '',
    name: r.emailAddress?.name || '',
  }));

  const ccParticipants = (message.ccRecipients || []).map(r => ({
    email: r.emailAddress?.address || '',
    name: r.emailAddress?.name || '',
  }));

  const fromParticipant = {
    email: message.from?.emailAddress?.address || '',
    name: message.from?.emailAddress?.name || '',
  };

  // Get body content - prefer text over HTML for analysis
  const bodyText = message.body?.contentType === 'Text'
    ? message.body.content
    : message.bodyPreview;

  const bodyHtml = message.body?.contentType === 'HTML'
    ? message.body.content
    : null;

  // Check for noise emails (AI notetakers, etc.)
  const noiseClassification = !isOutbound
    ? classifyEmailNoise(fromParticipant.email, message.subject, message.bodyPreview)
    : null;

  const isNoiseEmail = noiseClassification?.autoProcess ?? false;

  // Noise emails are auto-processed: no response needed
  const awaitingOurResponse = !isOutbound && !isNoiseEmail;
  const respondedAt = isNoiseEmail ? new Date().toISOString() : null;

  return {
    channel: 'email',
    direction: isOutbound ? 'outbound' : 'inbound',
    occurred_at: message.receivedDateTime || message.sentDateTime || new Date().toISOString(),
    subject: message.subject || null,
    content_preview: message.bodyPreview || bodyText?.substring(0, 500) || null,
    full_content: bodyText,
    content_html: bodyHtml,
    attachments: message.hasAttachments ? [{ name: 'attachment', type: 'unknown', size: 0, url: '' }] : [],

    // Participants
    our_participants: isOutbound
      ? [{ ...fromParticipant, role: 'sender' }]
      : [...toParticipants, ...ccParticipants].map(p => ({ ...p, role: 'recipient' as const })),
    their_participants: isOutbound
      ? [...toParticipants, ...ccParticipants]
      : [fromParticipant],

    // Source - mark as direct from graph
    source_table: 'microsoft_graph',
    source_id: message.id,
    external_id: `ms_email_${message.id}`,
    thread_id: message.conversationId,

    // Response state
    awaiting_our_response: awaitingOurResponse,
    awaiting_their_response: isOutbound,
    response_sla_minutes: awaitingOurResponse ? 240 : null,
    response_due_by: awaitingOurResponse
      ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
      : null,
    responded_at: respondedAt,

    // Relationships - will be filled by matching
    company_id: null,
    contact_id: null,
    deal_id: null,
    user_id: userId,

    // AI
    is_ai_generated: false,
    analysis_status: isNoiseEmail ? 'complete' : 'pending',
  };
}

/**
 * Sync emails directly from Microsoft Graph to communications table
 * This is the consolidated single email sync path.
 */
export async function syncEmailsDirectToCommunications(
  userId: string,
  options: DirectSyncOptions = {}
): Promise<DirectSyncResult> {
  const result: DirectSyncResult = { imported: 0, skipped: 0, matched: 0, errors: [], folders: 0 };
  const { sinceDate, maxMessages = 200 } = options;

  console.log('[DirectGraphSync] Starting sync for user:', userId);

  const token = await getValidToken(userId);
  if (!token) {
    console.log('[DirectGraphSync] No valid token available');
    result.errors.push('No valid token available');
    return result;
  }

  const supabase = createAdminClient();
  const client = new MicrosoftGraphClient(token);

  try {
    // Build date filters
    const receivedDateFilter = sinceDate
      ? `receivedDateTime ge ${sinceDate.toISOString()}`
      : undefined;
    const sentDateFilter = sinceDate
      ? `sentDateTime ge ${sinceDate.toISOString()}`
      : undefined;

    // Get all mail folders
    const foldersResponse = await client.getMailFolders();
    const allFolders = foldersResponse.value;

    console.log('[DirectGraphSync] Found', allFolders.length, 'mail folders');

    // Filter out excluded folders
    const foldersToSync = allFolders.filter(folder => {
      const displayNameLower = folder.displayName.toLowerCase();
      return !EXCLUDED_FOLDER_NAMES.includes(displayNameLower);
    });

    console.log('[DirectGraphSync] Syncing from', foldersToSync.length, 'folders:', foldersToSync.map(f => f.displayName).join(', '));

    // Collect all messages from all folders
    const allMessages: Array<GraphMessage & { direction: 'inbound' | 'outbound'; folderName: string }> = [];

    for (const folder of foldersToSync) {
      try {
        result.folders = (result.folders || 0) + 1;

        // Determine if this is a sent folder
        const folderNameLower = folder.displayName.toLowerCase();
        const isSentFolder = folderNameLower.includes('sent') || folderNameLower === 'outbox';
        const folderFilter = isSentFolder ? sentDateFilter : receivedDateFilter;

        const messages = await client.getMessages(folder.id, {
          top: Math.ceil(maxMessages / foldersToSync.length),
          select: ['id', 'subject', 'bodyPreview', 'body', 'from', 'toRecipients', 'ccRecipients', 'receivedDateTime', 'sentDateTime', 'conversationId', 'internetMessageId', 'hasAttachments', 'isRead'],
          orderby: isSentFolder ? 'sentDateTime desc' : 'receivedDateTime desc',
          filter: folderFilter,
        });

        console.log(`[DirectGraphSync] Folder "${folder.displayName}": ${messages.value.length} messages`);

        for (const msg of messages.value) {
          allMessages.push({
            ...msg,
            direction: isSentFolder ? 'outbound' : 'inbound',
            folderName: folder.displayName,
          });
        }
      } catch (folderError) {
        console.error(`[DirectGraphSync] Error syncing folder "${folder.displayName}":`, folderError);
        result.errors.push(`Failed to sync folder ${folder.displayName}: ${folderError}`);
      }
    }

    console.log('[DirectGraphSync] Total messages collected:', allMessages.length);

    // Import each message
    for (const message of allMessages) {
      try {
        const externalId = `ms_email_${message.id}`;

        // Check if already imported
        const existing = await findExistingByExternalId(supabase, externalId);
        if (existing) {
          // Even if already exists, check if we need to link responses
          if (message.direction === 'outbound' && message.conversationId) {
            const respondedAt = message.sentDateTime || new Date().toISOString();
            await supabase
              .from('communications')
              .update({
                awaiting_our_response: false,
                responded_at: respondedAt,
              })
              .eq('thread_id', message.conversationId)
              .eq('direction', 'inbound')
              .eq('awaiting_our_response', true);
          }
          result.skipped++;
          continue;
        }

        // Convert and insert
        const communication = graphMessageToCommunication(message, message.direction, userId);

        const { data: inserted, error: insertError } = await supabase
          .from('communications')
          .insert(communication)
          .select('id')
          .single();

        if (insertError) {
          result.errors.push(`Failed to import email ${message.id}: ${insertError.message}`);
          continue;
        }

        result.imported++;

        // If outbound, mark prior inbound emails in thread as responded
        if (message.direction === 'outbound' && message.conversationId) {
          const respondedAt = message.sentDateTime || new Date().toISOString();
          await supabase
            .from('communications')
            .update({
              awaiting_our_response: false,
              responded_at: respondedAt,
            })
            .eq('thread_id', message.conversationId)
            .eq('direction', 'inbound')
            .eq('awaiting_our_response', true);
        }

        // Try to match to company/contact (async, don't block)
        matchCommunicationToCompany(inserted.id)
          .then((matchResult) => {
            if (matchResult.company_id) {
              result.matched++;
            }
          })
          .catch((err) => {
            console.error(`[DirectGraphSync] Matching failed for ${inserted.id}:`, err);
          });

        // Trigger analysis for inbound emails (async, don't block)
        if (message.direction === 'inbound' && communication.analysis_status === 'pending') {
          analyzeCommunication(inserted.id).catch((err) => {
            console.error(`[DirectGraphSync] Analysis failed for ${inserted.id}:`, err);
          });
        }

      } catch (err) {
        result.errors.push(`Error processing email ${message.id}: ${err}`);
      }
    }

    // Update last sync timestamp
    await updateLastSync(userId);

    console.log('[DirectGraphSync] Sync complete:', result);

  } catch (err) {
    console.error('[DirectGraphSync] Sync error:', err);
    result.errors.push(`Sync error: ${err}`);
  }

  return result;
}

/**
 * Quick sync for recent emails (webhook-triggered)
 */
export async function syncRecentEmailsDirectToCommunications(
  userId: string,
  minutesBack: number = 5
): Promise<DirectSyncResult> {
  const sinceDate = new Date(Date.now() - minutesBack * 60 * 1000);
  console.log(`[DirectGraphSync] Quick sync for user ${userId} since ${sinceDate.toISOString()}`);

  return syncEmailsDirectToCommunications(userId, {
    sinceDate,
    maxMessages: 50,
    folders: 'inbox-sent',
  });
}
