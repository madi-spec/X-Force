import { createAdminClient } from '@/lib/supabase/admin';
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
    // Get or create a default company for external emails
    let { data: externalCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('name', 'External Contacts')
      .single();

    if (!externalCompany) {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ name: 'External Contacts', industry: 'pest', segment: 'smb', status: 'prospect' })
        .select('id')
        .single();
      if (companyError) {
        console.error('[EmailSync] Failed to create External Contacts company:', companyError);
      }
      externalCompany = newCompany;
    }

    const externalCompanyId = externalCompany?.id;
    console.log('[EmailSync] External company ID:', externalCompanyId);

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
        const emailAddress = message.direction === 'inbound'
          ? message.from?.emailAddress?.address?.toLowerCase()
          : message.toRecipients?.[0]?.emailAddress?.address?.toLowerCase();

        const matchedContact = emailAddress ? contactsByEmail.get(emailAddress) : null;

        // Get deal for this contact if available
        const dealId = matchedContact ? dealsByContact.get(matchedContact.id) : null;

        // Use external company for emails without matched contacts
        const companyId = matchedContact?.company_id || externalCompanyId;

        if (!companyId) {
          console.log('[EmailSync] Skipping email - no company available:', message.subject);
          result.skipped++;
          continue;
        }

        // Create activity record
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
