import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { getValidToken } from '../src/lib/microsoft/auth';
import { prepareEmailForAI, htmlToPlainText, cleanEmailContent } from '../src/lib/email/contentCleaner';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EMAIL_ID = 'AAkALgAAAAAAHYQDEapmEc2byACqAC-EWg0AxuH1gs2LMUeqAq2IgI8oqgAAHDhw5QAA';
const USER_ID = '11111111-1111-1111-1111-111111111009';

async function main() {
  console.log('Testing email preprocessing for scheduler...\n');

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

  console.log('=== ORIGINAL EMAIL ===');
  console.log('Subject:', msg.subject);
  console.log('From:', msg.from?.emailAddress?.address);
  console.log('\n=== BODY PREVIEW (first 255 chars) ===');
  console.log(msg.bodyPreview);
  console.log('\n=== RAW HTML BODY (first 500 chars) ===');
  console.log((msg.body?.content || '').substring(0, 500));

  console.log('\n=== STEP 1: HTML TO PLAIN TEXT ===');
  const plainText = htmlToPlainText(msg.body?.content);
  console.log('Result (first 500 chars):');
  console.log(plainText.substring(0, 500));

  console.log('\n=== STEP 2: CLEAN BOILERPLATE (CAUTION warnings) ===');
  const cleaned = cleanEmailContent(plainText);
  console.log('Result (first 500 chars):');
  console.log(cleaned.substring(0, 500));

  console.log('\n=== COMBINED: prepareEmailForAI() ===');
  const prepared = prepareEmailForAI(msg.body?.content);
  console.log('Result:');
  console.log(prepared);

  console.log('\n=== ANALYSIS ===');
  console.log('Original length:', msg.body?.content?.length || 0);
  console.log('After HTML strip:', plainText.length);
  console.log('After cleaning:', cleaned.length);
  console.log('Final prepared:', prepared.length);

  // Check if "9:30" is visible
  if (prepared.includes('9:30')) {
    console.log('\n✅ SUCCESS: "9:30" is visible in the prepared content!');
  } else {
    console.log('\n❌ FAILURE: "9:30" is NOT visible in the prepared content');
    console.log('Looking for it in full content...');
    console.log('In plain text:', plainText.includes('9:30'));
    console.log('In cleaned:', cleaned.includes('9:30'));
  }
}

main().catch(console.error);
