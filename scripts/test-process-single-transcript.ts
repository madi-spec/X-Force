/**
 * Test processing a single transcript with debug logging
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TranscriptAnalysis {
  summary?: string;
  ourCommitments?: Array<{ commitment: string; when?: string | null }>;
  actionItems?: Array<{ task: string; owner: 'us' | 'them'; dueDate?: string | null; priority: string }>;
  buyingSignals?: Array<{ signal: string; quote?: string | null; strength: 'strong' | 'moderate' | 'weak' }>;
  extractedInfo?: { competitors?: string[]; budget?: string | null; timeline?: string | null };
}

async function main() {
  console.log('=== TEST PROCESS SINGLE TRANSCRIPT ===\n');

  // Find an unprocessed transcript with analysis
  const { data: transcript, error: fetchError } = await supabase
    .from('meeting_transcriptions')
    .select('id, user_id, title, meeting_date, deal_id, company_id, contact_id, analysis')
    .eq('cc_items_created', false)
    .not('analysis', 'is', null)
    .order('meeting_date', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !transcript) {
    console.log('No unprocessed transcript found:', fetchError?.message);
    return;
  }

  console.log('Processing transcript:', transcript.title);
  console.log('  ID:', transcript.id);
  console.log('  User ID:', transcript.user_id);
  console.log('  Deal ID:', transcript.deal_id || 'null');
  console.log('  Company ID:', transcript.company_id || 'null');
  console.log('  Contact ID:', transcript.contact_id || 'null');

  const analysis = transcript.analysis as TranscriptAnalysis;

  console.log('\nAnalysis contents:');
  console.log('  Buying signals:', analysis.buyingSignals?.length || 0);
  console.log('  Our commitments:', analysis.ourCommitments?.length || 0);
  console.log('  Action items (us):', (analysis.actionItems || []).filter(a => a.owner === 'us').length);

  // Try to create a test CC item
  console.log('\n--- Attempting to create a test CC item ---\n');

  const testItem = {
    user_id: transcript.user_id,
    transcription_id: transcript.id,
    deal_id: transcript.deal_id,
    company_id: transcript.company_id,
    contact_id: transcript.contact_id,
    action_type: 'task_complex',
    title: 'TEST: ' + (analysis.ourCommitments?.[0]?.commitment || 'Test commitment').substring(0, 60),
    description: 'Test item from transcript processing',
    why_now: 'Testing transcript integration',
    tier: 3,
    tier_trigger: 'promise_made',
    status: 'pending',
    source: 'calendar_sync',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log('Inserting item:', JSON.stringify(testItem, null, 2));

  const { data: insertedItem, error: insertError } = await supabase
    .from('command_center_items')
    .insert(testItem)
    .select()
    .single();

  if (insertError) {
    console.log('\n❌ INSERT ERROR:', insertError.message);
    console.log('Error details:', insertError);
  } else {
    console.log('\n✓ Item created successfully!');
    console.log('Item ID:', insertedItem?.id);

    // Clean up the test item
    await supabase
      .from('command_center_items')
      .delete()
      .eq('id', insertedItem?.id);
    console.log('(Test item cleaned up)');
  }

  // Now let's try the actual buying signal path
  console.log('\n--- Testing buying signal creation ---\n');

  if (analysis.buyingSignals && analysis.buyingSignals.length > 0) {
    const signal = analysis.buyingSignals[0];
    console.log('Signal:', signal.signal);
    console.log('Strength:', signal.strength);

    const signalItem = {
      user_id: transcript.user_id,
      transcription_id: transcript.id,
      deal_id: transcript.deal_id,
      company_id: transcript.company_id,
      contact_id: transcript.contact_id,
      action_type: 'task_complex',
      title: `Follow up on: ${signal.signal.substring(0, 50)}`,
      description: signal.quote || signal.signal,
      why_now: `Strong buying signal: "${signal.signal}"`,
      tier: 2,
      tier_trigger: 'buying_signal',
      urgency_score: signal.strength === 'strong' ? 80 : 60,
      status: 'pending',
      source: 'calendar_sync',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: signalInserted, error: signalError } = await supabase
      .from('command_center_items')
      .insert(signalItem)
      .select()
      .single();

    if (signalError) {
      console.log('\n❌ SIGNAL INSERT ERROR:', signalError.message);
      console.log('Error details:', signalError);
    } else {
      console.log('\n✓ Signal item created!');
      console.log('Item ID:', signalInserted?.id);

      // Clean up
      await supabase
        .from('command_center_items')
        .delete()
        .eq('id', signalInserted?.id);
      console.log('(Test item cleaned up)');
    }
  }
}

main().catch(console.error);
