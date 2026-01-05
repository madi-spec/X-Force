/**
 * Process existing AI notetaker emails
 *
 * This script finds all communications from AI notetaker services
 * and marks them as processed (no response needed).
 * Also tags them with X-FORCE category in Outlook.
 *
 * Run with: npx tsx scripts/process-notetaker-emails.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { isAINotetakerEmail, getNotetakerServiceName } from '../src/lib/email/noiseDetection';
import { MicrosoftGraphClient } from '../src/lib/microsoft/graph';
import { getValidToken } from '../src/lib/microsoft/auth';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get MS Graph client for tagging
async function getGraphClient(): Promise<MicrosoftGraphClient | null> {
  try {
    const { data: msConnection } = await supabase
      .from('microsoft_connections')
      .select('user_id')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!msConnection) return null;

    const token = await getValidToken(msConnection.user_id);
    if (!token) return null;

    return new MicrosoftGraphClient(token);
  } catch {
    return null;
  }
}

async function processNotetakerEmails() {
  console.log('=== Processing AI Notetaker Emails ===\n');

  // Get MS Graph client for tagging
  const graphClient = await getGraphClient();
  if (!graphClient) {
    console.warn('Warning: Could not get MS Graph client - emails will not be tagged in Outlook\n');
  }

  // Get all communications that are awaiting our response
  const { data: pendingComms, error } = await supabase
    .from('communications')
    .select('id, subject, their_participants, awaiting_our_response, responded_at, external_id')
    .eq('awaiting_our_response', true)
    .eq('direction', 'inbound');

  if (error) {
    console.error('Error fetching communications:', error);
    return;
  }

  console.log(`Found ${pendingComms?.length || 0} inbound communications awaiting response\n`);

  let processed = 0;
  let tagged = 0;
  const byService: Record<string, number> = {};

  for (const comm of pendingComms || []) {
    // Get the sender email from their_participants
    const participants = comm.their_participants as Array<{ email?: string; name?: string }> | null;
    const senderEmail = participants?.[0]?.email;

    if (!senderEmail) continue;

    if (isAINotetakerEmail(senderEmail)) {
      const serviceName = getNotetakerServiceName(senderEmail) || 'Unknown';

      // Mark as processed
      const { error: updateError } = await supabase
        .from('communications')
        .update({
          awaiting_our_response: false,
          responded_at: new Date().toISOString(),
          analysis_status: 'complete',
          updated_at: new Date().toISOString(),
        })
        .eq('id', comm.id);

      if (updateError) {
        console.error(`Failed to update ${comm.id}:`, updateError.message);
        continue;
      }

      // Tag in Outlook
      if (graphClient && comm.external_id) {
        try {
          await graphClient.addCategoryToMessage(comm.external_id, 'X-FORCE');
          tagged++;
        } catch (tagError) {
          console.warn(`  Could not tag in Outlook: ${(tagError as Error).message}`);
        }
      }

      processed++;
      byService[serviceName] = (byService[serviceName] || 0) + 1;

      console.log(`[${serviceName}] Processed: ${comm.subject?.substring(0, 60) || 'No subject'}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total processed: ${processed}`);
  console.log(`Tagged in Outlook: ${tagged}`);
  console.log('\nBy service:');
  for (const [service, count] of Object.entries(byService).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${service}: ${count}`);
  }
}

// Also check email_messages directly for any that haven't been synced
async function checkEmailMessages() {
  console.log('\n\n=== Checking email_messages table ===\n');

  const { data: emails, error } = await supabase
    .from('email_messages')
    .select('id, from_email, subject')
    .eq('is_sent_by_user', false)
    .limit(1000);

  if (error) {
    console.error('Error fetching emails:', error);
    return;
  }

  let notetakerCount = 0;
  const byService: Record<string, number> = {};

  for (const email of emails || []) {
    if (isAINotetakerEmail(email.from_email)) {
      notetakerCount++;
      const serviceName = getNotetakerServiceName(email.from_email) || 'Unknown';
      byService[serviceName] = (byService[serviceName] || 0) + 1;
    }
  }

  console.log(`Found ${notetakerCount} AI notetaker emails in email_messages`);
  console.log('\nBy service:');
  for (const [service, count] of Object.entries(byService).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${service}: ${count}`);
  }
}

async function main() {
  await processNotetakerEmails();
  await checkEmailMessages();
}

main().catch(console.error);
