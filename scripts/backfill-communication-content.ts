/**
 * Backfill Communication Content
 *
 * Updates communications that have null content_preview/full_content
 * by fetching from their source tables.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfillEmailContent() {
  console.log('Backfilling email content...\n');

  // Get communications from emails that are missing content
  const { data: comms, error } = await supabase
    .from('communications')
    .select('id, source_id, content_preview, full_content')
    .eq('source_table', 'email_messages')
    .is('full_content', null);

  if (error) {
    console.error('Error fetching communications:', error);
    return;
  }

  console.log(`Found ${comms?.length || 0} emails missing content\n`);

  let updated = 0;
  for (const comm of comms || []) {
    // Fetch the source email
    const { data: email } = await supabase
      .from('email_messages')
      .select('body_text, body_preview, subject')
      .eq('id', comm.source_id)
      .single();

    if (email?.body_text || email?.body_preview) {
      const { error: updateError } = await supabase
        .from('communications')
        .update({
          full_content: email.body_text,
          content_preview: email.body_preview || email.body_text?.substring(0, 500),
        })
        .eq('id', comm.id);

      if (updateError) {
        console.error(`  Error updating ${comm.id}:`, updateError.message);
      } else {
        console.log(`  ✓ Updated ${comm.id} (${email.subject?.substring(0, 40)}...)`);
        updated++;
      }
    }
  }

  console.log(`\nUpdated ${updated} email communications`);
}

async function backfillTranscriptContent() {
  console.log('\nBackfilling transcript content...\n');

  // Get communications from transcripts that are missing content
  const { data: comms, error } = await supabase
    .from('communications')
    .select('id, source_id, content_preview, full_content')
    .eq('source_table', 'meeting_transcriptions')
    .is('full_content', null);

  if (error) {
    console.error('Error fetching communications:', error);
    return;
  }

  console.log(`Found ${comms?.length || 0} transcripts missing content\n`);

  let updated = 0;
  for (const comm of comms || []) {
    // Fetch the source transcript
    const { data: transcript } = await supabase
      .from('meeting_transcriptions')
      .select('transcription_text, summary, title')
      .eq('id', comm.source_id)
      .single();

    if (transcript?.transcription_text || transcript?.summary) {
      const { error: updateError } = await supabase
        .from('communications')
        .update({
          full_content: transcript.transcription_text,
          content_preview: transcript.summary || transcript.transcription_text?.substring(0, 500),
        })
        .eq('id', comm.id);

      if (updateError) {
        console.error(`  Error updating ${comm.id}:`, updateError.message);
      } else {
        console.log(`  ✓ Updated ${comm.id} (${transcript.title?.substring(0, 40)}...)`);
        updated++;
      }
    }
  }

  console.log(`\nUpdated ${updated} transcript communications`);
}

async function main() {
  console.log('=== Backfill Communication Content ===\n');

  await backfillEmailContent();
  await backfillTranscriptContent();

  console.log('\n=== Done ===');
}

main().catch(console.error);
