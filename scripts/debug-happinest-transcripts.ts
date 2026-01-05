import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get the specific transcript
  const { data: transcript, error } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, company_id, transcription_text')
    .eq('id', '715c28e2-76e4-4af7-afa0-0e2aa0d10deb')
    .single();

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('=== TRANSCRIPT ===');
  console.log('ID:', transcript.id);
  console.log('Title:', transcript.title);
  console.log('Company ID:', transcript.company_id);

  // Check what's in the text
  const text = transcript.transcription_text || '';
  console.log('\n=== CONTENT CHECK ===');
  console.log('Length:', text.length);
  console.log('Contains "Lawn Doctor":', text.toLowerCase().includes('lawn doctor'));
  console.log('Contains "happinest":', text.toLowerCase().includes('happinest'));
  console.log('Contains "franchise":', text.toLowerCase().includes('franchise'));

  // First 1000 chars
  console.log('\n=== FIRST 1000 CHARS ===');
  console.log(text.substring(0, 1000));

  // Search for lawn doctor specifically
  const ldIndex = text.toLowerCase().indexOf('lawn doctor');
  if (ldIndex > -1) {
    console.log('\n=== LAWN DOCTOR CONTEXT ===');
    console.log(text.substring(Math.max(0, ldIndex - 100), ldIndex + 200));
  }

  // Get all transcripts and their companies
  console.log('\n=== ALL TRANSCRIPTS ===');
  const { data: all } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, company_id')
    .order('created_at', { ascending: false })
    .limit(20);

  for (const t of all || []) {
    const { data: c } = await supabase.from('companies').select('name').eq('id', t.company_id).single();
    console.log(`${t.title} -> ${c?.name || 'NO COMPANY'}`);
  }
}

check().catch(console.error);
