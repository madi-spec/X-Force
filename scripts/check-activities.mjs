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

async function check() {
  const dealNames = ['Harris', 'Blue Beetle', 'Hoffer', 'Happinest'];

  for (const name of dealNames) {
    const { data: deal } = await supabase
      .from('deals')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .single();

    console.log(`\n=== ${name} ===`);
    console.log('Deal:', deal?.name);

    // Get meeting activities
    const { data: activities } = await supabase
      .from('activities')
      .select('id, type, subject, metadata')
      .eq('deal_id', deal?.id)
      .eq('type', 'meeting');

    console.log('Meeting activities:', activities?.length || 0);
    activities?.forEach(a => {
      console.log('  -', a.subject);
      console.log('    transcription_id:', a.metadata?.transcription_id || 'NONE');
    });

    // Get transcripts
    const { data: transcripts } = await supabase
      .from('meeting_transcriptions')
      .select('id, title')
      .eq('deal_id', deal?.id);

    console.log('Transcripts:', transcripts?.length || 0);
    transcripts?.forEach(t => {
      console.log('  -', t.title, '(', t.id, ')');
    });
  }
}

check().catch(console.error);
