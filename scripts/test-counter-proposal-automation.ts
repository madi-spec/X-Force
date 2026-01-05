import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// Import the functions we want to test
import {
  findMatchingSchedulingRequest,
  processSchedulingResponse,
  type IncomingEmail,
} from '../src/lib/scheduler/responseProcessor';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

const userId = '11111111-1111-1111-1111-111111111009';
const requestId = 'fd360b3e-b42a-4d52-b612-94b6e8b0e294';

async function testCounterProposalAutomation() {
  console.log('=== Testing Counter-Proposal Automation ===\n');

  // Step 1: Create a test scheduling request (or reset existing one)
  console.log('Step 1: Setting up test scheduling request...');

  // Reset the scheduling request to awaiting_response for testing
  await supabase
    .from('scheduling_requests')
    .update({
      status: 'awaiting_response',
      selected_time: null,
      calendar_event_id: null,
      meeting_link: null,
      next_action_type: null,
      next_action_at: null,
    })
    .eq('id', requestId);

  console.log('Reset request to awaiting_response');

  // Step 2: Get the scheduling request
  const { data: request } = await supabase
    .from('scheduling_requests')
    .select(`
      *,
      attendees:scheduling_attendees(*)
    `)
    .eq('id', requestId)
    .single();

  if (!request) {
    console.log('Request not found');
    return;
  }

  console.log(`Request: ${request.title}`);
  console.log(`Status: ${request.status}`);

  // Step 3: Create a simulated incoming email with a counter-proposal
  console.log('\nStep 2: Creating simulated counter-proposal email...');

  const simulatedEmail: IncomingEmail = {
    id: 'test-email-' + Date.now(),
    subject: 'Re: Discovery Call - Lawn Doctor of Warren',
    body: `Hi Brent,

Thanks for reaching out! I am looking forward to learning more about your AI Agents.

Can you meet at 11am on Monday the 6th instead? That works better for my schedule.

Looking forward to it!
Joe`,
    bodyPreview: 'Thanks for reaching out! I am looking forward to learning more...',
    from: {
      address: 'madi@theangryocto.com',
      name: 'Joe',
    },
    receivedDateTime: new Date().toISOString(),
    conversationId: 'test-conversation',
  };

  console.log('Email from:', simulatedEmail.from.address);
  console.log('Body preview:', simulatedEmail.bodyPreview);

  // Step 4: Find matching scheduling request
  console.log('\nStep 3: Finding matching scheduling request...');

  const matchingRequest = await findMatchingSchedulingRequest(simulatedEmail);

  if (!matchingRequest) {
    console.log('No matching request found');
    return;
  }

  console.log(`Found matching request: ${matchingRequest.title}`);

  // Step 5: Process the response (this will trigger the automation)
  console.log('\nStep 4: Processing counter-proposal (automation should kick in)...');
  console.log('-----------------------------------------------------------');

  const result = await processSchedulingResponse(simulatedEmail, matchingRequest);

  console.log('-----------------------------------------------------------');
  console.log('\nProcessing result:');
  console.log('Processed:', result.processed);
  console.log('Action:', result.action);
  console.log('New Status:', result.newStatus);
  if (result.error) {
    console.log('Error:', result.error);
  }

  // Step 6: Check the final state
  console.log('\nStep 5: Checking final state...');

  const { data: finalRequest } = await supabase
    .from('scheduling_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (finalRequest) {
    console.log('\nFinal scheduling request state:');
    console.log('Status:', finalRequest.status);
    console.log('Selected time:', finalRequest.selected_time);
    console.log('Calendar event ID:', finalRequest.calendar_event_id);
    console.log('Meeting link:', finalRequest.meeting_link);
    console.log('Next action type:', finalRequest.next_action_type);
  }

  console.log('\n=== Test Complete ===');

  if (result.action === 'counter_proposal_auto_accepted') {
    console.log('✅ SUCCESS: Counter-proposal was automatically accepted and meeting booked!');
  } else if (result.action === 'counter_proposal_auto_declined_with_alternatives') {
    console.log('✅ SUCCESS: Counter-proposal was declined and alternatives were sent!');
  } else if (result.action === 'counter_proposal_needs_review') {
    console.log('⚠️  FALLBACK: Counter-proposal needs human review');
    console.log('    Reason: Automation could not complete automatically');
  } else {
    console.log('❓ Unknown result:', result.action);
  }
}

testCounterProposalAutomation().catch(console.error);
