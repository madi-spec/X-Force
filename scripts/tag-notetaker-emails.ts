/**
 * Tag existing notetaker emails in Outlook
 *
 * Run with: npx tsx scripts/tag-notetaker-emails.ts
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

async function main() {
  console.log('=== Tagging Notetaker Emails in Outlook ===\n');

  // Get graph client
  const { data: msConnection } = await supabase
    .from('microsoft_connections')
    .select('user_id')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!msConnection) {
    console.log('No MS connection found');
    return;
  }

  const token = await getValidToken(msConnection.user_id);
  if (!token) {
    console.log('No token available');
    return;
  }

  const graphClient = new MicrosoftGraphClient(token);
  console.log('Got MS Graph client\n');

  // Get all inbound communications with external_id (MS Graph message ID)
  const { data: comms, error } = await supabase
    .from('communications')
    .select('id, subject, their_participants, external_id')
    .eq('direction', 'inbound')
    .not('external_id', 'is', null);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Checking ${comms?.length || 0} inbound communications...\n`);

  let tagged = 0;
  let skipped = 0;
  let errors = 0;

  for (const comm of comms || []) {
    const participants = comm.their_participants as Array<{ email?: string }> | null;
    const senderEmail = participants?.[0]?.email;

    if (!senderEmail || !isAINotetakerEmail(senderEmail)) {
      continue;
    }

    const service = getNotetakerServiceName(senderEmail) || 'Unknown';

    try {
      await graphClient.addCategoryToMessage(comm.external_id, 'X-FORCE');
      console.log(`[${service}] Tagged: ${comm.subject?.substring(0, 55) || 'No subject'}`);
      tagged++;
    } catch (e: unknown) {
      const errMsg = (e as Error).message || String(e);
      if (errMsg.includes('already') || errMsg.includes('ResourceNotFound')) {
        skipped++;
      } else {
        console.warn(`[${service}] Error: ${errMsg.substring(0, 60)}`);
        errors++;
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Tagged: ${tagged}`);
  console.log(`Skipped (already tagged or not found): ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
