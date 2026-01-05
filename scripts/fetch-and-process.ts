import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { getValidToken } from '../src/lib/microsoft/auth';
import { processSchedulingResponse, findMatchingSchedulingRequest, type IncomingEmail } from '../src/lib/scheduler/responseProcessor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_ID = '11111111-1111-1111-1111-111111111009';

async function run() {
  console.log('Fetching recent emails from Microsoft...');

  const token = await getValidToken(USER_ID);
  if (!token) {
    console.error('No valid token');
    return;
  }

  // Fetch recent inbox messages
  const response = await fetch(
    'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=10&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,body,from,receivedDateTime,conversationId',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await response.json();
  const messages = data.value || [];

  console.log(`Found ${messages.length} recent emails:\n`);

  for (const msg of messages) {
    const fromEmail = msg.from?.emailAddress?.address || 'unknown';
    const preview = msg.bodyPreview || '';

    console.log(`From: ${fromEmail}`);
    console.log(`Subject: ${msg.subject}`);
    console.log(`Preview: ${preview.substring(0, 100)}...`);
    console.log('---');

    // Check if this matches a scheduling request
    const email: IncomingEmail = {
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

    const matchingRequest = await findMatchingSchedulingRequest(email);

    if (matchingRequest) {
      console.log('*** MATCHES scheduling request:', matchingRequest.id, matchingRequest.title);
      console.log('Processing response...');

      const result = await processSchedulingResponse(email, matchingRequest);
      console.log('Result:', result);
    }
    console.log('\n');
  }
}

run().catch(console.error);
