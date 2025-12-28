import { createAdminClient } from '@/lib/supabase/admin';
import { MicrosoftGraphClient } from './graph';
import { getValidToken, updateLastSync } from './auth';
import { isInternalEmail, getExternalEmails } from '@/lib/communicationHub/matching/matchEmailToCompany';

interface EmailSyncResult {
  imported: number;
  skipped: number;
  errors: string[];
  folders?: number;
}

interface EmailSyncOptions {
  sinceDate?: Date;
  maxMessages?: number;
  folders?: 'inbox-sent' | 'all'; // 'inbox-sent' is default for backward compatibility
}

// Folders to exclude from sync
const EXCLUDED_FOLDER_NAMES = [
  'deleted items',
  'deleteditems',
  'junk email',
  'junk',
  'spam',
  'deleted',
  'trash',
  'drafts', // We'll handle drafts separately if needed
];

/**
 * Sync emails from Microsoft 365 to activities
 */
export async function syncEmails(userId: string, options: EmailSyncOptions = {}): Promise<EmailSyncResult> {
  const result: EmailSyncResult = { imported: 0, skipped: 0, errors: [] };
  const { sinceDate, maxMessages = 50 } = options;

  console.log('[EmailSync] Starting sync for user:', userId);

  const token = await getValidToken(userId);
  if (!token) {
    console.log('[EmailSync] No valid token available');
    result.errors.push('No valid token available');
    return result;
  }

  const supabase = createAdminClient();
  const client = new MicrosoftGraphClient(token);

  try {
    // Get all contacts with email addresses for matching
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, email, company_id')
      .not('email', 'is', null);

    const contactsByEmail = new Map(
      contacts?.map(c => [c.email?.toLowerCase(), c]) || []
    );

    // Get deals for contacts to link activities
    const contactIds = contacts?.map(c => c.id) || [];
    const { data: dealContacts } = await supabase
      .from('deal_contacts')
      .select('contact_id, deal_id')
      .in('contact_id', contactIds);

    const dealsByContact = new Map<string, string>();
    dealContacts?.forEach(dc => {
      if (!dealsByContact.has(dc.contact_id)) {
        dealsByContact.set(dc.contact_id, dc.deal_id);
      }
    });

    // Get user info for created_by
    const { data: userProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    // Build filter for date range if specified
    const dateFilter = sinceDate
      ? `receivedDateTime ge ${sinceDate.toISOString()}`
      : undefined;
    const sentDateFilter = sinceDate
      ? `sentDateTime ge ${sinceDate.toISOString()}`
      : undefined;

    console.log('[EmailSync] Date filter:', dateFilter || 'none', '| Max messages:', maxMessages);

    // Fetch inbox messages
    const inboxMessages = await client.getMessages('inbox', {
      top: maxMessages,
      select: ['id', 'subject', 'bodyPreview', 'from', 'receivedDateTime', 'conversationId'],
      orderby: 'receivedDateTime desc',
      filter: dateFilter,
    });

    // Fetch sent messages
    const sentMessages = await client.getMessages('sentitems', {
      top: maxMessages,
      select: ['id', 'subject', 'bodyPreview', 'toRecipients', 'sentDateTime', 'conversationId'],
      orderby: 'sentDateTime desc',
      filter: sentDateFilter,
    });

    const allMessages = [
      ...inboxMessages.value.map(m => ({ ...m, direction: 'inbound' as const })),
      ...sentMessages.value.map(m => ({ ...m, direction: 'outbound' as const })),
    ];

    console.log('[EmailSync] Fetched messages:', {
      inbox: inboxMessages.value.length,
      sent: sentMessages.value.length,
      total: allMessages.length,
    });

    for (const message of allMessages) {
      try {
        // Check if already imported
        const externalId = `ms_email_${message.id}`;
        const { data: existing } = await supabase
          .from('activities')
          .select('id')
          .eq('external_id', externalId)
          .single();

        if (existing) {
          result.skipped++;
          continue;
        }

        // Find matching contact (optional - we import all emails now)
        // For inbound: match on sender (if not internal)
        // For outbound: match on ANY external recipient
        // Internal domains (voiceforpest.com, affiliatedtech.com, etc.) are excluded
        let matchedContact: { id: string; email: string | null; company_id: string | null } | null | undefined = null;

        if (message.direction === 'inbound') {
          const emailAddress = message.from?.emailAddress?.address?.toLowerCase();
          // Skip internal senders - look for external recipients instead
          if (emailAddress && !isInternalEmail(emailAddress)) {
            matchedContact = contactsByEmail.get(emailAddress);
          } else if (emailAddress && isInternalEmail(emailAddress)) {
            // Internal sender - try to match on external recipients
            const externalRecipients = getExternalEmails(
              (message.toRecipients || []).map(r => r.emailAddress?.address?.toLowerCase()).filter(Boolean) as string[]
            );
            for (const recipientEmail of externalRecipients) {
              const contact = contactsByEmail.get(recipientEmail);
              if (contact) {
                matchedContact = contact;
                break;
              }
            }
          }
        } else {
          // Check all external recipients for outbound emails
          const externalRecipients = getExternalEmails(
            (message.toRecipients || []).map(r => r.emailAddress?.address?.toLowerCase()).filter(Boolean) as string[]
          );
          for (const recipientEmail of externalRecipients) {
            const contact = contactsByEmail.get(recipientEmail);
            if (contact) {
              matchedContact = contact;
              break; // Use first matching contact
            }
          }
        }

        // Get deal for this contact if available
        const dealId = matchedContact ? dealsByContact.get(matchedContact.id) : null;

        // Use matched company or leave as null (unlinked)
        const companyId = matchedContact?.company_id || null;

        // Create activity record (company_id can be null for unlinked emails)
        const activityData = {
          type: message.direction === 'inbound' ? 'email_received' as const : 'email_sent' as const,
          subject: message.subject || '(No subject)',
          body: message.bodyPreview || '',
          contact_id: matchedContact?.id || null,
          company_id: companyId,
          deal_id: dealId || null,
          user_id: userProfile?.id || userId,
          occurred_at: message.receivedDateTime || message.sentDateTime || new Date().toISOString(),
          metadata: {
            direction: message.direction,
            microsoft_id: message.id,
            conversation_id: message.conversationId,
            from: message.from?.emailAddress,
            to: message.toRecipients?.map(r => r.emailAddress),
            has_contact: !!matchedContact,
          },
          external_id: externalId,
        };

        const { error: insertError } = await supabase
          .from('activities')
          .insert(activityData);

        if (insertError) {
          result.errors.push(`Failed to import email ${message.id}: ${insertError.message}`);
        } else {
          result.imported++;
        }
      } catch (err) {
        result.errors.push(`Error processing email ${message.id}: ${err}`);
      }
    }

    // Update last sync timestamp
    await updateLastSync(userId);

    console.log('[EmailSync] Sync complete:', result);

  } catch (err) {
    console.error('[EmailSync] Sync error:', err);
    result.errors.push(`Sync error: ${err}`);
  }

  return result;
}

/**
 * Sync emails from ALL folders (except Deleted/Junk) for historical sync
 *
 * This function fetches all mail folders and syncs emails from each,
 * building a complete picture of email history.
 */
export async function syncAllFolderEmails(
  userId: string,
  options: EmailSyncOptions = {}
): Promise<EmailSyncResult> {
  const result: EmailSyncResult = { imported: 0, skipped: 0, errors: [], folders: 0 };
  const { sinceDate, maxMessages = 200 } = options;

  console.log('[EmailSync] Starting ALL FOLDERS sync for user:', userId);

  const token = await getValidToken(userId);
  if (!token) {
    console.log('[EmailSync] No valid token available');
    result.errors.push('No valid token available');
    return result;
  }

  const supabase = createAdminClient();
  const client = new MicrosoftGraphClient(token);

  try {
    // Get all contacts with email addresses for matching
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, email, company_id')
      .not('email', 'is', null);

    const contactsByEmail = new Map(
      contacts?.map(c => [c.email?.toLowerCase(), c]) || []
    );

    // Get deals for contacts to link activities
    const contactIds = contacts?.map(c => c.id) || [];
    const { data: dealContacts } = await supabase
      .from('deal_contacts')
      .select('contact_id, deal_id')
      .in('contact_id', contactIds);

    const dealsByContact = new Map<string, string>();
    dealContacts?.forEach(dc => {
      if (!dealsByContact.has(dc.contact_id)) {
        dealsByContact.set(dc.contact_id, dc.deal_id);
      }
    });

    // Get user info for created_by
    const { data: userProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    // Build date filters (different for received vs sent)
    const receivedDateFilter = sinceDate
      ? `receivedDateTime ge ${sinceDate.toISOString()}`
      : undefined;
    const sentDateFilter = sinceDate
      ? `sentDateTime ge ${sinceDate.toISOString()}`
      : undefined;

    // Get all mail folders
    const foldersResponse = await client.getMailFolders();
    const allFolders = foldersResponse.value;

    console.log('[EmailSync] Found', allFolders.length, 'mail folders');

    // Filter out excluded folders
    const foldersToSync = allFolders.filter(folder => {
      const displayNameLower = folder.displayName.toLowerCase();
      return !EXCLUDED_FOLDER_NAMES.includes(displayNameLower);
    });

    console.log('[EmailSync] Syncing from', foldersToSync.length, 'folders:', foldersToSync.map(f => f.displayName).join(', '));

    // Collect all messages from all folders
    const allMessages: Array<{
      id: string;
      subject: string;
      bodyPreview: string;
      from?: { emailAddress: { address: string; name?: string } };
      toRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
      receivedDateTime?: string;
      sentDateTime?: string;
      conversationId?: string;
      direction: 'inbound' | 'outbound';
      folderName: string;
    }> = [];

    for (const folder of foldersToSync) {
      try {
        result.folders = (result.folders || 0) + 1;

        // Determine if this is a sent folder (uses sentDateTime instead of receivedDateTime)
        const folderNameLower = folder.displayName.toLowerCase();
        const isSentFolder = folderNameLower.includes('sent') || folderNameLower === 'outbox';

        // Use appropriate filter for sent vs received folders
        const folderFilter = isSentFolder ? sentDateFilter : receivedDateFilter;

        const messages = await client.getMessages(folder.id, {
          top: Math.ceil(maxMessages / foldersToSync.length), // Distribute across folders
          select: ['id', 'subject', 'bodyPreview', 'from', 'toRecipients', 'receivedDateTime', 'sentDateTime', 'conversationId'],
          orderby: isSentFolder ? 'sentDateTime desc' : 'receivedDateTime desc',
          filter: folderFilter,
        });

        console.log(`[EmailSync] Folder "${folder.displayName}": ${messages.value.length} messages`);

        for (const msg of messages.value) {
          allMessages.push({
            ...msg,
            direction: isSentFolder ? 'outbound' : 'inbound',
            folderName: folder.displayName,
          });
        }
      } catch (folderError) {
        console.error(`[EmailSync] Error syncing folder "${folder.displayName}":`, folderError);
        result.errors.push(`Failed to sync folder ${folder.displayName}: ${folderError}`);
      }
    }

    console.log('[EmailSync] Total messages collected:', allMessages.length);

    // Import each message
    for (const message of allMessages) {
      try {
        // Check if already imported
        const externalId = `ms_email_${message.id}`;
        const { data: existing } = await supabase
          .from('activities')
          .select('id')
          .eq('external_id', externalId)
          .single();

        if (existing) {
          result.skipped++;
          continue;
        }

        // Find matching contact
        // For inbound: match on sender (if not internal)
        // For outbound: match on ANY external recipient
        // Internal domains (voiceforpest.com, affiliatedtech.com, etc.) are excluded
        let matchedContact: { id: string; email: string | null; company_id: string | null } | null | undefined = null;

        if (message.direction === 'inbound') {
          const emailAddress = message.from?.emailAddress?.address?.toLowerCase();
          // Skip internal senders - look for external recipients instead
          if (emailAddress && !isInternalEmail(emailAddress)) {
            matchedContact = contactsByEmail.get(emailAddress);
          } else if (emailAddress && isInternalEmail(emailAddress)) {
            // Internal sender - try to match on external recipients
            const externalRecipients = getExternalEmails(
              (message.toRecipients || []).map(r => r.emailAddress?.address?.toLowerCase()).filter(Boolean) as string[]
            );
            for (const recipientEmail of externalRecipients) {
              const contact = contactsByEmail.get(recipientEmail);
              if (contact) {
                matchedContact = contact;
                break;
              }
            }
          }
        } else {
          // Check all external recipients for outbound emails
          const externalRecipients = getExternalEmails(
            (message.toRecipients || []).map(r => r.emailAddress?.address?.toLowerCase()).filter(Boolean) as string[]
          );
          for (const recipientEmail of externalRecipients) {
            const contact = contactsByEmail.get(recipientEmail);
            if (contact) {
              matchedContact = contact;
              break; // Use first matching contact
            }
          }
        }

        // Get deal for this contact if available
        const dealId = matchedContact ? dealsByContact.get(matchedContact.id) : null;

        // Use matched company or leave as null (unlinked)
        const companyId = matchedContact?.company_id || null;

        // Create activity record (company_id can be null for unlinked emails)
        const activityData = {
          type: message.direction === 'inbound' ? 'email_received' as const : 'email_sent' as const,
          subject: message.subject || '(No subject)',
          body: message.bodyPreview || '',
          contact_id: matchedContact?.id || null,
          company_id: companyId,
          deal_id: dealId || null,
          user_id: userProfile?.id || userId,
          occurred_at: message.receivedDateTime || message.sentDateTime || new Date().toISOString(),
          metadata: {
            direction: message.direction,
            microsoft_id: message.id,
            conversation_id: message.conversationId,
            from: message.from?.emailAddress,
            to: message.toRecipients?.map(r => r.emailAddress),
            has_contact: !!matchedContact,
            folder: message.folderName,
          },
          external_id: externalId,
        };

        const { error: insertError } = await supabase
          .from('activities')
          .insert(activityData);

        if (insertError) {
          result.errors.push(`Failed to import email ${message.id}: ${insertError.message}`);
        } else {
          result.imported++;
        }
      } catch (err) {
        result.errors.push(`Error processing email ${message.id}: ${err}`);
      }
    }

    // Update last sync timestamp
    await updateLastSync(userId);

    console.log('[EmailSync] All folders sync complete:', result);

  } catch (err) {
    console.error('[EmailSync] Sync error:', err);
    result.errors.push(`Sync error: ${err}`);
  }

  return result;
}

/**
 * Send an email via Microsoft Graph
 */
export async function sendEmail(
  userId: string,
  to: string[],
  subject: string,
  body: string,
  cc?: string[],
  isHtml: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const token = await getValidToken(userId);
  if (!token) {
    return { success: false, error: 'No valid token available' };
  }

  const client = new MicrosoftGraphClient(token);

  try {
    await client.sendMessage({
      subject,
      body: { contentType: isHtml ? 'HTML' : 'Text', content: body },
      toRecipients: to.map(email => ({ emailAddress: { address: email } })),
      ccRecipients: cc?.map(email => ({ emailAddress: { address: email } })),
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Sync recent emails (for webhook-triggered quick sync)
 * Only syncs emails from the last N minutes
 */
export async function syncRecentEmails(
  userId: string,
  minutesBack: number = 5
): Promise<EmailSyncResult> {
  const sinceDate = new Date(Date.now() - minutesBack * 60 * 1000);
  console.log(`[EmailSync] Quick sync for user ${userId} since ${sinceDate.toISOString()}`);

  return syncEmails(userId, {
    sinceDate,
    maxMessages: 20,
    folders: 'inbox-sent',
  });
}
