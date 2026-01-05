/**
 * Resync Sent Items to email_messages and Process for Commitments
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const userId = '11111111-1111-1111-1111-111111111009';

async function main() {
  console.log('='.repeat(70));
  console.log('RESYNC SENT ITEMS & PROCESS FOR COMMITMENTS');
  console.log('='.repeat(70));

  // Step 1: Fetch sent emails from Microsoft
  console.log('\n--- Step 1: Fetching Sent Emails ---\n');

  const { getValidToken } = await import('../src/lib/microsoft/auth');
  const { MicrosoftGraphClient } = await import('../src/lib/microsoft/graph');

  const token = await getValidToken(userId);
  if (!token) {
    console.log('No valid token');
    return;
  }

  const client = new MicrosoftGraphClient(token);

  // Get Sent Items folder
  const foldersResponse = await client.getMailFolders();
  const sentFolder = foldersResponse.value.find(f =>
    f.displayName.toLowerCase() === 'sent items'
  );

  if (!sentFolder) {
    console.log('Sent Items folder not found');
    return;
  }

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  console.log(`Fetching from: ${sentFolder.displayName}`);
  console.log(`Since: ${oneMonthAgo.toISOString()}`);

  const messages = await client.getMessages(sentFolder.id, {
    top: 100, // Smaller batch to avoid timeout
    select: ['id', 'subject', 'bodyPreview', 'from', 'toRecipients', 'sentDateTime', 'conversationId'],
    orderby: 'sentDateTime desc',
    filter: `sentDateTime ge ${oneMonthAgo.toISOString()}`,
  });

  console.log(`Fetched: ${messages.value.length} sent emails`);

  // Step 2: Check what's already in email_messages
  console.log('\n--- Step 2: Checking Existing Data ---\n');

  const { data: existingInEmailMessages } = await supabase
    .from('email_messages')
    .select('message_id')
    .eq('user_id', userId)
    .eq('is_sent_by_user', true);

  const emailMsgIds = new Set(existingInEmailMessages?.map(e => e.message_id) || []);
  console.log(`Already in email_messages: ${emailMsgIds.size}`);

  // Step 3: Import missing emails to email_messages (using proper schema)
  console.log('\n--- Step 3: Importing to email_messages ---\n');

  let imported = 0;
  let skipped = 0;

  for (const msg of messages.value) {
    // Skip if already in email_messages (check by message_id)
    if (emailMsgIds.has(msg.id)) {
      skipped++;
      continue;
    }

    // Insert with proper schema
    const { error } = await supabase.from('email_messages').insert({
      user_id: userId,
      message_id: msg.id,
      subject: msg.subject || '(No subject)',
      body_preview: msg.bodyPreview || '',
      from_email: msg.from?.emailAddress?.address || 'xraisales@affiliatedtech.com',
      from_name: msg.from?.emailAddress?.name || 'Me',
      to_emails: msg.toRecipients?.map(r => r.emailAddress.address) || [],
      to_names: msg.toRecipients?.map(r => r.emailAddress.name || null) || [],
      is_sent_by_user: true,
      sent_at: msg.sentDateTime,
      received_at: msg.sentDateTime,
      is_read: true,
      is_flagged: false,
      has_attachments: false,
    });

    if (error) {
      console.log(`Error importing ${msg.subject?.substring(0, 30)}: ${error.message}`);
    } else {
      imported++;
    }
  }

  console.log(`Imported: ${imported}, Skipped (already exists): ${skipped}`);

  // Step 4: Process all unprocessed sent emails for commitments
  console.log('\n--- Step 4: Processing for Commitments ---\n');

  const { data: unprocessed } = await supabase
    .from('email_messages')
    .select('id, subject')
    .eq('user_id', userId)
    .eq('is_sent_by_user', true)
    .or('analysis_complete.is.null,analysis_complete.eq.false')
    .limit(150);

  console.log(`Found ${unprocessed?.length || 0} unprocessed sent emails`);

  const { processOutboundEmail } = await import('../src/lib/intelligence/analyzeOutboundEmail');

  let processed = 0;
  let newCommitments = 0;
  const errors: string[] = [];

  for (const email of unprocessed || []) {
    try {
      const result = await processOutboundEmail(email.id);
      processed++;

      if (result?.analysis?.commitments_made?.length) {
        newCommitments += result.analysis.commitments_made.length;
      }

      if (processed % 20 === 0) {
        console.log(`Progress: ${processed}/${unprocessed?.length} (${newCommitments} commitments found)`);
      }
    } catch (err: any) {
      errors.push(`${email.id}: ${err.message}`);
    }
  }

  console.log(`\nProcessed: ${processed}`);
  console.log(`New commitments found: ${newCommitments}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    errors.slice(0, 3).forEach(e => console.log(`  - ${e}`));
  }

  // Step 5: Check updated RI commitments
  console.log('\n--- Step 5: Updated RI Commitments ---\n');

  const { data: riData } = await supabase
    .from('relationship_intelligence')
    .select('id, open_commitments, company_id')
    .not('open_commitments', 'is', null);

  let totalOurs = 0;
  let pendingOurs = 0;

  for (const ri of riData || []) {
    const ours = ri.open_commitments?.ours || [];
    totalOurs += ours.length;
    pendingOurs += ours.filter((c: any) => c.status === 'pending').length;
  }

  console.log(`RI records with commitments: ${riData?.length || 0}`);
  console.log(`Total 'our' commitments: ${totalOurs}`);
  console.log(`Pending 'our' commitments: ${pendingOurs}`);

  // Step 6: Show sample commitments
  console.log('\n--- Sample Commitments ---\n');

  const sampleRi = riData?.find(r => (r.open_commitments?.ours || []).length > 0);
  if (sampleRi) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', sampleRi.company_id)
      .single();

    console.log(`Company: ${company?.name}`);
    const ours = sampleRi.open_commitments?.ours || [];
    ours.slice(0, 3).forEach((c: any, i: number) => {
      console.log(`${i + 1}. ${c.commitment}`);
      console.log(`   Made on: ${c.made_on}, Due: ${c.due_by || 'N/A'}, Status: ${c.status}`);
    });
  }

  // Step 7: Check Tier 3 items created
  console.log('\n--- Tier 3 Items (Commitments) ---\n');

  const { count: tier3Count } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('tier', 3)
    .eq('status', 'pending');

  console.log(`Total Tier 3 pending items: ${tier3Count}`);

  console.log('\n' + '='.repeat(70));
  console.log('DONE');
  console.log('='.repeat(70));
}

main().catch(console.error);
