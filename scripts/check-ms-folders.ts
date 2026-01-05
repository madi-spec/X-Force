import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Simple fetch wrapper for MS Graph
async function graphFetch(token: string, endpoint: string) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return response.json();
}

async function check() {
  // Get the user's token
  const { data: connection } = await supabase
    .from('microsoft_connections')
    .select('user_id, access_token, refresh_token, token_expires_at')
    .eq('is_active', true)
    .single();

  if (!connection) {
    console.log('No active Microsoft connection found');
    return;
  }

  console.log('User ID:', connection.user_id);
  console.log('Token expires:', new Date(connection.token_expires_at).toLocaleString());

  // Check if token is expired
  const isExpired = new Date(connection.token_expires_at) < new Date();
  if (isExpired) {
    console.log('\n⚠️ Token is EXPIRED - needs refresh');
    return;
  }

  // Get mail folders
  console.log('\n📁 Fetching mail folders from Microsoft Graph...\n');
  const folders = await graphFetch(connection.access_token, '/me/mailFolders?$top=50');

  if (folders.error) {
    console.log('Error fetching folders:', folders.error);
    return;
  }

  const excludedFolders = ['deleted items', 'deleteditems', 'junk email', 'junk', 'spam', 'deleted', 'trash', 'drafts'];

  console.log('All folders:');
  for (const folder of folders.value) {
    const isExcluded = excludedFolders.includes(folder.displayName.toLowerCase());
    const status = isExcluded ? '❌ EXCLUDED' : '✅ SYNC';
    console.log(`  ${status} ${folder.displayName}: ${folder.totalItemCount} items (${folder.unreadItemCount} unread)`);
  }

  // Get message counts from folders we sync
  console.log('\n📧 Checking messages in sync folders...\n');
  const syncFolders = folders.value.filter(
    (f: { displayName: string }) => !excludedFolders.includes(f.displayName.toLowerCase())
  );

  for (const folder of syncFolders.slice(0, 5)) {
    const messages = await graphFetch(
      connection.access_token,
      `/me/mailFolders/${folder.id}/messages?$top=3&$select=subject,receivedDateTime,from&$orderby=receivedDateTime desc`
    );

    console.log(`${folder.displayName} (${folder.totalItemCount} total):`);
    if (messages.value) {
      messages.value.forEach((m: { subject?: string; from?: { emailAddress: { address: string } } }) => {
        console.log(`  - ${(m.subject || '(no subject)').substring(0, 50)} from ${m.from?.emailAddress?.address || 'unknown'}`);
      });
    }
    console.log('');
  }
}

check().catch(console.error);
