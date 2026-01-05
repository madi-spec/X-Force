/**
 * Sync Sent Items and Check for Duplicates
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const targetEmail = 'xraisales@affiliatedtech.com';

async function main() {
  console.log('='.repeat(70));
  console.log('SYNC SENT ITEMS & CHECK DUPLICATES');
  console.log('='.repeat(70));

  // Find user
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', targetEmail)
    .single();

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log(`User: ${targetEmail}`);

  // PART 1: Check for duplicate command center items
  console.log('\n--- Checking for Duplicates ---\n');

  // Check duplicates by source_id
  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select('id, source_id, title, tier, tier_trigger, contact_id, company_id')
    .eq('user_id', user.id)
    .eq('status', 'pending');

  const sourceIdCounts = new Map<string, number>();
  const titleCounts = new Map<string, number>();

  for (const item of ccItems || []) {
    if (item.source_id) {
      sourceIdCounts.set(item.source_id, (sourceIdCounts.get(item.source_id) || 0) + 1);
    }
    const key = `${item.contact_id || item.company_id}:${item.title}`;
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
  }

  const sourceIdDupes = Array.from(sourceIdCounts.entries()).filter(([_, count]) => count > 1);
  const titleDupes = Array.from(titleCounts.entries()).filter(([_, count]) => count > 1);

  console.log(`Total pending items: ${ccItems?.length || 0}`);
  console.log(`Duplicate source_ids: ${sourceIdDupes.length}`);
  console.log(`Duplicate contact+title combinations: ${titleDupes.length}`);

  if (sourceIdDupes.length > 0) {
    console.log('\nSource ID duplicates:');
    sourceIdDupes.slice(0, 5).forEach(([id, count]) => {
      console.log(`  ${id}: ${count} items`);
    });
  }

  if (titleDupes.length > 0) {
    console.log('\nTitle duplicates:');
    titleDupes.slice(0, 5).forEach(([key, count]) => {
      console.log(`  ${key.substring(0, 60)}: ${count} items`);
    });
  }

  // PART 2: Sync Sent Items folder
  console.log('\n--- Syncing Sent Items Folder ---\n');

  const { getValidToken } = await import('../src/lib/microsoft/auth');
  const { MicrosoftGraphClient } = await import('../src/lib/microsoft/graph');

  const token = await getValidToken(user.id);
  if (!token) {
    console.log('No valid Microsoft token');
    return;
  }

  const client = new MicrosoftGraphClient(token);

  // Get Sent Items folder
  const foldersResponse = await client.getMailFolders();
  const sentFolder = foldersResponse.value.find(f =>
    f.displayName.toLowerCase() === 'sent items' ||
    f.displayName.toLowerCase() === 'sent'
  );

  if (!sentFolder) {
    console.log('Sent Items folder not found');
    return;
  }

  console.log(`Found Sent Items folder: ${sentFolder.displayName} (${sentFolder.id})`);

  // Calculate one month ago
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  // Fetch with proper sentDateTime filter
  const sentDateFilter = `sentDateTime ge ${oneMonthAgo.toISOString()}`;
  console.log(`Filter: ${sentDateFilter}`);

  const messages = await client.getMessages(sentFolder.id, {
    top: 200,
    select: ['id', 'subject', 'bodyPreview', 'from', 'toRecipients', 'sentDateTime', 'conversationId', 'body'],
    orderby: 'sentDateTime desc',
    filter: sentDateFilter,
  });

  console.log(`Fetched ${messages.value.length} sent emails`);

  // Import to email_messages table
  let imported = 0;
  let skipped = 0;

  for (const msg of messages.value) {
    const externalId = `ms_email_${msg.id}`;

    // Check if exists in email_messages
    const { data: existing } = await supabase
      .from('email_messages')
      .select('id')
      .eq('external_id', externalId)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    // Find contact by recipient email
    const recipientEmail = msg.toRecipients?.[0]?.emailAddress?.address?.toLowerCase();
    let contactId = null;
    let companyId = null;
    let conversationRef = null;

    if (recipientEmail) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, company_id')
        .ilike('email', recipientEmail)
        .single();

      if (contact) {
        contactId = contact.id;
        companyId = contact.company_id;
      }

      // Try to find existing conversation
      const { data: conv } = await supabase
        .from('email_conversations')
        .select('id')
        .eq('user_id', user.id)
        .eq('thread_id', msg.conversationId)
        .single();

      conversationRef = conv?.id;
    }

    // Insert email message
    const { error } = await supabase.from('email_messages').insert({
      user_id: user.id,
      external_id: externalId,
      conversation_ref: conversationRef,
      thread_id: msg.conversationId,
      subject: msg.subject || '(No subject)',
      snippet: msg.bodyPreview || '',
      body_text: msg.body?.content || msg.bodyPreview || '',
      from_email: msg.from?.emailAddress?.address || targetEmail,
      from_name: msg.from?.emailAddress?.name || 'Me',
      to_emails: msg.toRecipients?.map(r => r.emailAddress.address) || [],
      is_sent_by_user: true,
      sent_at: msg.sentDateTime,
      received_at: msg.sentDateTime,
      contact_id: contactId,
      company_id: companyId,
      analysis_complete: false,
    });

    if (!error) {
      imported++;
    }
  }

  console.log(`Imported: ${imported}, Skipped: ${skipped}`);

  // PART 3: Process outbound emails for RI
  console.log('\n--- Processing Outbound Emails for RI ---\n');

  // Get unprocessed outbound emails
  const { data: unprocessedEmails } = await supabase
    .from('email_messages')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_sent_by_user', true)
    .eq('analysis_complete', false)
    .limit(100);

  console.log(`Found ${unprocessedEmails?.length || 0} unprocessed outbound emails`);

  const { processOutboundEmail } = await import('../src/lib/intelligence/analyzeOutboundEmail');

  let processed = 0;
  let newCommitments = 0;

  for (const email of unprocessedEmails || []) {
    try {
      const result = await processOutboundEmail(email.id);
      processed++;

      // Count commitments from the analysis
      if (result?.analysis?.commitments_made) {
        newCommitments += result.analysis.commitments_made.length;
      }

      if (processed % 10 === 0) {
        console.log(`Processed ${processed}/${unprocessedEmails?.length}...`);
      }
    } catch (err) {
      console.log(`Error processing ${email.id}:`, err);
    }
  }

  console.log(`Processed ${processed} outbound emails`);
  console.log(`New commitments detected: ${newCommitments}`);

  // PART 4: Check updated RI
  console.log('\n--- Updated Relationship Intelligence ---\n');

  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('id, open_commitments, signals')
    .not('open_commitments', 'is', null);

  let totalOurCommitments = 0;
  let pendingCommitments = 0;

  for (const ri of riRecords || []) {
    const ours = ri.open_commitments?.ours || [];
    totalOurCommitments += ours.length;
    pendingCommitments += ours.filter((c: any) => c.status === 'pending').length;
  }

  console.log(`Total RI records with commitments: ${riRecords?.length || 0}`);
  console.log(`Total 'our commitments': ${totalOurCommitments}`);
  console.log(`Pending commitments: ${pendingCommitments}`);

  // PART 5: Check Tier 3 items
  console.log('\n--- Tier 3 (Commitments) Items ---\n');

  const { data: tier3Items } = await supabase
    .from('command_center_items')
    .select('id, title, why_now, tier_trigger')
    .eq('user_id', user.id)
    .eq('tier', 3)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`Total Tier 3 items: ${tier3Items?.length || 0}`);

  tier3Items?.forEach((item, i) => {
    console.log(`\n${i + 1}. ${item.title}`);
    console.log(`   Why Now: ${item.why_now?.substring(0, 80)}...`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('DONE');
  console.log('='.repeat(70));
}

main().catch(console.error);
