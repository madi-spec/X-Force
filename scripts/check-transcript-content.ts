import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // The problematic transcript
  const transcriptId = '715c28e2-76e4-4af7-afa0-0e2aa0d10deb';

  const { data: transcript } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, company_id, transcript_text')
    .eq('id', transcriptId)
    .single();

  if (!transcript) {
    console.log('Transcript not found!');
    return;
  }

  console.log('=== TRANSCRIPT DETAILS ===');
  console.log('ID:', transcript.id);
  console.log('Title:', transcript.title);
  console.log('Company ID:', transcript.company_id);

  // Get company name
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', transcript.company_id)
    .single();
  console.log('Company:', company?.name);

  console.log('\n=== TRANSCRIPT TEXT (first 2000 chars) ===');
  console.log(transcript.transcript_text?.substring(0, 2000));

  // Search for key terms
  const text = transcript.transcript_text?.toLowerCase() || '';
  console.log('\n=== TERM CHECK ===');
  console.log('Contains "Lawn Doctor":', text.includes('lawn doctor'));
  console.log('Contains "Happinest":', text.includes('happinest'));
  console.log('Contains "franchisee":', text.includes('franchisee'));
  console.log('Contains "January":', text.includes('january'));

  // Also check the other Happinest transcripts
  console.log('\n=== ALL HAPPINEST TRANSCRIPTS ===');
  const happinestId = '01e64697-251a-4eca-aa63-9a78e810362e';

  const { data: allTranscripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, company_id, transcript_text')
    .eq('company_id', happinestId);

  for (const t of allTranscripts || []) {
    const tText = t.transcript_text?.toLowerCase() || '';
    console.log(`\n${t.title}:`);
    console.log(`  Contains "Lawn Doctor": ${tText.includes('lawn doctor')}`);
    console.log(`  Contains "Happinest": ${tText.includes('happinest')}`);
    console.log(`  First 200 chars: ${t.transcript_text?.substring(0, 200)}...`);
  }
}

check().catch(console.error);
