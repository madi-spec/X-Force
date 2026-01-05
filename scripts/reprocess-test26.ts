import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { getValidToken } from '../src/lib/microsoft/auth';
import { processSchedulingResponse } from '../src/lib/scheduler/responseProcessor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Test 26 request and email
const REQUEST_ID = '011ceb76-892d-4f97-8b66-31bdc0acadb0';
const EMAIL_ID = 'AAkALgAAAAAAHYQDEapmEc2byACqAC-EWg0AxuH1gs2LMUeqAq2IgI8oqgAAHDh4uAAA';
const USER_ID = '11111111-1111-1111-1111-111111111009';

async function main() {
  console.log('Reprocessing Test 26 email with fixed code...\n');

  // Get the scheduling request
  const { data: request, error: reqError } = await supabase
    .from('scheduling_requests')
    .select('*')
    .eq('id', REQUEST_ID)
    .single();

  if (reqError || !request) {
    console.error('Failed to get scheduling request:', reqError);
    return;
  }

  console.log('📋 Request:', request.title);
  console.log('   Status:', request.status);
  console.log('   Proposed times:', request.proposed_times?.join(', '));

  // Get the email from Graph API
  const token = await getValidToken(USER_ID);
  if (!token) {
    console.error('Failed to get token');
    return;
  }

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${EMAIL_ID}?$select=id,subject,body,bodyPreview,from,receivedDateTime,conversationId`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Prefer': 'IdType="ImmutableId"',
      },
    }
  );

  if (!response.ok) {
    console.error('Graph API error:', response.status, await response.text());
    return;
  }

  const msg = await response.json();

  console.log('\n📧 Email:', msg.subject);
  console.log('   From:', msg.from?.emailAddress?.address);

  // Build email object for processor
  const incomingEmail = {
    id: msg.id,
    subject: msg.subject || '',
    body: msg.body?.content || '',
    bodyPreview: msg.bodyPreview || '',
    from: {
      address: msg.from?.emailAddress?.address || '',
      name: msg.from?.emailAddress?.name || '',
    },
    receivedDateTime: msg.receivedDateTime,
    conversationId: msg.conversationId,
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
      .select('status, scheduled_time, next_action_type, calendar_event_id')
      .eq('id', REQUEST_ID)
      .single();

    console.log('\n📊 Updated Request:');
    console.log('   Status:', updatedRequest?.status);
    console.log('   Scheduled Time:', updatedRequest?.scheduled_time);
    console.log('   Calendar Event:', updatedRequest?.calendar_event_id);
    console.log('   Next Action:', updatedRequest?.next_action_type);

  } catch (err) {
    console.error('\n❌ Error:', err);
  }
}

main().catch(console.error);
