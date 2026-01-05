import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const requestId = 'e27a5c4d-bfa5-408b-b5db-25c69c2759ea';

  // Check the specific scheduling action
  const { data: action } = await supabase
    .from('scheduling_actions')
    .select('*')
    .eq('scheduling_request_id', requestId)
    .eq('action_type', 'webhook_processing')
    .single();

  console.log('=== Webhook Processing Action ===');
  console.log('Email ID in action:', action?.email_id);
  console.log('Message content:', action?.message_content);
  console.log('Created at:', action?.created_at);
  console.log('');

  // Check the email that was processed - need to find it by email_id
  if (action?.email_id) {
    console.log('=== Looking for email with external_id matching ===');
    const { data: comms } = await supabase
      .from('communications')
      .select('id, subject, external_id, thread_id, their_participants, occurred_at')
      .eq('direction', 'inbound')
      .gte('occurred_at', '2026-01-01T06:00:00Z')
      .order('occurred_at', { ascending: false })
      .limit(5);

    for (const comm of comms || []) {
      console.log(`Email: ${comm.subject}`);
      console.log(`  External ID: ${comm.external_id}`);
      console.log(`  Thread ID: ${comm.thread_id}`);
      console.log(`  Occurred: ${comm.occurred_at}`);
      console.log('');
    }
  }

  // Check if the thread IDs match
  console.log('=== Thread ID Comparison ===');
  const { data: request } = await supabase
    .from('scheduling_requests')
    .select('email_thread_id, title, status')
    .eq('id', requestId)
    .single();

  console.log('Request title:', request?.title);
  console.log('Request status:', request?.status);
  console.log('Request email_thread_id (Microsoft conversationId):', request?.email_thread_id);
  console.log('');

  // The issue: communications.thread_id is NOT the same as Microsoft conversationId!
  // Let's check what findMatchingSchedulingRequest would return
  console.log('=== The Problem ===');
  console.log('The communications table uses a different thread_id format (UUID)');
  console.log('than Microsoft Graph conversationId. This is why thread matching fails.');
  console.log('');
  console.log('However, the webhook fetches emails directly from Microsoft Graph,');
  console.log('so it should have the correct conversationId. Let me check the webhook code...');
}

check().catch(console.error);
