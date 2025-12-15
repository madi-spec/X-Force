/**
 * Test script for Fireflies sync with AI entity matching
 * Run with: node scripts/test-fireflies-sync.mjs
 */

import { createClient } from '@supabase/supabase-js';

// Load env vars from .env.local
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.error('Could not load .env.local:', e.message);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nezewucpbkuzoukomnlv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('=== Fireflies Sync Test ===\n');

  // 1. Check for Fireflies connections
  console.log('1. Checking for Fireflies connections...');
  const { data: connections, error: connError } = await supabase
    .from('fireflies_connections')
    .select('*, user:users(id, email, name)')
    .eq('is_active', true);

  if (connError) {
    console.error('Error fetching connections:', connError.message);
    process.exit(1);
  }

  if (!connections || connections.length === 0) {
    console.log('   No active Fireflies connections found.');
    console.log('\n   To test, first connect Fireflies in the app settings.');
    process.exit(0);
  }

  console.log(`   Found ${connections.length} active connection(s):\n`);
  connections.forEach((conn, i) => {
    const user = Array.isArray(conn.user) ? conn.user[0] : conn.user;
    console.log(`   [${i + 1}] User: ${user?.email || 'Unknown'}`);
    console.log(`       Last sync: ${conn.last_sync_at || 'Never'}`);
    console.log(`       Status: ${conn.last_sync_status || 'N/A'}`);
    console.log(`       Transcripts synced: ${conn.transcripts_synced || 0}`);
    console.log('');
  });

  // 2. Pick the first connection to test
  const testConn = connections[0];
  const testUser = Array.isArray(testConn.user) ? testConn.user[0] : testConn.user;
  console.log(`2. Testing sync for user: ${testUser?.email || testConn.user_id}\n`);

  // 3. Import and run the sync (dynamic import for ESM)
  console.log('3. Running sync...\n');

  // Since we can't easily import TypeScript, let's call the API directly
  // or use the sync function via tsx
  console.log('   To run the actual sync, start the dev server and use:');
  console.log('   curl -X POST http://localhost:3000/api/integrations/fireflies/sync');
  console.log('   (with proper auth cookies)\n');

  // Or show recent transcriptions
  console.log('4. Checking existing transcriptions...\n');
  const { data: transcriptions, error: transError } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, meeting_date, source, match_confidence, deal_id, company_id, external_metadata')
    .eq('source', 'fireflies')
    .order('created_at', { ascending: false })
    .limit(5);

  if (transError) {
    console.error('Error fetching transcriptions:', transError.message);
  } else if (!transcriptions || transcriptions.length === 0) {
    console.log('   No Fireflies transcriptions found yet.\n');
  } else {
    console.log(`   Found ${transcriptions.length} recent Fireflies transcription(s):\n`);
    transcriptions.forEach((t, i) => {
      const metadata = t.external_metadata || {};
      console.log(`   [${i + 1}] "${t.title}"`);
      console.log(`       Date: ${t.meeting_date}`);
      console.log(`       Match confidence: ${(t.match_confidence * 100).toFixed(0)}%`);
      console.log(`       Match method: ${metadata.match_method || 'unknown'}`);
      console.log(`       Deal ID: ${t.deal_id || 'Not assigned'}`);
      console.log(`       Company ID: ${t.company_id || 'Not assigned'}`);
      if (metadata.ai_match_result) {
        console.log(`       AI reasoning: ${metadata.ai_match_result.reasoning?.substring(0, 100)}...`);
      }
      console.log('');
    });
  }

  // 5. Check for review tasks
  console.log('5. Checking for transcript review tasks...\n');
  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id, title, description, priority, due_at, completed_at')
    .eq('source', 'fireflies_ai')
    .eq('type', 'review')
    .is('completed_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (taskError) {
    console.error('Error fetching tasks:', taskError.message);
  } else if (!tasks || tasks.length === 0) {
    console.log('   No pending transcript review tasks.\n');
  } else {
    console.log(`   Found ${tasks.length} pending review task(s):\n`);
    tasks.forEach((t, i) => {
      console.log(`   [${i + 1}] "${t.title}"`);
      console.log(`       Priority: ${t.priority}`);
      console.log(`       Due: ${t.due_at}`);
      console.log('');
    });
  }

  console.log('=== Test Complete ===\n');
}

main().catch(console.error);
