import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function processDeferred() {
  const requestId = 'e27a5c4d-bfa5-408b-b5db-25c69c2759ea';

  console.log('=== Processing Deferred Response ===\n');

  // Get the request
  const { data: request } = await supabase
    .from('scheduling_requests')
    .select('*, attendees:scheduling_attendees(*)')
    .eq('id', requestId)
    .single();

  if (!request) {
    console.log('Request not found');
    return;
  }

  console.log('Request:', request.title);
  console.log('Status:', request.status);
  console.log('Next action:', request.next_action_type);
  console.log('');

  // Get the most recent inbound email for this thread
  const { data: emails } = await supabase
    .from('communications')
    .select('*')
    .eq('direction', 'inbound')
    .eq('channel', 'email')
    .gte('occurred_at', '2026-01-01T06:00:00Z')
    .order('occurred_at', { ascending: false })
    .limit(5);

  // Find the email that matches (by subject for now)
  const matchingEmail = emails?.find(e =>
    e.subject?.toLowerCase().includes('quick chat') ||
    e.subject?.toLowerCase().includes('call center')
  );

  if (!matchingEmail) {
    console.log('No matching inbound email found');
    return;
  }

  console.log('Found email:', matchingEmail.subject);
  console.log('From:', matchingEmail.their_participants);
  console.log('Content preview:', matchingEmail.content_preview?.substring(0, 200));
  console.log('');

  // Import and call processSchedulingResponse
  const { processSchedulingResponse } = await import('../src/lib/scheduler/responseProcessor');

  const email = {
    id: matchingEmail.external_id || matchingEmail.id,
    subject: matchingEmail.subject || '',
    body: matchingEmail.full_content || matchingEmail.content_preview || '',
    bodyPreview: matchingEmail.content_preview || '',
    from: {
      address: (matchingEmail.their_participants as any)?.[0]?.email || '',
      name: (matchingEmail.their_participants as any)?.[0]?.name || '',
    },
    receivedDateTime: matchingEmail.occurred_at,
    conversationId: matchingEmail.thread_id,
  };

  console.log('Calling processSchedulingResponse...');
  console.log('Email ID:', email.id);
  console.log('From:', email.from.address);
  console.log('');

  const result = await processSchedulingResponse(email, request);

  console.log('=== Result ===');
  console.log(JSON.stringify(result, null, 2));
}

processDeferred().catch(console.error);
