import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { syncAllFolderEmails } from '../src/lib/microsoft/emailSync';
import { processUnanalyzedEmails } from '../src/lib/email';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runSync() {
  console.log('=== Manual Email Sync ===\n');

  // Get active Microsoft connections
  const { data: connections, error } = await supabase
    .from('microsoft_connections')
    .select('user_id, email')
    .eq('is_active', true);

  if (error || !connections?.length) {
    console.error('No active connections found:', error);
    return;
  }

  console.log(`Found ${connections.length} active connection(s)\n`);

  for (const conn of connections) {
    console.log(`Syncing for user ${conn.user_id} (${conn.email})...`);

    try {
      // Sync emails
      const result = await syncAllFolderEmails(conn.user_id);
      console.log(`  Emails imported: ${result.imported}`);
      if (result.errors.length > 0) {
        console.log(`  Errors:`, result.errors);
      }

      // Run analysis on new emails
      if (result.imported > 0) {
        console.log(`  Running AI analysis on new emails...`);
        const analysisResult = await processUnanalyzedEmails(conn.user_id, 10);
        console.log(`  Items created from analysis: ${analysisResult.itemsCreated}`);
      }
    } catch (err) {
      console.error(`  Failed:`, err);
    }
  }

  console.log('\n=== Sync Complete ===');

  // Check most recent emails after sync
  const { data: recentEmails } = await supabase
    .from('communications')
    .select('id, subject, created_at, direction')
    .eq('channel', 'email')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\nMost recent emails after sync:');
  recentEmails?.forEach(e => {
    console.log(`  [${e.created_at}] ${e.direction} - ${e.subject?.substring(0, 50)}`);
  });
}

runSync().catch(console.error);
