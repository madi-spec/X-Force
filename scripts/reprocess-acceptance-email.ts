/**
 * Reprocess the acceptance email that was skipped due to rate limiting
 * Run: npx tsx scripts/reprocess-acceptance-email.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { processSchedulingResponse } from '../src/lib/scheduler/responseProcessor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The acceptance email
const EMAIL_MESSAGE_ID = 'AAkALgAAAAAAHYQDEapmEc2byACqAC-EWg0AxuH1gs2LMUeqAq2IgI8oqgAAHDhwzgAA';
const REQUEST_ID = 'af24f23f-7d1f-47f6-8b4f-7f9b193a528c';

async function main() {
  console.log('=== Reprocessing Acceptance Email ===\n');

  // Get the email from email_messages
  const { data: emailMsg, error: emailError } = await supabase
    .from('email_messages')
    .select('*')
    .eq('message_id', EMAIL_MESSAGE_ID)
    .single();

  if (emailError || !emailMsg) {
    console.error('Failed to get email:', emailError);
    return;
  }

  console.log('Email:', emailMsg.subject);
  console.log('From:', emailMsg.from_email);
  console.log('Body:', emailMsg.body_text?.slice(0, 200));
  console.log('');

  // Get the scheduling request
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
  console.log('');

  // First, record the email_received action (if not already recorded)
  const { data: existingAction } = await supabase
    .from('scheduling_actions')
    .select('id')
    .eq('scheduling_request_id', REQUEST_ID)
    .eq('email_id', EMAIL_MESSAGE_ID)
    .maybeSingle();

  if (!existingAction) {
    console.log('Recording email_received action...');
    const { error: insertError } = await supabase
      .from('scheduling_actions')
      .insert({
        scheduling_request_id: REQUEST_ID,
        email_id: EMAIL_MESSAGE_ID,
        action_type: 'email_received',
        actor: 'prospect',
        message_subject: emailMsg.subject,
        message_content: emailMsg.body_preview?.slice(0, 500),
      });

    if (insertError) {
      console.error('Failed to record action:', insertError);
      return;
    }
    console.log('✓ Action recorded');
  } else {
    console.log('Action already exists:', existingAction.id);
  }

  // Clean the email body
  let cleanBody = emailMsg.body_text || emailMsg.body_preview || '';
  // Remove security banner
  cleanBody = cleanBody.replace(/CAUTION:.*?>>>>/gs, '').trim();
  // Get just the first line (the actual reply)
  const lines = cleanBody.split('\n').map(l => l.trim()).filter(l => l);
  cleanBody = lines[0] || cleanBody;

  console.log('Clean body:', cleanBody);
  console.log('');

  // Build email object for processing
  const email = {
    id: EMAIL_MESSAGE_ID,
    subject: emailMsg.subject || '',
    body: cleanBody,
    bodyPreview: emailMsg.body_preview || '',
    from: {
      address: emailMsg.from_email || '',
      name: emailMsg.from_name || '',
    },
    receivedDateTime: emailMsg.received_at,
    conversationId: emailMsg.conversation_ref,
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
