import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import {
  findMatchingSchedulingRequest,
  processSchedulingResponse,
  type IncomingEmail,
} from '../src/lib/scheduler/responseProcessor';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

const userId = '11111111-1111-1111-1111-111111111009';

async function processResponse() {
  console.log('Fetching the response email from Microsoft...');

  // Get the Microsoft connection
  const { data: conn } = await supabase
    .from('microsoft_connections')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  if (!conn) {
    console.log('No Microsoft connection');
    process.exit(1);
  }

  // Fetch recent emails
  const response = await fetch(
    'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=20&$orderby=receivedDateTime%20desc&$select=id,subject,from,receivedDateTime,body,bodyPreview,conversationId',
    {
      headers: {
        Authorization: 'Bearer ' + conn.access_token,
      },
    }
  );

  if (!response.ok) {
    console.log('Error fetching emails:', await response.text());
    process.exit(1);
  }

  const data = await response.json();

  // Find email from theangryocto.com
  const email = data.value.find(
    (e: { from?: { emailAddress?: { address?: string } } }) =>
      e.from?.emailAddress?.address?.toLowerCase().includes('theangryocto')
  );

  if (!email) {
    console.log('No email found from theangryocto.com');
    process.exit(1);
  }

  console.log('\nEmail found:');
  console.log('Subject:', email.subject);
  console.log('From:', email.from.emailAddress.address);
  console.log('Received:', email.receivedDateTime);
  console.log('ConversationId:', email.conversationId);

  // Extract text from HTML body
  let bodyText = email.body?.content || email.bodyPreview;
  if (email.body?.contentType === 'html') {
    bodyText = bodyText
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  console.log('\nExtracted body (first 200 chars):', bodyText.substring(0, 200));

  // Create IncomingEmail object
  const incomingEmail: IncomingEmail = {
    id: email.id,
    subject: email.subject,
    body: bodyText,
    bodyPreview: email.bodyPreview,
    from: {
      address: email.from.emailAddress.address,
      name: email.from.emailAddress.name,
    },
    receivedDateTime: email.receivedDateTime,
    conversationId: email.conversationId,
  };

  console.log('\n--- Finding matching scheduling request ---');

  // Find matching scheduling request
  const matchingRequest = await findMatchingSchedulingRequest(incomingEmail);

  if (!matchingRequest) {
    console.log('No matching scheduling request found');
    console.log('\nChecking active scheduling requests...');

    // Get all active scheduling requests to debug
    const { data: activeRequests } = await supabase
      .from('scheduling_requests')
      .select(`
        id,
        title,
        status,
        email_thread_id,
        attendees:scheduling_attendees(email, name, side)
      `)
      .not('status', 'in', '(completed,cancelled)');

    if (activeRequests && activeRequests.length > 0) {
      console.log('\nActive scheduling requests:');
      for (const req of activeRequests) {
        console.log(`- ${req.title} (${req.status})`);
        console.log(`  Thread ID: ${req.email_thread_id}`);
        console.log(`  Attendees:`, req.attendees);
      }
    } else {
      console.log('No active scheduling requests found');
    }

    process.exit(1);
  }

  console.log(`Found matching request: ${matchingRequest.title} (${matchingRequest.id})`);
  console.log(`Current status: ${matchingRequest.status}`);

  // Process the response
  console.log('\n--- Processing scheduling response ---');
  const result = await processSchedulingResponse(incomingEmail, matchingRequest);

  console.log('\nProcessing result:');
  console.log('Processed:', result.processed);
  console.log('Action:', result.action);
  console.log('New Status:', result.newStatus);
  if (result.error) {
    console.log('Error:', result.error);
  }

  // Show updated request state
  const { data: updatedRequest } = await supabase
    .from('scheduling_requests')
    .select('*')
    .eq('id', matchingRequest.id)
    .single();

  if (updatedRequest) {
    console.log('\nUpdated scheduling request:');
    console.log('Status:', updatedRequest.status);
    console.log('Next action type:', updatedRequest.next_action_type);
    console.log('Next action at:', updatedRequest.next_action_at);
    console.log('Last action at:', updatedRequest.last_action_at);
  }
}

processResponse().catch(console.error);
