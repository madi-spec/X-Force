import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getValidToken } from '../src/lib/microsoft/auth';
import { prepareEmailForAI } from '../src/lib/email/contentCleaner';

// Test 26 email - "ok, 9:30 works for me"
const EMAIL_ID = 'AAkALgAAAAAAHYQDEapmEc2byACqAC-EWg0AxuH1gs2LMUeqAq2IgI8oqgAAHDh4uAAA';
const USER_ID = '11111111-1111-1111-1111-111111111009';

async function main() {
  console.log('Fetching Test 26 email...\n');

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

  console.log('\n=== BODY PREVIEW ===');
  console.log(msg.bodyPreview);

  console.log('\n=== PREPARED FOR AI ===');
  const prepared = prepareEmailForAI(msg.body?.content);
  console.log(prepared);

  console.log('\n=== PROPOSED TIMES FOR THIS REQUEST ===');
  const proposedTimes = [
    "Monday, January 5 at 9:30 AM EST",
    "Monday, January 5 at 10:00 AM EST",
    "Monday, January 5 at 10:30 AM EST",
    "Tuesday, January 6 at 9:30 AM EST"
  ];
  proposedTimes.forEach((t, i) => console.log(`${i+1}. ${t}`));

  console.log('\n=== ANALYSIS ===');
  const lowerPrepared = prepared.toLowerCase();
  if (lowerPrepared.includes('9:30')) {
    console.log('✅ Email contains "9:30"');
    console.log('✅ Should match: Monday, January 5 at 9:30 AM EST');
    console.log('➡️ Expected intent: ACCEPT');
  } else {
    console.log('❌ "9:30" not found in prepared content');
  }
}

main().catch(console.error);
