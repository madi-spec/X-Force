import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

const userId = '11111111-1111-1111-1111-111111111009';

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

console.log('Fetching the response email...');

// Fetch recent emails and filter locally
const response = await fetch(
  'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=20&$orderby=receivedDateTime%20desc&$select=id,subject,from,receivedDateTime,body,bodyPreview,conversationId',
  {
    headers: {
      Authorization: 'Bearer ' + conn.access_token,
    },
  }
);

if (!response.ok) {
  console.log('Error:', await response.text());
  process.exit(1);
}

const data = await response.json();

// Find email from theangryocto.com
const email = data.value.find(e =>
  e.from?.emailAddress?.address?.toLowerCase().includes('theangryocto')
);

if (!email) {
  console.log('No email found from theangryocto.com');
  console.log('\nRecent emails:');
  for (const e of data.value.slice(0, 5)) {
    console.log('- ' + e.subject);
    console.log('  From: ' + e.from?.emailAddress?.address);
  }
  process.exit(1);
}

console.log('\nEmail found:');
console.log('Subject:', email.subject);
console.log('From:', email.from.emailAddress.address);
console.log('Received:', email.receivedDateTime);
console.log('ConversationId:', email.conversationId);
console.log('\nBody preview:', email.bodyPreview);

// Extract text from HTML body
let bodyText = email.body?.content || email.bodyPreview;
if (email.body?.contentType === 'html') {
  // Simple HTML to text conversion
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

console.log('\nExtracted body text:', bodyText.substring(0, 500));

// Now let's analyze this response and update the scheduling request
console.log('\n--- Processing Response ---');

// Get the scheduling request
const { data: request } = await supabase
  .from('scheduling_requests')
  .select('id, status, proposed_times, company_id')
  .eq('id', 'fd360b3e-b42a-4d52-b612-94b6e8b0e294')
  .single();

if (!request) {
  console.log('Scheduling request not found');
  process.exit(1);
}

console.log('Scheduling request status:', request.status);
console.log('Proposed times:', request.proposed_times);

// Simple intent detection
const bodyLower = bodyText.toLowerCase();
let intent = 'unclear';
let suggestedTime = null;

if (bodyLower.includes('monday') || bodyLower.includes('tuesday') || bodyLower.includes('wednesday') ||
    bodyLower.includes('thursday') || bodyLower.includes('friday')) {

  // Check for counter proposal
  if (bodyLower.includes('instead') || bodyLower.includes('how about') || bodyLower.includes('would') ||
      bodyLower.includes('better') || bodyLower.includes('works for me') || bodyLower.includes('can we') ||
      bodyLower.includes('available')) {
    intent = 'counter_propose';

    // Try to extract the suggested time
    const timeMatch = bodyText.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/);
    if (timeMatch) {
      suggestedTime = timeMatch[0];
    }
  }

  // Check for acceptance of one of our times
  const proposed = request.proposed_times || [];
  for (const time of proposed) {
    if (bodyLower.includes(time.toLowerCase().replace(/,/g, ''))) {
      intent = 'accept';
      suggestedTime = time;
      break;
    }
  }
}

// Check for decline
if (bodyLower.includes('not interested') || bodyLower.includes('decline') || bodyLower.includes('no thanks')) {
  intent = 'decline';
}

console.log('\nDetected intent:', intent);
console.log('Suggested time:', suggestedTime);

// Log the full body for manual review
console.log('\n--- Full Email Body ---');
console.log(bodyText);
