import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getValidToken } from '../src/lib/microsoft/auth';

const CONV_ID = 'AAQkADgzYWEzNGVlLWQxMWYtNDc4Ni05OGVhLWRiMzUyY2ZlMTY3MQAQABvLsABmlU5ArgHxSSQXUEk=';

async function main() {
  const token = await getValidToken('d9b1658f-86a3-434c-be44-a8b86f95ca98');
  if (!token) {
    console.log('No token');
    return;
  }

  // Fetch emails in the Tech thread
  const url = `https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId eq '${CONV_ID}'&$orderby=receivedDateTime desc&$top=10&$select=id,subject,from,receivedDateTime,bodyPreview`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'IdType="ImmutableId"',
    },
  });

  const data = await response.json();
  console.log('Emails in Tech thread:', data.value?.length || 0);

  for (const msg of data.value || []) {
    console.log('\n' + msg.receivedDateTime);
    console.log('Subject:', msg.subject);
    console.log('From:', msg.from?.emailAddress?.address);
    console.log('Preview:', msg.bodyPreview?.slice(0, 100));
  }
}

main().catch(console.error);
