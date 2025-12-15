import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchFirefliesTranscripts(apiKey) {
  const query = `
    query {
      transcripts(limit: 20) {
        id
        title
        date
        duration
        organizer_email
      }
    }
  `;

  const response = await fetch('https://api.fireflies.ai/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();
  if (data.errors) {
    console.error('Fireflies API errors:', data.errors);
  }
  return data.data?.transcripts || [];
}

async function main() {
  // Get Fireflies API key from connection
  const { data: connection, error: connError } = await supabase
    .from('fireflies_connections')
    .select('api_key')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (connError || !connection) {
    console.error('No active Fireflies connection found');
    return;
  }
  // Get already synced IDs
  const { data: synced } = await supabase
    .from('meeting_transcriptions')
    .select('external_id')
    .eq('source', 'fireflies');

  // External IDs are stored with 'fireflies_' prefix
  const syncedIds = new Set((synced || []).map(t => t.external_id?.replace('fireflies_', '')));

  // Fetch from Fireflies
  const transcripts = await fetchFirefliesTranscripts(connection.api_key);

  console.log('=== Fireflies Transcripts ===\n');

  let newCount = 0;
  transcripts.forEach((t, i) => {
    const date = new Date(parseInt(t.date)).toLocaleDateString();
    const duration = Math.round(t.duration / 60);
    const isSynced = syncedIds.has(t.id);
    const status = isSynced ? '✓' : '○ NEW';

    console.log(`${i + 1}. [${status}] ${t.title}`);
    console.log(`   Date: ${date} | Duration: ${duration} min`);
    if (!isSynced) {
      console.log(`   ID: ${t.id}`);
      newCount++;
    }
    console.log('');
  });

  console.log(`\nTotal: ${transcripts.length} | Already synced: ${transcripts.length - newCount} | New: ${newCount}`);
}

main().catch(console.error);
