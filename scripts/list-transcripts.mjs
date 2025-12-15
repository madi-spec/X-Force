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

const { data: transcripts } = await supabase
  .from('meeting_transcriptions')
  .select('title, company:companies(name), deal:deals(name), match_confidence')
  .eq('source', 'fireflies')
  .order('created_at', { ascending: false });

console.log('=== Fireflies Transcripts ===\n');
transcripts.forEach(t => {
  const status = t.company?.name ? '✓ Matched' : '○ Unmatched';
  console.log(status + ': ' + t.title);
  if (t.company?.name) {
    console.log('   Company: ' + t.company.name + (t.deal?.name ? ' | Deal: ' + t.deal.name : ''));
  }
  console.log('');
});

// Check for pending review tasks
const { data: tasks } = await supabase
  .from('tasks')
  .select('title')
  .eq('source', 'fireflies_ai')
  .is('completed_at', null);

if (tasks && tasks.length > 0) {
  console.log('=== Pending Review Tasks ===\n');
  tasks.forEach(t => console.log('• ' + t.title));
} else {
  console.log('No pending review tasks.');
}
