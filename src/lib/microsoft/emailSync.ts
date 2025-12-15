import { createClient } from '@/lib/supabase/server';
import { MicrosoftGraphClient } from './graph';
import { getValidToken, updateLastSync } from './auth';

interface EmailSyncResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Sync emails from Microsoft 365 to activities
 */
export async function syncEmails(userId: string): Promise<EmailSyncResult> {
  const result: EmailSyncResult = { imported: 0, skipped: 0, errors: [] };

  const token = await getValidToken(userId);
  if (!token) {
    result.errors.push('No valid token available');
    return result;
  }

  const supabase = await createClient();
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

    // Fetch recent inbox messages
    const inboxMessages = await client.getMessages('inbox', {
      top: 50,
      select: ['id', 'subject', 'bodyPreview', 'from', 'receivedDateTime', 'conversationId'],
      orderby: 'receivedDateTime desc',
    });

    // Fetch recent sent messages
    const sentMessages = await client.getMessages('sentitems', {
      top: 50,
      select: ['id', 'subject', 'bodyPreview', 'toRecipients', 'sentDateTime', 'conversationId'],
      orderby: 'sentDateTime desc',
    });

    const allMessages = [
      ...inboxMessages.value.map(m => ({ ...m, direction: 'inbound' as const })),
      ...sentMessages.value.map(m => ({ ...m, direction: 'outbound' as const })),
    ];

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
        const emailAddress = message.direction === 'inbound'
          ? message.from?.emailAddress?.address?.toLowerCase()
          : message.toRecipients?.[0]?.emailAddress?.address?.toLowerCase();

        const matchedContact = emailAddress ? contactsByEmail.get(emailAddress) : null;

        if (!matchedContact) {
          // Skip emails that don't match any contacts
          result.skipped++;
          continue;
        }

        // Get deal for this contact if available
        const dealId = dealsByContact.get(matchedContact.id);

        // Create activity record
        const activityData = {
          type: 'email' as const,
          subject: message.subject || '(No subject)',
          description: message.bodyPreview || '',
          contact_id: matchedContact.id,
          company_id: matchedContact.company_id,
          deal_id: dealId || null,
          created_by: userProfile?.id || userId,
          completed_at: message.receivedDateTime || message.sentDateTime || new Date().toISOString(),
          metadata: {
            direction: message.direction,
            microsoft_id: message.id,
            conversation_id: message.conversationId,
            from: message.from?.emailAddress,
            to: message.toRecipients?.map(r => r.emailAddress),
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

  } catch (err) {
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
  cc?: string[]
): Promise<{ success: boolean; error?: string }> {
  const token = await getValidToken(userId);
  if (!token) {
    return { success: false, error: 'No valid token available' };
  }

  const client = new MicrosoftGraphClient(token);

  try {
    await client.sendMessage({
      subject,
      body: { contentType: 'HTML', content: body },
      toRecipients: to.map(email => ({ emailAddress: { address: email } })),
      ccRecipients: cc?.map(email => ({ emailAddress: { address: email } })),
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
