import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function graphFetch(token: string, endpoint: string) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return response.json();
}

async function debug() {
  // Get token
  const { data: connection } = await supabase
    .from('microsoft_connections')
    .select('user_id, access_token')
    .eq('is_active', true)
    .single();

  if (!connection) {
    console.log('No connection');
    return;
  }

  // Count existing activities with ms_email_ prefix
  const { count: activityCount } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .like('external_id', 'ms_email_%');

  console.log('Activities with ms_email_ prefix:', activityCount);

  // Get Archive folder
  const folders = await graphFetch(connection.access_token, '/me/mailFolders');
  const archiveFolder = folders.value?.find((f: { displayName: string }) =>
    f.displayName.toLowerCase() === 'archive'
  );

  if (!archiveFolder) {
    console.log('No archive folder found');
    return;
  }

  console.log('\nArchive folder ID:', archiveFolder.id);
  console.log('Archive folder items:', archiveFolder.totalItemCount);

  // Get a few messages from Archive
  const messages = await graphFetch(
    connection.access_token,
    `/me/mailFolders/${archiveFolder.id}/messages?$top=5&$select=id,subject,from,receivedDateTime`
  );

  console.log('\nFirst 5 messages from Archive:');
  for (const msg of messages.value || []) {
    const externalId = `ms_email_${msg.id}`;

    // Check if this exists in activities
    const { data: existing } = await supabase
      .from('activities')
      .select('id')
      .eq('external_id', externalId)
      .single();

    const status = existing ? '✅ ALREADY SYNCED' : '❌ NOT SYNCED';
    console.log(`  ${status}: ${(msg.subject || '(no subject)').substring(0, 50)}`);
    console.log(`    ID: ${msg.id.substring(0, 50)}...`);
  }

  // Check email_messages table too
  const { count: emailMsgCount } = await supabase
    .from('email_messages')
    .select('*', { count: 'exact', head: true });

  console.log('\n\nTotal in email_messages table:', emailMsgCount);
}

debug().catch(console.error);
