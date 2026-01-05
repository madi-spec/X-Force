/**
 * Manually trigger processing of a deferred scheduling response
 * Run: npx tsx scripts/trigger-process-response.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { processSchedulingResponse } from '../src/lib/scheduler/responseProcessor';
import { getValidToken } from '../src/lib/microsoft/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REQUEST_ID = '9af57714-0926-4a04-b152-f1084a4824f9';

async function main() {
  console.log('=== Manual Scheduler Response Processing ===\n');

  // Get the request
  const { data: request, error: reqError } = await supabase
    .from('scheduling_requests')
    .select('*, attendees:scheduling_attendees(*)')
    .eq('id', REQUEST_ID)
    .single();

  if (reqError || !request) {
    console.error('Failed to get request:', reqError);
    return;
  }

  console.log('Request:', request.title);
  console.log('Status:', request.status);
  console.log('Thread ID:', request.email_thread_id);
  console.log('');

  // Clear the next_action to prevent re-processing
  await supabase
    .from('scheduling_requests')
    .update({
      next_action_type: null,
      next_action_at: null,
    })
    .eq('id', REQUEST_ID);

  // Get token and fetch the email
  const token = await getValidToken(request.created_by);
  if (!token) {
    console.error('Failed to get token');
    return;
  }

  // Get the email ID from the scheduling_actions
  const { data: action } = await supabase
    .from('scheduling_actions')
    .select('email_id')
    .eq('scheduling_request_id', REQUEST_ID)
    .eq('action_type', 'email_received')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!action?.email_id) {
    console.error('No email_id found in actions');
    return;
  }

  console.log('Email ID:', action.email_id);
  console.log('Fetching email from Graph API...');

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${action.email_id}?$select=id,subject,bodyPreview,body,from,receivedDateTime,conversationId`,
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

  if (!msg) {
    console.error('No email found in thread');
    return;
  }

  console.log('Found email:', msg.subject);
  console.log('From:', msg.from?.emailAddress?.address);
  console.log('Body preview:', msg.bodyPreview?.slice(0, 100));
  console.log('');

  // Build email object
  const email = {
    id: msg.id,
    subject: msg.subject || '',
    body: msg.body?.content || msg.bodyPreview || '',
    bodyPreview: msg.bodyPreview || '',
    from: {
      address: msg.from?.emailAddress?.address || '',
      name: msg.from?.emailAddress?.name || '',
    },
    receivedDateTime: msg.receivedDateTime,
    conversationId: msg.conversationId,
  };

  console.log('Processing response...');
  const result = await processSchedulingResponse(email, request);

  console.log('\n=== Result ===');
  console.log('Processed:', result.processed);
  console.log('Action:', result.action);
  console.log('New Status:', result.newStatus);
  if (result.error) {
    console.log('Error:', result.error);
  }
  if (result.draftId) {
    console.log('Draft ID:', result.draftId);
  }
}

main().catch(console.error);
