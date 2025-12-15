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

const { data: transcript } = await supabase
  .from('meeting_transcriptions')
  .select('id, title, company_id, deal_id, match_confidence, company:companies(name), deal:deals(name)')
  .eq('title', 'Court Parker')
  .single();

console.log('=== Transcript Assignment ===');
console.log('Title:', transcript.title);
console.log('Company:', transcript.company?.name || 'None');
console.log('Deal:', transcript.deal?.name || 'None');
console.log('Confidence:', transcript.match_confidence);

// Check completed task
const { data: task } = await supabase
  .from('tasks')
  .select('id, title, completed_at')
  .eq('source', 'fireflies_ai')
  .not('completed_at', 'is', null)
  .order('completed_at', { ascending: false })
  .limit(1)
  .single();

if (task) {
  console.log('\n=== Completed Task ===');
  console.log('Title:', task.title);
  console.log('Completed:', task.completed_at);
}
