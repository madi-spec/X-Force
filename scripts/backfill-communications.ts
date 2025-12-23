/**
 * Communication Hub Backfill Script
 *
 * Syncs existing emails and transcripts to the communications table.
 *
 * Usage: npx ts-node scripts/backfill-communications.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { syncAllEmailsToCommunications } from '../src/lib/communicationHub/adapters/emailAdapter';
import { syncAllTranscriptsToCommunications } from '../src/lib/communicationHub/adapters/transcriptAdapter';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Starting Communication Hub backfill...\n');
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('');

  // Check if communications table exists
  const { data: tableCheck, error: tableError } = await supabase
    .from('communications')
    .select('id')
    .limit(1);

  if (tableError) {
    console.error('Error: communications table not found. Run migration first.');
    console.error('Error details:', tableError.message);
    process.exit(1);
  }

  console.log('Communications table verified.\n');

  // Check counts before
  const { count: emailCount } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true });

  const { count: transcriptCount } = await supabase
    .from('meeting_transcriptions')
    .select('*', { count: 'exact', head: true });

  console.log(`Found ${emailCount || 0} emails to sync`);
  console.log(`Found ${transcriptCount || 0} transcripts to sync\n`);

  // Backfill emails
  console.log('=== Backfilling Emails ===');
  const emailResult = await syncAllEmailsToCommunications();
  console.log(`Emails: ${emailResult.synced} synced, ${emailResult.errors} errors\n`);

  // Backfill transcripts
  console.log('=== Backfilling Transcripts ===');
  const transcriptResult = await syncAllTranscriptsToCommunications();
  console.log(`Transcripts: ${transcriptResult.synced} synced, ${transcriptResult.errors} errors\n`);

  // Verify results
  console.log('=== Verification ===');
  const { data: channelCounts } = await supabase
    .from('communications')
    .select('channel')
    .then(({ data }) => {
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.channel] = (counts[row.channel] || 0) + 1;
      }
      return { data: counts };
    });

  console.log('Communications by channel:');
  for (const [channel, count] of Object.entries(channelCounts || {})) {
    console.log(`  ${channel}: ${count}`);
  }

  const { count: awaitingCount } = await supabase
    .from('communications')
    .select('*', { count: 'exact', head: true })
    .eq('awaiting_our_response', true);

  console.log(`\nAwaiting our response: ${awaitingCount || 0}`);

  console.log('\n=== Backfill Complete ===');
  console.log(`Total synced: ${emailResult.synced + transcriptResult.synced}`);
  console.log(`Total errors: ${emailResult.errors + transcriptResult.errors}`);
}

main().catch(console.error);
