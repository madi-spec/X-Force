/**
 * Test Transcript Processing Pipeline
 *
 * Run with: npx tsx scripts/test-process-transcript.ts [transcript_id]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Types matching the pipeline
interface Commitment {
  commitment: string;
  when?: string | null;
}

interface ActionItem {
  task: string;
  owner: 'us' | 'them';
  assignee?: string | null;
  dueDate?: string | null;
  priority: 'high' | 'medium' | 'low';
}

interface BuyingSignal {
  signal: string;
  quote?: string | null;
  strength: 'strong' | 'moderate' | 'weak';
}

interface ExtractedInfo {
  budget?: string | null;
  timeline?: string | null;
  competitors?: string[];
  decisionProcess?: string | null;
}

interface TranscriptAnalysis {
  ourCommitments?: Commitment[];
  actionItems?: ActionItem[];
  buyingSignals?: BuyingSignal[];
  extractedInfo?: ExtractedInfo;
  summary?: string;
  headline?: string;
}

async function testProcessTranscript(transcriptId?: string) {
  console.log('='.repeat(70));
  console.log('TRANSCRIPT PROCESSING PIPELINE TEST');
  console.log('='.repeat(70));

  // If no ID provided, find an unprocessed transcript with analysis
  if (!transcriptId) {
    const { data: transcripts } = await supabase
      .from('meeting_transcriptions')
      .select('id, title, meeting_date, analysis, cc_items_created')
      .not('analysis', 'is', null)
      .eq('cc_items_created', false)
      .order('meeting_date', { ascending: false })
      .limit(5);

    if (!transcripts || transcripts.length === 0) {
      console.log('\n❌ No unprocessed transcripts with analysis found');
      console.log('\nLooking for any transcript with analysis...');

      const { data: anyTranscripts } = await supabase
        .from('meeting_transcriptions')
        .select('id, title, meeting_date, cc_items_created')
        .not('analysis', 'is', null)
        .order('meeting_date', { ascending: false })
        .limit(5);

      if (anyTranscripts && anyTranscripts.length > 0) {
        console.log('\nAvailable transcripts with analysis:');
        for (const t of anyTranscripts) {
          console.log(`  ${t.id}: ${t.title} (${t.meeting_date}) - CC items: ${t.cc_items_created}`);
        }
      }
      return;
    }

    console.log('\nUnprocessed transcripts found:');
    for (const t of transcripts) {
      console.log(`  ${t.id}: ${t.title} (${t.meeting_date})`);
    }

    transcriptId = transcripts[0].id;
    console.log(`\nUsing first transcript: ${transcriptId}`);
  }

  // Fetch the transcript
  const { data: transcript, error: fetchError } = await supabase
    .from('meeting_transcriptions')
    .select('*')
    .eq('id', transcriptId)
    .single();

  if (fetchError || !transcript) {
    console.error('❌ Transcript not found:', fetchError?.message);
    return;
  }

  console.log('\n📝 TRANSCRIPT:');
  console.log(`  ID: ${transcript.id}`);
  console.log(`  Title: ${transcript.title}`);
  console.log(`  Date: ${transcript.meeting_date}`);
  console.log(`  Duration: ${transcript.duration_minutes} min`);
  console.log(`  Source: ${transcript.source}`);
  console.log(`  Deal ID: ${transcript.deal_id || 'None'}`);
  console.log(`  Company ID: ${transcript.company_id || 'None'}`);
  console.log(`  CC Items Created: ${transcript.cc_items_created}`);

  if (!transcript.analysis) {
    console.log('\n❌ No analysis available for this transcript');
    return;
  }

  const analysis: TranscriptAnalysis = transcript.analysis;

  console.log('\n📊 ANALYSIS SUMMARY:');
  if (analysis.headline) {
    console.log(`  Headline: ${analysis.headline}`);
  }
  if (analysis.summary) {
    console.log(`  Summary: ${analysis.summary.substring(0, 200)}...`);
  }

  // Our Commitments -> Tier 3
  console.log('\n🤝 OUR COMMITMENTS (→ Tier 3):');
  if (analysis.ourCommitments && analysis.ourCommitments.length > 0) {
    for (const c of analysis.ourCommitments) {
      console.log(`  • ${c.commitment}`);
      if (c.when) console.log(`    When: ${c.when}`);
    }
  } else {
    console.log('  (none detected)');
  }

  // Action Items (ours) -> Tier 3
  const ourActionItems = (analysis.actionItems || []).filter(a => a.owner === 'us');
  console.log('\n📋 OUR ACTION ITEMS (→ Tier 3):');
  if (ourActionItems.length > 0) {
    for (const a of ourActionItems) {
      console.log(`  • [${a.priority}] ${a.task}`);
      if (a.dueDate) console.log(`    Due: ${a.dueDate}`);
    }
  } else {
    console.log('  (none detected)');
  }

  // Buying Signals -> Tier 2
  console.log('\n🎯 BUYING SIGNALS (→ Tier 2):');
  if (analysis.buyingSignals && analysis.buyingSignals.length > 0) {
    for (const s of analysis.buyingSignals) {
      console.log(`  • [${s.strength}] ${s.signal}`);
      if (s.quote) console.log(`    Quote: "${s.quote}"`);
    }
  } else {
    console.log('  (none detected)');
  }

  // Extracted Info -> Tier 2
  const info = analysis.extractedInfo;
  console.log('\n📊 EXTRACTED INFO (→ Tier 2 if urgent):');
  if (info) {
    if (info.budget) console.log(`  Budget: ${info.budget}`);
    if (info.timeline) console.log(`  Timeline: ${info.timeline}`);
    if (info.competitors && info.competitors.length > 0) {
      console.log(`  Competitors: ${info.competitors.join(', ')}`);
    }
    if (info.decisionProcess) console.log(`  Decision Process: ${info.decisionProcess}`);
  } else {
    console.log('  (none extracted)');
  }

  // Check for existing CC items
  const { data: existingItems } = await supabase
    .from('command_center_items')
    .select('id, title, tier, tier_trigger, why_now')
    .eq('transcription_id', transcriptId)
    .eq('status', 'pending');

  if (existingItems && existingItems.length > 0) {
    console.log('\n⚠️ EXISTING CC ITEMS:');
    for (const item of existingItems) {
      console.log(`  Tier ${item.tier}: ${item.title}`);
      console.log(`    Trigger: ${item.tier_trigger}`);
      console.log(`    Why Now: ${item.why_now}`);
    }
  }

  // Process the transcript
  if (!transcript.cc_items_created) {
    console.log('\n' + '='.repeat(70));
    console.log('💾 PROCESSING TRANSCRIPT FOR COMMAND CENTER...');

    // Import and run the processor
    const { processSingleTranscript } = await import('../src/lib/pipelines/processTranscriptAnalysis');
    const result = await processSingleTranscript(transcriptId);

    console.log('\n📊 RESULT:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Items Created: ${result.itemsCreated}`);
    console.log(`  Tier 2 Items: ${result.tier2Items}`);
    console.log(`  Tier 3 Items: ${result.tier3Items}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }

    // Show created items
    if (result.itemsCreated > 0) {
      const { data: newItems } = await supabase
        .from('command_center_items')
        .select('id, title, tier, tier_trigger, why_now, due_at')
        .eq('transcription_id', transcriptId)
        .order('tier', { ascending: true });

      if (newItems) {
        console.log('\n✅ CREATED ITEMS:');
        for (const item of newItems) {
          console.log(`  Tier ${item.tier}: ${item.title}`);
          console.log(`    Trigger: ${item.tier_trigger}`);
          console.log(`    Why Now: ${item.why_now}`);
          if (item.due_at) console.log(`    Due: ${item.due_at}`);
        }
      }
    }
  } else {
    console.log('\n⏭️ Transcript already processed for CC items');
  }

  console.log('\n' + '='.repeat(70));
  console.log('Done!');
}

const transcriptId = process.argv[2];
testProcessTranscript(transcriptId).catch(console.error);
