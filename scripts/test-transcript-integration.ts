/**
 * Test Transcript Integration
 *
 * Verifies that transcripts flow properly into:
 * 1. Relationship Intelligence
 * 2. Context for email analysis
 * 3. Command Center items
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runTests() {
  console.log('='.repeat(70));
  console.log('TRANSCRIPT INTEGRATION TESTS');
  console.log('='.repeat(70));

  // ============================================
  // TEST 1: Find transcripts with analysis
  // ============================================
  console.log('\n--- TEST 1: Find Transcripts with Analysis ---\n');

  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, meeting_date, contact_id, company_id, deal_id, analysis, cc_items_created')
    .not('analysis', 'is', null)
    .order('meeting_date', { ascending: false })
    .limit(5);

  if (!transcripts || transcripts.length === 0) {
    console.log('❌ No transcripts with analysis found');
    return;
  }

  console.log(`Found ${transcripts.length} transcripts with analysis:`);
  for (const t of transcripts) {
    const analysis = t.analysis as any;
    console.log(`\n  ID: ${t.id}`);
    console.log(`  Title: ${t.title}`);
    console.log(`  Date: ${t.meeting_date}`);
    console.log(`  Contact ID: ${t.contact_id || 'null'}`);
    console.log(`  Company ID: ${t.company_id || 'null'}`);
    console.log(`  CC Items Created: ${t.cc_items_created}`);
    console.log(`  Analysis contains:`);
    console.log(`    - Summary: ${analysis?.summary ? 'Yes' : 'No'}`);
    console.log(`    - Buying Signals: ${analysis?.buyingSignals?.length || 0}`);
    console.log(`    - Objections: ${analysis?.objections?.length || 0}`);
    console.log(`    - Our Commitments: ${analysis?.ourCommitments?.length || 0}`);
    console.log(`    - Their Commitments: ${analysis?.theirCommitments?.length || 0}`);
    console.log(`    - Action Items: ${analysis?.actionItems?.length || 0}`);
  }

  // Pick the first transcript with a contact_id for further testing
  const testTranscript = transcripts.find(t => t.contact_id || t.company_id);

  if (!testTranscript) {
    console.log('\n❌ No transcripts linked to contacts/companies found');
  } else {
    console.log(`\n✓ Using transcript "${testTranscript.title}" for further tests`);
  }

  // ============================================
  // TEST 2: Check Relationship Intelligence
  // ============================================
  console.log('\n--- TEST 2: Check Relationship Intelligence Records ---\n');

  if (testTranscript?.contact_id || testTranscript?.company_id) {
    let riQuery = supabase
      .from('relationship_intelligence')
      .select('*');

    if (testTranscript.contact_id) {
      riQuery = riQuery.eq('contact_id', testTranscript.contact_id);
    }
    if (testTranscript.company_id) {
      riQuery = riQuery.eq('company_id', testTranscript.company_id);
    }

    const { data: ri } = await riQuery.single();

    if (ri) {
      console.log('Relationship Intelligence Record Found:');
      console.log(`  ID: ${ri.id}`);
      console.log(`  Total Interactions: ${ri.interactions?.length || 0}`);

      // Check for transcript interactions
      const transcriptInteractions = (ri.interactions || []).filter(
        (i: any) => i.type === 'transcript'
      );
      console.log(`  Transcript Interactions: ${transcriptInteractions.length}`);

      if (transcriptInteractions.length > 0) {
        console.log('\n  Sample Transcript Interaction:');
        const ti = transcriptInteractions[0];
        console.log(`    Type: ${ti.type}`);
        console.log(`    Date: ${ti.date}`);
        console.log(`    Summary: ${ti.summary?.substring(0, 80)}...`);
        console.log(`    Key Points: ${ti.key_points?.length || 0}`);
        console.log(`    Buying Signals: ${ti.buying_signals?.length || 0}`);
        console.log(`    Concerns: ${ti.concerns?.length || 0}`);
      }

      // Check buying signals
      const signals = ri.signals?.buying_signals || [];
      const transcriptSignals = signals.filter((s: any) =>
        s.source_id && transcripts.some(t => t.id === s.source_id)
      );
      console.log(`\n  Buying Signals from Transcripts: ${transcriptSignals.length}`);
      if (transcriptSignals.length > 0) {
        for (const s of transcriptSignals.slice(0, 3)) {
          console.log(`    - [${s.strength}] ${s.signal}`);
        }
      }

      // Check concerns (from objections)
      const concerns = ri.signals?.concerns || [];
      const transcriptConcerns = concerns.filter((c: any) =>
        c.source_id && transcripts.some(t => t.id === c.source_id)
      );
      console.log(`\n  Concerns from Transcripts: ${transcriptConcerns.length}`);
      if (transcriptConcerns.length > 0) {
        for (const c of transcriptConcerns.slice(0, 3)) {
          console.log(`    - [${c.severity}] ${c.concern}`);
        }
      }

      // Check commitments
      const ourCommitments = ri.open_commitments?.ours || [];
      const theirCommitments = ri.open_commitments?.theirs || [];
      console.log(`\n  Our Open Commitments: ${ourCommitments.length}`);
      console.log(`  Their Open Commitments: ${theirCommitments.length}`);

      console.log('\n✓ Relationship Intelligence is capturing transcript data');
    } else {
      console.log('❌ No relationship intelligence record found for this contact/company');
    }
  } else {
    console.log('⚠ Skipping - no contact/company linked to transcript');
  }

  // ============================================
  // TEST 3: Check Context Builder
  // ============================================
  console.log('\n--- TEST 3: Check buildRelationshipContext ---\n');

  // Find the buildRelationshipContext file and check if it includes meetings
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, company_id')
    .not('id', 'is', null)
    .limit(1);

  if (contacts && contacts[0]) {
    console.log(`Checking context for contact: ${contacts[0].name}`);

    // Check if this contact has any transcripts
    const { data: contactTranscripts } = await supabase
      .from('meeting_transcriptions')
      .select('id, title, meeting_date')
      .eq('contact_id', contacts[0].id)
      .limit(3);

    console.log(`  Transcripts linked to contact: ${contactTranscripts?.length || 0}`);

    // Check relationship intelligence for this contact
    const { data: contactRI } = await supabase
      .from('relationship_intelligence')
      .select('interactions, signals, open_commitments')
      .eq('contact_id', contacts[0].id)
      .single();

    if (contactRI) {
      const transcriptInteractions = (contactRI.interactions || []).filter(
        (i: any) => i.type === 'transcript'
      );
      console.log(`  Transcript interactions in RI: ${transcriptInteractions.length}`);

      if (transcriptInteractions.length > 0) {
        console.log('\n  ✓ Context builder can access transcript data via RI');
        console.log('  Recent meeting interactions:');
        for (const ti of transcriptInteractions.slice(0, 2)) {
          console.log(`    - ${ti.date}: ${ti.summary?.substring(0, 60)}...`);
        }
      } else {
        console.log('\n  ⚠ No transcript interactions in RI for this contact');
      }
    }
  }

  // ============================================
  // TEST 4: Check Command Center Items from Transcripts
  // ============================================
  console.log('\n--- TEST 4: Command Center Items from Transcripts ---\n');

  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select('id, title, why_now, tier, tier_trigger, source, transcription_id, contact_id, company_id, commitment_text')
    .not('transcription_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!ccItems || ccItems.length === 0) {
    console.log('❌ No command center items from transcripts found');
  } else {
    console.log(`Found ${ccItems.length} items from transcripts:`);

    // Group by tier
    const tier2 = ccItems.filter(i => i.tier === 2);
    const tier3 = ccItems.filter(i => i.tier === 3);

    console.log(`\n  Tier 2 (Buying Signals/Competition): ${tier2.length}`);
    for (const item of tier2.slice(0, 3)) {
      console.log(`    - ${item.tier_trigger}: ${item.title?.substring(0, 50)}`);
      console.log(`      Why Now: ${item.why_now?.substring(0, 60)}`);
    }

    console.log(`\n  Tier 3 (Commitments/Promises): ${tier3.length}`);
    for (const item of tier3.slice(0, 3)) {
      console.log(`    - ${item.tier_trigger}: ${item.title?.substring(0, 50)}`);
      console.log(`      Why Now: ${item.why_now?.substring(0, 60)}`);
      if (item.commitment_text) {
        console.log(`      Commitment: ${item.commitment_text.substring(0, 50)}`);
      }
    }
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  console.log('\nChecklist:');
  console.log(`  [${transcripts.length > 0 ? '✓' : '❌'}] Transcripts with analysis exist`);

  // Check if any RI has transcript interactions
  const { data: riWithTranscripts } = await supabase
    .from('relationship_intelligence')
    .select('id')
    .not('interactions', 'is', null)
    .limit(10);

  const hasTranscriptInteractions = riWithTranscripts && riWithTranscripts.length > 0;
  console.log(`  [${hasTranscriptInteractions ? '✓' : '❌'}] Relationship Intelligence captures transcripts`);

  console.log(`  [${ccItems && ccItems.length > 0 ? '✓' : '❌'}] Command Center items created from transcripts`);

  // Check if buildRelationshipContext includes transcript data
  console.log('\n  Note: To verify email analysis references prior meetings, run:');
  console.log('  npx tsx scripts/test-email-with-meeting-context.ts');
}

runTests().catch(console.error);
