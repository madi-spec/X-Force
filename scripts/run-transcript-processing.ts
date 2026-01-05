/**
 * Run processTranscriptAnalysis on unprocessed transcripts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { processTranscriptAnalysis, processSingleTranscript } from '../src/lib/pipelines/processTranscriptAnalysis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== RUN TRANSCRIPT PROCESSING ===\n');

  // First, reset a few transcripts to unprocessed state for testing
  const { data: toReset } = await supabase
    .from('meeting_transcriptions')
    .select('id, title')
    .eq('cc_items_created', true)
    .not('analysis', 'is', null)
    .limit(3);

  if (toReset && toReset.length > 0) {
    console.log('Resetting transcripts for testing:');
    for (const t of toReset) {
      console.log('  -', t.title?.substring(0, 50));
    }

    await supabase
      .from('meeting_transcriptions')
      .update({ cc_items_created: false, cc_processed_at: null })
      .in('id', toReset.map(t => t.id));

    console.log('\n');
  }

  // Now run the processing
  console.log('Running processTranscriptAnalysis()...\n');

  const result = await processTranscriptAnalysis();

  console.log('Results:');
  console.log('  Transcripts processed:', result.transcriptsProcessed);
  console.log('  Items created:', result.itemsCreated);
  console.log('  Tier 2 items:', result.tier2Items);
  console.log('  Tier 3 items:', result.tier3Items);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    for (const err of result.errors) {
      console.log('  -', err);
    }
  }

  // Verify items were created
  console.log('\n--- Verifying created items ---\n');

  const { data: newItems } = await supabase
    .from('command_center_items')
    .select('id, title, tier, tier_trigger, why_now, source, transcription_id')
    .not('transcription_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`Found ${newItems?.length || 0} CC items with transcription_id:`);
  for (const item of (newItems || [])) {
    console.log(`\n  [Tier ${item.tier}] ${item.tier_trigger}`);
    console.log(`  Title: ${item.title?.substring(0, 60)}`);
    console.log(`  Why Now: ${item.why_now?.substring(0, 60)}`);
  }

  // Check relationship intelligence updates
  console.log('\n--- Checking Relationship Intelligence ---\n');

  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('id, company_id, interactions, signals')
    .order('updated_at', { ascending: false })
    .limit(5);

  let hasTranscriptInteractions = false;
  for (const ri of (riRecords || [])) {
    const transcriptInteractions = (ri.interactions || []).filter(
      (i: any) => i.type === 'transcript'
    );
    if (transcriptInteractions.length > 0) {
      hasTranscriptInteractions = true;
      console.log(`RI ${ri.id.substring(0, 8)}... has ${transcriptInteractions.length} transcript interactions`);
    }
  }

  if (!hasTranscriptInteractions) {
    console.log('No relationship intelligence records have transcript interactions');
  }
}

main().catch(console.error);
