import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EXCLUDED_FOLDER_NAMES = [
  'deleted items', 'deleteditems', 'junk email', 'junk',
  'spam', 'deleted', 'trash', 'drafts',
];

async function graphFetch(token: string, endpoint: string) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'IdType="ImmutableId"',
    },
  });
  return response.json();
}

async function testSync() {
  const { data: connection } = await supabase
    .from('microsoft_connections')
    .select('user_id, access_token')
    .eq('is_active', true)
    .single();

  if (!connection) {
    console.log('No connection');
    return;
  }

  console.log('=== Testing syncAllFolderEmails logic ===\n');

  // Get folders
  const folders = await graphFetch(connection.access_token, '/me/mailFolders?$top=50');
  if (folders.error) {
    console.log('Error getting folders:', folders.error);
    return;
  }

  console.log('Total folders:', folders.value.length);

  // Filter
  const foldersToSync = folders.value.filter((f: { displayName: string }) =>
    !EXCLUDED_FOLDER_NAMES.includes(f.displayName.toLowerCase())
  );

  console.log('Folders to sync:', foldersToSync.length);
  foldersToSync.forEach((f: { displayName: string; totalItemCount: number }) => {
    console.log(`  - ${f.displayName}: ${f.totalItemCount} items`);
  });

  const maxMessages = 200;
  const perFolder = Math.ceil(maxMessages / foldersToSync.length);
  console.log(`\nMax ${perFolder} messages per folder (${maxMessages} / ${foldersToSync.length})\n`);

  let totalCollected = 0;
  let totalSkipped = 0;
  let totalNew = 0;

  for (const folder of foldersToSync) {
    const folderNameLower = folder.displayName.toLowerCase();
    const isSentFolder = folderNameLower.includes('sent') || folderNameLower === 'outbox';

    const endpoint = `/me/mailFolders/${folder.id}/messages?$top=${perFolder}&$select=id,subject,from,toRecipients,receivedDateTime,sentDateTime&$orderby=${isSentFolder ? 'sentDateTime' : 'receivedDateTime'} desc`;

    const messages = await graphFetch(connection.access_token, endpoint);

    if (messages.error) {
      console.log(`ERROR in ${folder.displayName}:`, messages.error);
      continue;
    }

    const msgCount = messages.value?.length || 0;
    console.log(`${folder.displayName}: fetched ${msgCount} messages`);
    totalCollected += msgCount;

    // Check how many are new vs already synced
    let newCount = 0;
    let skippedCount = 0;
    for (const msg of (messages.value || [])) {
      const externalId = `ms_email_${msg.id}`;
      const { data: existing } = await supabase
        .from('activities')
        .select('id')
        .eq('external_id', externalId)
        .single();

      if (existing) {
        skippedCount++;
      } else {
        newCount++;
      }
    }
    console.log(`  -> ${newCount} new, ${skippedCount} already synced`);
    totalNew += newCount;
    totalSkipped += skippedCount;
  }

  console.log('\n=== Summary ===');
  console.log(`Total fetched: ${totalCollected}`);
  console.log(`New (would import): ${totalNew}`);
  console.log(`Skipped (already exist): ${totalSkipped}`);
}

testSync().catch(console.error);
