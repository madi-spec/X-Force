/**
 * Sync emails directly to communications table
 * This bypasses the activities table which has company_id NOT NULL constraint
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { MicrosoftGraphClient } from '../src/lib/microsoft/graph';
import { getValidToken } from '../src/lib/microsoft/auth';
import { classifyEmailNoise } from '../src/lib/email/noiseDetection';
import { matchCommunicationToCompany, isInternalEmail } from '../src/lib/communicationHub/matching/matchEmailToCompany';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncToCommunications() {
  console.log('=== Sync Emails to Communications Table ===\n');

  const { data: connections } = await supabase
    .from('microsoft_connections')
    .select('user_id, email')
    .eq('is_active', true);

  if (!connections?.length) {
    console.log('No active connections');
    return;
  }

  const conn = connections[0];
  console.log(`Syncing for ${conn.email}...\n`);

  const token = await getValidToken(conn.user_id);
  if (!token) {
    console.log('No valid token');
    return;
  }

  // Get user ID
  const { data: userProfile } = await supabase
    .from('users')
    .select('id')
    .eq('id', conn.user_id)
    .single();

  const client = new MicrosoftGraphClient(token);

  // Fetch inbox and sent items
  const [inboxMessages, sentMessages] = await Promise.all([
    client.getMessages('inbox', {
      top: 50,
      select: ['id', 'subject', 'bodyPreview', 'body', 'from', 'toRecipients', 'receivedDateTime', 'sentDateTime', 'conversationId', 'hasAttachments', 'internetMessageId'],
      orderby: 'receivedDateTime desc',
    }),
    client.getMessages('sentitems', {
      top: 50,
      select: ['id', 'subject', 'bodyPreview', 'body', 'from', 'toRecipients', 'receivedDateTime', 'sentDateTime', 'conversationId', 'hasAttachments', 'internetMessageId'],
      orderby: 'sentDateTime desc',
    }),
  ]);

  const allMessages = [
    ...inboxMessages.value.map((m: Record<string, unknown>) => ({ ...m, direction: 'inbound' as const })),
    ...sentMessages.value.map((m: Record<string, unknown>) => ({ ...m, direction: 'outbound' as const })),
  ];

  console.log(`Found ${allMessages.length} messages (${inboxMessages.value.length} inbox, ${sentMessages.value.length} sent)\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const msg of allMessages) {
    const externalId = `ms_email_${msg.id}`;

    // Check if already synced
    const { data: existing } = await supabase
      .from('communications')
      .select('id')
      .eq('external_id', externalId)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    const fromEmail = (msg.from as { emailAddress?: { address?: string } })?.emailAddress?.address || '';
    const fromName = (msg.from as { emailAddress?: { name?: string } })?.emailAddress?.name || '';
    const toRecipients = (msg.toRecipients as Array<{ emailAddress?: { address?: string; name?: string } }>) || [];
    const isOutbound = msg.direction === 'outbound';

    // Build participants
    const fromParticipant = { email: fromEmail, name: fromName };
    const toParticipants = toRecipients.map(r => ({
      email: r.emailAddress?.address || '',
      name: r.emailAddress?.name || '',
    }));

    // Check if this is a noise email
    const noiseClassification = !isOutbound
      ? classifyEmailNoise(fromEmail, msg.subject as string, msg.bodyPreview as string)
      : null;
    const isNoiseEmail = noiseClassification?.autoProcess ?? false;

    // Determine response state
    const awaitingOurResponse = !isOutbound && !isNoiseEmail;
    const respondedAt = isNoiseEmail ? new Date().toISOString() : null;

    // Build communication record
    // Note: source_id expects a UUID, so we store Microsoft ID in metadata instead
    const commData = {
      channel: 'email',
      direction: msg.direction,
      occurred_at: (msg.receivedDateTime as string) || (msg.sentDateTime as string) || new Date().toISOString(),
      subject: msg.subject,
      content_preview: msg.bodyPreview || null,
      full_content: (msg.body as { content?: string })?.content || null,
      attachments: msg.hasAttachments ? [{ name: 'attachment', type: 'unknown', size: 0, url: '' }] : null,
      our_participants: isOutbound
        ? [{ ...fromParticipant, role: 'sender' }]
        : toParticipants.map(p => ({ ...p, role: 'recipient' })),
      their_participants: isOutbound ? toParticipants : [fromParticipant],
      source_table: 'microsoft_graph',
      source_id: null,  // source_id expects UUID, can't use MS Graph ID
      external_id: externalId,
      thread_id: msg.conversationId as string || null,
      awaiting_our_response: awaitingOurResponse,
      awaiting_their_response: isOutbound,
      response_sla_minutes: awaitingOurResponse ? 240 : null,
      response_due_by: awaitingOurResponse
        ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        : null,
      responded_at: respondedAt,
      user_id: userProfile?.id,
      company_id: null, // Will be matched after insert
      contact_id: null,
      deal_id: null,
    };

    try {
      const { data: inserted, error: insertError } = await supabase
        .from('communications')
        .insert(commData)
        .select('id')
        .single();

      if (insertError) {
        console.error(`Error inserting ${msg.subject}:`, insertError.message);
        errors++;
      } else {
        imported++;
        console.log(`✓ Imported: ${msg.subject}`);

        // Try to match to company in background
        if (inserted?.id) {
          matchCommunicationToCompany(inserted.id).catch(() => {});
        }
      }
    } catch (err) {
      console.error(`Error processing ${msg.subject}:`, err);
      errors++;
    }
  }

  console.log(`\n=== Sync Complete ===`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped (already synced): ${skipped}`);
  console.log(`Errors: ${errors}`);

  // Show most recent communications
  const { data: recent } = await supabase
    .from('communications')
    .select('id, subject, occurred_at, direction, awaiting_our_response')
    .eq('channel', 'email')
    .order('occurred_at', { ascending: false })
    .limit(5);

  console.log(`\nMost recent communications:`);
  recent?.forEach(c => {
    console.log(`  [${c.occurred_at}] ${c.direction} ${c.awaiting_our_response ? '⚠️' : ''} - ${c.subject?.substring(0, 50)}`);
  });
}

syncToCommunications().catch(console.error);
