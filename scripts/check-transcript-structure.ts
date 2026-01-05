import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get a sample transcript with analysis
  const { data: transcript, error } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, analysis')
    .not('analysis', 'is', null)
    .limit(1)
    .single();

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  if (!transcript) {
    console.log('No transcripts with analysis found');
    return;
  }

  console.log('=== TRANSCRIPT ANALYSIS STRUCTURE ===\n');
  console.log('Title:', transcript.title);
  console.log('\nAnalysis keys:', Object.keys(transcript.analysis || {}));

  const analysis = transcript.analysis as any;

  console.log('\n--- Action Items ---');
  const actionItemsKey = analysis.actionItems ? 'actionItems' : analysis.action_items ? 'action_items' : 'MISSING';
  console.log('Field name:', actionItemsKey);
  const actionItems = analysis.actionItems || analysis.action_items || [];
  console.log('Count:', actionItems.length);
  if (actionItems.length > 0) {
    console.log('Sample:', JSON.stringify(actionItems[0], null, 2));
  }

  console.log('\n--- Buying Signals ---');
  const buyingSignalsKey = analysis.buyingSignals ? 'buyingSignals' : analysis.buying_signals ? 'buying_signals' : 'MISSING';
  console.log('Field name:', buyingSignalsKey);
  const buyingSignals = analysis.buyingSignals || analysis.buying_signals || [];
  console.log('Count:', buyingSignals.length);
  if (buyingSignals.length > 0) {
    console.log('Sample:', JSON.stringify(buyingSignals[0], null, 2));
  }

  console.log('\n--- Objections/Concerns ---');
  const objectionsKey = analysis.objections ? 'objections' : analysis.concerns ? 'concerns' : 'MISSING';
  console.log('Field name:', objectionsKey);
  const objections = analysis.objections || analysis.concerns || [];
  console.log('Count:', objections.length);
  if (objections.length > 0) {
    console.log('Sample:', JSON.stringify(objections[0], null, 2));
  }

  console.log('\n--- Our Commitments (separate field) ---');
  console.log('Field name:', analysis.ourCommitments ? 'ourCommitments' : 'MISSING');
  const ourCommitments = analysis.ourCommitments || [];
  console.log('Count:', ourCommitments.length);
  if (ourCommitments.length > 0) {
    console.log('Sample:', JSON.stringify(ourCommitments[0], null, 2));
  }

  console.log('\n--- Extracted Info ---');
  console.log('Field name:', analysis.extractedInfo ? 'extractedInfo' : 'MISSING');
  if (analysis.extractedInfo) {
    console.log('Keys:', Object.keys(analysis.extractedInfo));
  }
}

main().catch(console.error);
