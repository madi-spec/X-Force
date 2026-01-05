import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getValidToken } from '../src/lib/microsoft/auth';

const USER_ID = '11111111-1111-1111-1111-111111111009';

async function check() {
  const token = await getValidToken(USER_ID);
  if (!token) {
    console.log('No token');
    return;
  }

  const response = await fetch(
    'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=5&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await response.json();
  console.log('Recent inbox emails:\n');
  for (const msg of data.value || []) {
    console.log('Time:', msg.receivedDateTime);
    console.log('From:', msg.from?.emailAddress?.address);
    console.log('Subject:', msg.subject);
    console.log('---');
  }
}

check().catch(console.error);
