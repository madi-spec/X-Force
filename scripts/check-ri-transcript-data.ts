import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check what RI data exists from transcripts
  const { data: riWithInteractions } = await supabase
    .from('relationship_intelligence')
    .select('id, contact_id, company_id, interactions, signals, open_commitments')
    .not('interactions', 'is', null)
    .limit(1);

  if (riWithInteractions && riWithInteractions.length > 0) {
    const ri = riWithInteractions[0];
    console.log('Sample RI with interactions:');
    console.log('Contact ID:', ri.contact_id);
    console.log('Company ID:', ri.company_id);

    const interactions = ri.interactions || [];
    const transcriptInteractions = interactions.filter((i: any) => i.type === 'transcript');

    console.log('Total interactions:', interactions.length);
    console.log('Transcript interactions:', transcriptInteractions.length);

    if (transcriptInteractions.length > 0) {
      console.log('\nSample transcript interaction:');
      console.log(JSON.stringify(transcriptInteractions[0], null, 2));
    }

    console.log('\nSignals:', JSON.stringify(ri.signals, null, 2));
    console.log('\nOpen Commitments:', JSON.stringify(ri.open_commitments, null, 2));
  } else {
    console.log('No RI with interactions found');
  }
}
main().catch(console.error);
