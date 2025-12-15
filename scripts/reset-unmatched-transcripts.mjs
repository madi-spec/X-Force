/**
 * Delete unassigned Fireflies transcripts to re-test entity creation
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

// Load env
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Find the unmatched transcripts (Court Parker and Andrew J Canniff)
  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, external_id, company_id, deal_id')
    .eq('source', 'fireflies')
    .is('company_id', null);

  console.log('Found', transcripts?.length || 0, 'unassigned transcripts:');
  transcripts?.forEach(t => console.log(' -', t.title));

  if (!transcripts || transcripts.length === 0) {
    console.log('No unassigned transcripts to delete.');
    return;
  }

  const ids = transcripts.map(t => t.id);

  // Delete related tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title')
    .eq('source', 'fireflies_ai');

  if (tasks && tasks.length > 0) {
    console.log('\nDeleting', tasks.length, 'related tasks');
    await supabase.from('tasks').delete().eq('source', 'fireflies_ai');
  }

  // Delete transcriptions
  const { error } = await supabase
    .from('meeting_transcriptions')
    .delete()
    .in('id', ids);

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Deleted', ids.length, 'transcripts for re-testing');
  }

  // Reset connection sync state
  await supabase
    .from('fireflies_connections')
    .update({ last_sync_at: null, transcripts_synced: 0 })
    .eq('is_active', true);

  console.log('Reset connection sync state');
}

main().catch(console.error);
