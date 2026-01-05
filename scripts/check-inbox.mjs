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

console.log('Fetching recent emails from Microsoft...');

// Fetch recent emails from inbox
const response = await fetch(
  'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=10&$orderby=receivedDateTime%20desc&$select=id,subject,from,receivedDateTime,bodyPreview',
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
console.log('\nRecent emails in inbox:');

for (const email of data.value) {
  console.log('- ' + email.subject);
  console.log('  From: ' + email.from.emailAddress.address);
  console.log('  At: ' + email.receivedDateTime);
  const preview = email.bodyPreview ? email.bodyPreview.substring(0, 80) : '';
  console.log('  Preview: ' + preview);
  console.log();
}
