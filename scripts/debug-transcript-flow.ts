/**
 * Debug Transcript Flow
 *
 * Investigates why transcripts aren't flowing to relationship intelligence and CC items
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debug() {
  console.log('=== DEBUG TRANSCRIPT FLOW ===\n');

  // 1. Check transcripts with contact_id
  console.log('--- 1. Transcripts with contact_id ---\n');
  const { data: withContact, count: withContactCount } = await supabase
    .from('meeting_transcriptions')
    .select('id', { count: 'exact' })
    .not('contact_id', 'is', null);

  const { data: withoutContact, count: withoutContactCount } = await supabase
    .from('meeting_transcriptions')
    .select('id', { count: 'exact' })
    .is('contact_id', null);

  console.log(`Transcripts with contact_id: ${withContactCount || 0}`);
  console.log(`Transcripts without contact_id: ${withoutContactCount || 0}`);

  // 2. Check CC items with transcription_id
  console.log('\n--- 2. CC Items with transcription_id ---\n');
  const { data: ccWithTranscript, count: ccCount } = await supabase
    .from('command_center_items')
    .select('id, title, transcription_id, source, tier, status', { count: 'exact' })
    .not('transcription_id', 'is', null);

  console.log(`CC items with transcription_id: ${ccCount || 0}`);
  if (ccWithTranscript && ccWithTranscript.length > 0) {
    for (const item of ccWithTranscript.slice(0, 5)) {
      console.log(`  - [${item.status}] ${item.source} | Tier ${item.tier} | ${item.title?.substring(0, 50)}`);
    }
  }

  // 3. Check if cc_items_created is being set correctly
  console.log('\n--- 3. Transcripts marked as cc_items_created ---\n');
  const { data: markedCreated, count: markedCount } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, cc_items_created, cc_processed_at', { count: 'exact' })
    .eq('cc_items_created', true)
    .limit(5);

  console.log(`Transcripts with cc_items_created=true: ${markedCount || 0}`);
  for (const t of (markedCreated || [])) {
    console.log(`  - ${t.title?.substring(0, 50)}`);
    console.log(`    Processed at: ${t.cc_processed_at || 'null'}`);

    // Check if this transcript has CC items
    const { data: items } = await supabase
      .from('command_center_items')
      .select('id, title, tier')
      .eq('transcription_id', t.id);

    console.log(`    CC items: ${items?.length || 0}`);
  }

  // 4. Check relationship_intelligence records with company_id
  console.log('\n--- 4. Relationship Intelligence by company_id ---\n');

  // Get a transcript company_id
  const { data: sampleTranscript } = await supabase
    .from('meeting_transcriptions')
    .select('id, company_id, analysis')
    .not('company_id', 'is', null)
    .not('analysis', 'is', null)
    .limit(1)
    .single();

  if (sampleTranscript) {
    console.log(`Sample transcript company_id: ${sampleTranscript.company_id}`);

    const { data: companyRI } = await supabase
      .from('relationship_intelligence')
      .select('id, interactions, signals')
      .eq('company_id', sampleTranscript.company_id)
      .is('contact_id', null)
      .single();

    if (companyRI) {
      console.log(`\nFound RI for company (id: ${companyRI.id}):`);
      console.log(`  Interactions: ${companyRI.interactions?.length || 0}`);
      console.log(`  Buying Signals: ${companyRI.signals?.buying_signals?.length || 0}`);
      console.log(`  Concerns: ${companyRI.signals?.concerns?.length || 0}`);
    } else {
      console.log('\nNo RI record for company-only (contact_id is null)');

      // Check if there's any RI for this company at all
      const { data: anyRI } = await supabase
        .from('relationship_intelligence')
        .select('id, contact_id')
        .eq('company_id', sampleTranscript.company_id);

      console.log(`Any RI with this company_id: ${anyRI?.length || 0}`);
    }
  }

  // 5. Check if processTranscriptAnalysis created items or just marked as processed
  console.log('\n--- 5. Check processTranscriptAnalysis output ---\n');

  // Find a transcript that should have created items (has ourCommitments)
  const { data: transcriptWithCommitments } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, analysis, cc_items_created')
    .not('analysis', 'is', null)
    .limit(1)
    .single();

  if (transcriptWithCommitments) {
    const analysis = transcriptWithCommitments.analysis as any;
    console.log(`Transcript: ${transcriptWithCommitments.title}`);
    console.log(`  Our Commitments: ${analysis?.ourCommitments?.length || 0}`);
    console.log(`  Action Items (us): ${(analysis?.actionItems || []).filter((a: any) => a.owner === 'us').length}`);
    console.log(`  Buying Signals: ${analysis?.buyingSignals?.length || 0}`);
    console.log(`  cc_items_created: ${transcriptWithCommitments.cc_items_created}`);

    if (analysis?.ourCommitments?.length > 0) {
      console.log('\n  Sample Commitment:');
      const c = analysis.ourCommitments[0];
      console.log(`    - "${c.commitment}"`);
      console.log(`    - When: ${c.when || 'not specified'}`);
    }
  }

  // 6. Summary: What's the gap?
  console.log('\n=== GAP ANALYSIS ===\n');

  const issues = [];

  if (withContactCount === 0) {
    issues.push('Transcripts are missing contact_id - only linked to companies');
  }

  if (ccCount === 0) {
    issues.push('No CC items have transcription_id set');
  }

  if (issues.length > 0) {
    console.log('Issues found:');
    for (const issue of issues) {
      console.log(`  ❌ ${issue}`);
    }

    console.log('\nPossible causes:');
    console.log('  1. processTranscriptAnalysis() may have been marked items created without creating them');
    console.log('  2. Transcript contact resolution not working (attendees -> contacts)');
    console.log('  3. Relationship Intelligence only works with contact_id, not company_id alone');
  } else {
    console.log('✓ No obvious gaps found');
  }
}

debug().catch(console.error);
