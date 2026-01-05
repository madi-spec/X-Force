import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const happinestId = '01e64697-251a-4eca-aa63-9a78e810362e';

  console.log('=== ALL TRANSCRIPTS FOR HAPPINEST ===\n');

  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, company_id, transcript_text, created_at')
    .eq('company_id', happinestId);

  if (!transcripts || transcripts.length === 0) {
    console.log('No transcripts found for Happinest!');

    // Check if the transcript exists elsewhere
    console.log('\nSearching for transcript 715c28e2-76e4-4af7-afa0-0e2aa0d10deb...');
    const { data: orphan } = await supabase
      .from('meeting_transcriptions')
      .select('id, title, company_id')
      .eq('id', '715c28e2-76e4-4af7-afa0-0e2aa0d10deb')
      .single();

    if (orphan) {
      console.log('Found:', orphan);
      const { data: c } = await supabase.from('companies').select('name').eq('id', orphan.company_id).single();
      console.log('Actually belongs to:', c?.name);
    } else {
      console.log('Transcript not found in database at all');
    }

    return;
  }

  for (const t of transcripts) {
    const text = t.transcript_text?.toLowerCase() || '';
    console.log(`Title: ${t.title}`);
    console.log(`  ID: ${t.id}`);
    console.log(`  Created: ${t.created_at}`);
    console.log(`  Contains "Lawn Doctor": ${text.includes('lawn doctor')}`);
    console.log(`  Contains "Happinest": ${text.includes('happinest')}`);
    console.log(`  First 300 chars: ${t.transcript_text?.substring(0, 300).replace(/\n/g, ' ')}...`);
    console.log('');
  }

  // Check what company the orphan transcript belongs to
  console.log('\n=== CHECK ORPHAN TRANSCRIPT ===');
  const { data: orphanTranscript } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, company_id, transcript_text')
    .eq('id', '715c28e2-76e4-4af7-afa0-0e2aa0d10deb')
    .single();

  if (orphanTranscript) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', orphanTranscript.company_id)
      .single();

    console.log('Orphan transcript found!');
    console.log(`  Title: ${orphanTranscript.title}`);
    console.log(`  Company ID: ${orphanTranscript.company_id}`);
    console.log(`  Company Name: ${company?.name}`);

    const text = orphanTranscript.transcript_text?.toLowerCase() || '';
    console.log(`  Contains "Lawn Doctor": ${text.includes('lawn doctor')}`);
    console.log(`  Contains "Happinest": ${text.includes('happinest')}`);
  } else {
    console.log('Orphan transcript 715c28e2... not found - may have been deleted');
  }

  // Check the Happinest company-level RI record source IDs
  console.log('\n=== RI SOURCE IDS ===');
  const { data: ri } = await supabase
    .from('relationship_intelligence')
    .select('id, context')
    .eq('company_id', happinestId)
    .is('contact_id', null)
    .single();

  if (ri?.context?.key_facts) {
    const sourceIds = new Set((ri.context as any).key_facts.map((f: any) => f.source_id));
    console.log('Source IDs in RI key_facts:', Array.from(sourceIds));

    for (const sourceId of sourceIds) {
      const { data: t } = await supabase
        .from('meeting_transcriptions')
        .select('id, title, company_id')
        .eq('id', sourceId as string)
        .single();

      if (t) {
        const { data: c } = await supabase.from('companies').select('name').eq('id', t.company_id).single();
        console.log(`  ${sourceId}: ${t.title} (${c?.name})`);
      } else {
        console.log(`  ${sourceId}: NOT FOUND`);
      }
    }
  }
}

check().catch(console.error);
