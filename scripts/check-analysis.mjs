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

const title = process.argv[2] || 'AI Discovery Session';

const { data } = await supabase
  .from('meeting_transcriptions')
  .select('id, title, analysis, deal:deals(name)')
  .eq('title', title)
  .single();

if (!data) {
  console.log('Transcript not found:', title);
  process.exit(1);
}

console.log('Transcript:', data.title);
console.log('Deal:', data.deal?.name || 'None');
console.log('Has analysis:', !!data.analysis);
console.log('Has extractedInfo:', !!data.analysis?.extractedInfo);
console.log('Has headline:', !!data.analysis?.headline);
console.log('Key points:', data.analysis?.keyPoints?.length || 0);
console.log('Stakeholders:', data.analysis?.stakeholders?.length || 0);
console.log('\nURL: http://localhost:3000/meetings/' + data.id + '/analysis');
