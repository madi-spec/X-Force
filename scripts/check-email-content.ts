import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { getValidToken } from '../src/lib/microsoft/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EMAIL_ID = 'AAkALgAAAAAAHYQDEapmEc2byACqAC-EWg0AxuH1gs2LMUeqAq2IgI8oqgAAHDhw5QAA';
const USER_ID = '11111111-1111-1111-1111-111111111009';

async function main() {
  console.log('Fetching email content from Graph API...\n');

  const token = await getValidToken(USER_ID);
  if (!token) {
    console.error('Failed to get token');
    return;
  }

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${EMAIL_ID}?$select=id,subject,body,bodyPreview,from,receivedDateTime`,
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

  console.log('=== EMAIL DETAILS ===');
  console.log('Subject:', msg.subject);
  console.log('From:', msg.from?.emailAddress?.address);
  console.log('Received:', msg.receivedDateTime);
  console.log('\n=== BODY PREVIEW (first 255 chars) ===');
  console.log(msg.bodyPreview);
  console.log('\n=== FULL BODY CONTENT ===');
  console.log('Content Type:', msg.body?.contentType);
  console.log('Content Length:', msg.body?.content?.length || 0);
  console.log('\n--- Start of Body ---');
  // Extract just the text from HTML if needed
  const bodyContent = msg.body?.content || '';
  // Strip HTML tags for readability
  const textContent = bodyContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(textContent.substring(0, 2000));
  console.log('--- End of Body ---');
}

main().catch(console.error);
