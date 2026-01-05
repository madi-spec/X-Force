/**
 * Test script for the new response processor wiring
 * Tests IntentDetector + TimeParser integration
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { processSchedulingResponse } from '../src/lib/scheduler/responseProcessor';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testResponseProcessor() {
  console.log('='.repeat(60));
  console.log('Testing Response Processor with New Module Wiring');
  console.log('='.repeat(60));

  // Get a scheduling request that has a thread with an inbound response
  const requestId = 'e27a5c4d-bfa5-408b-b5db-25c69c2759ea'; // "Test 5" with thread
  const threadId = '1377d774-827a-4927-82d3-cfa2d783816b';

  // Get the scheduling request
  const { data: request, error: reqError } = await supabase
    .from('scheduling_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (reqError || !request) {
    console.error('Failed to get scheduling request:', reqError);
    return;
  }

  console.log('\n📋 Scheduling Request:');
  console.log('  ID:', request.id);
  console.log('  Title:', request.title);
  console.log('  Status:', request.status);
  console.log('  Thread ID:', request.email_thread_id);
  console.log('  Proposed Times:', JSON.stringify(request.proposed_times, null, 2));

  // Get the inbound email from communications
  const { data: emails, error: emailError } = await supabase
    .from('communications')
    .select('*')
    .eq('thread_id', threadId)
    .eq('direction', 'inbound')
    .order('occurred_at', { ascending: false })
    .limit(1);

  if (emailError || !emails || emails.length === 0) {
    console.error('Failed to get inbound email:', emailError);
    return;
  }

  const email = emails[0];
  console.log('\n📧 Inbound Email:');
  console.log('  From:', email.their_participants?.[0]?.email);
  console.log('  Subject:', email.subject);
  console.log('  Body Preview:', email.full_content?.slice(0, 200));
  console.log('  Received:', email.occurred_at);

  // Build the email object for processSchedulingResponse
  const incomingEmail = {
    id: email.external_id || email.id,
    subject: email.subject || '',
    body: email.full_content || '',
    bodyPreview: email.content_preview || '',
    from: {
      address: email.their_participants?.[0]?.email || '',
      name: email.their_participants?.[0]?.name || '',
    },
    receivedDateTime: email.occurred_at,
    conversationId: email.thread_id,
  };

  console.log('\n🔄 Calling processSchedulingResponse...');
  console.log('-'.repeat(60));

  try {
    const result = await processSchedulingResponse(
      incomingEmail,
      request,
      request.created_by
    );

    console.log('\n✅ Result:');
    console.log(JSON.stringify(result, null, 2));

    // Check updated request status
    const { data: updatedRequest } = await supabase
      .from('scheduling_requests')
      .select('status, next_action_type, next_action_at')
      .eq('id', requestId)
      .single();

    console.log('\n📊 Updated Request State:');
    console.log('  Status:', updatedRequest?.status);
    console.log('  Next Action:', updatedRequest?.next_action_type);
    console.log('  Next Action At:', updatedRequest?.next_action_at);

  } catch (err) {
    console.error('\n❌ Error:', err);
  }
}

testResponseProcessor()
  .then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('Test Complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
