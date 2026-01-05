/**
 * Backfill script to fix command center items that are missing
 * company_id, deal_id, or transcription_id from their source transcripts.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== BACKFILL CC TRANSCRIPT LINKS ===\n');

  // 1. Find CC items with source='transcription' but null transcription_id
  //    We need to match them to transcripts by title
  console.log('1. Finding items with source=transcription but null transcription_id...\n');

  const { data: orphanedItems, error: orphanedError } = await supabase
    .from('command_center_items')
    .select('id, title, company_id, deal_id, transcription_id, source')
    .eq('source', 'transcription')
    .is('transcription_id', null)
    .order('created_at', { ascending: false });

  if (orphanedError) {
    console.error('Error fetching orphaned items:', orphanedError);
    return;
  }

  const orphanedCount = orphanedItems?.length || 0;
  console.log(`Found ${orphanedCount} items with source=transcription but null transcription_id\n`);

  // Get all transcripts for matching
  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, company_id, deal_id');

  const transcriptMap = new Map<string, { id: string; company_id: string | null; deal_id: string | null }>();
  for (const t of transcripts || []) {
    // Store by title (normalized)
    const normalizedTitle = t.title?.trim().toLowerCase() || '';
    if (normalizedTitle) {
      transcriptMap.set(normalizedTitle, { id: t.id, company_id: t.company_id, deal_id: t.deal_id });
    }
  }

  let matched = 0;
  let updated = 0;

  for (const item of orphanedItems || []) {
    // Extract transcript title from CC item title
    // Format: "Meeting Follow-ups: <transcript title>"
    let transcriptTitle = item.title?.replace(/^Meeting Follow-ups:\s*/i, '').trim().toLowerCase() || '';

    // Try to find matching transcript
    let match = transcriptMap.get(transcriptTitle);

    // If no exact match, try partial matching
    if (!match && transcriptTitle) {
      for (const [title, data] of transcriptMap.entries()) {
        if (title.includes(transcriptTitle) || transcriptTitle.includes(title)) {
          match = data;
          break;
        }
      }
    }

    if (match) {
      matched++;
      console.log(`Match found for: "${item.title?.substring(0, 50)}..."`);
      console.log(`  -> Transcript: ${match.id}`);
      console.log(`  -> Company: ${match.company_id}`);
      console.log(`  -> Deal: ${match.deal_id}`);

      // Update the CC item
      const updates: Record<string, unknown> = { transcription_id: match.id };

      // Only update company_id if not already set
      if (!item.company_id && match.company_id) {
        updates.company_id = match.company_id;
      }

      // Only update deal_id if not already set
      if (!item.deal_id && match.deal_id) {
        updates.deal_id = match.deal_id;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('command_center_items')
          .update(updates)
          .eq('id', item.id);

        if (updateError) {
          console.error(`  ERROR updating item: ${updateError.message}`);
        } else {
          updated++;
          console.log(`  UPDATED with: ${JSON.stringify(updates)}`);
        }
      }
    } else {
      console.log(`No match for: "${item.title?.substring(0, 50)}..."`);
    }
    console.log('');
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total orphaned items: ${orphanedCount}`);
  console.log(`Matched to transcripts: ${matched}`);
  console.log(`Updated: ${updated}`);

  // 2. Also fix any CC items that have transcription_id but null company_id
  console.log('\n\n2. Fixing items WITH transcription_id but missing company_id...\n');

  const { data: itemsWithTranscriptId, error: itemsError } = await supabase
    .from('command_center_items')
    .select('id, title, company_id, deal_id, transcription_id')
    .not('transcription_id', 'is', null)
    .or('company_id.is.null,deal_id.is.null');

  if (itemsError) {
    console.error('Error fetching items with transcription_id:', itemsError);
    return;
  }

  const itemsCount = itemsWithTranscriptId?.length || 0;
  console.log(`Found ${itemsCount} items with transcription_id but missing company/deal\n`);

  let fixed = 0;
  for (const item of itemsWithTranscriptId || []) {
    // Get the transcript
    const { data: transcript } = await supabase
      .from('meeting_transcriptions')
      .select('company_id, deal_id')
      .eq('id', item.transcription_id!)
      .single();

    if (!transcript) {
      console.log(`Transcript not found for item: ${item.id}`);
      continue;
    }

    const updates: Record<string, unknown> = {};
    if (!item.company_id && transcript.company_id) {
      updates.company_id = transcript.company_id;
    }
    if (!item.deal_id && transcript.deal_id) {
      updates.deal_id = transcript.deal_id;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('command_center_items')
        .update(updates)
        .eq('id', item.id);

      if (updateError) {
        console.error(`ERROR updating item ${item.id}: ${updateError.message}`);
      } else {
        fixed++;
        console.log(`Fixed item "${item.title?.substring(0, 50)}..." with:`, updates);
      }
    }
  }

  console.log(`\nFixed ${fixed} items with transcription_id but missing company/deal`);

  console.log('\n=== DONE ===');
}

main().catch(console.error);
