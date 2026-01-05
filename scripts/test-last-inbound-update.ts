/**
 * Test script to verify last_inbound_message_id update works correctly
 *
 * Run with: npx tsx scripts/test-last-inbound-update.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testUpdate() {
  const requestId = '9b3b5ff7-3cfb-4599-99e3-9a2dd94bf8f5';
  const testMessageId = 'TEST_MESSAGE_ID_' + Date.now();

  console.log('=== Testing last_inbound_message_id update ===');
  console.log('Request ID:', requestId);
  console.log('Test Message ID:', testMessageId);

  // Step 1: Read current state
  console.log('\n--- Step 1: Current state ---');
  const { data: before, error: readError } = await supabase
    .from('scheduling_requests')
    .select('id, last_inbound_message_id, conversation_history')
    .eq('id', requestId)
    .single();

  if (readError) {
    console.error('Read error:', readError);
    return;
  }

  console.log('Before update:');
  console.log('  last_inbound_message_id:', before.last_inbound_message_id);
  console.log('  conversation_history length:', before.conversation_history?.length || 0);

  // Step 2: Do the update (similar to responseProcessor.ts line 769-788)
  console.log('\n--- Step 2: Executing update ---');

  const conversationHistory = [
    ...(before.conversation_history || []),
    {
      id: testMessageId,
      timestamp: new Date().toISOString(),
      direction: 'inbound',
      channel: 'email',
      subject: 'TEST EMAIL',
      body: 'Test body',
      sender: 'test@example.com',
      recipient: 'us',
    }
  ];

  console.log('Setting:');
  console.log('  conversation_history length:', conversationHistory.length);
  console.log('  last_inbound_message_id:', testMessageId);

  const { error: updateError, data: updateData } = await supabase
    .from('scheduling_requests')
    .update({
      conversation_history: conversationHistory,
      last_inbound_message_id: testMessageId,
      last_action_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('id, last_inbound_message_id');

  if (updateError) {
    console.error('UPDATE ERROR:', updateError);
    return;
  }

  console.log('Update response:', updateData);

  // Step 3: Read state after update
  console.log('\n--- Step 3: State after update ---');
  const { data: after, error: afterError } = await supabase
    .from('scheduling_requests')
    .select('id, last_inbound_message_id, conversation_history')
    .eq('id', requestId)
    .single();

  if (afterError) {
    console.error('Read error:', afterError);
    return;
  }

  console.log('After update:');
  console.log('  last_inbound_message_id:', after.last_inbound_message_id);
  console.log('  conversation_history length:', after.conversation_history?.length || 0);
  console.log('  last message id:', after.conversation_history?.[after.conversation_history.length - 1]?.id);

  // Step 4: Verify
  console.log('\n--- Verification ---');
  if (after.last_inbound_message_id === testMessageId) {
    console.log('✓ SUCCESS: last_inbound_message_id was correctly updated!');
  } else {
    console.log('✗ FAILURE: last_inbound_message_id is:', after.last_inbound_message_id);
    console.log('  Expected:', testMessageId);
  }

  // Step 5: Revert the test changes
  console.log('\n--- Reverting test changes ---');
  await supabase
    .from('scheduling_requests')
    .update({
      conversation_history: before.conversation_history,
      last_inbound_message_id: before.last_inbound_message_id,
    })
    .eq('id', requestId);
  console.log('Reverted to original state');
}

testUpdate().catch(console.error);
