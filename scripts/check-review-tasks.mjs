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

async function main() {
  // Check for review tasks
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, source, type, completed_at, description')
    .eq('source', 'fireflies_ai')
    .eq('type', 'review')
    .is('completed_at', null)
    .limit(5);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('=== Pending Fireflies Review Tasks ===\n');
  if (tasks.length === 0) {
    console.log('No pending review tasks found.');
  } else {
    tasks.forEach(t => {
      console.log('Task ID:', t.id);
      console.log('Title:', t.title);
      console.log('');
    });
  }

  // Check for transcriptions with extracted data
  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, external_metadata')
    .not('external_metadata', 'is', null)
    .limit(5);

  console.log('\n=== Transcripts with Extracted Data ===\n');
  const transcriptsWithData = (transcripts || []).filter(t =>
    t.external_metadata?.extracted_entity_data
  );

  if (transcriptsWithData.length === 0) {
    console.log('No transcripts with extracted data found.');
  } else {
    transcriptsWithData.forEach(t => {
      const data = t.external_metadata.extracted_entity_data;
      console.log('Transcript:', t.title);
      console.log('  Company:', data?.company?.name || 'N/A');
      console.log('  Contacts:', data?.contacts?.length || 0);
      console.log('');
    });
  }
}

main().catch(console.error);
