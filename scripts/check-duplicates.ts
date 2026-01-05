import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data } = await supabase
    .from('communications')
    .select('id, subject, external_id, occurred_at, source_table, awaiting_our_response')
    .ilike('subject', '%x-rai free trial form VFP%')
    .order('occurred_at', { ascending: false });

  console.log('Emails with VFP subject:\n');
  data?.forEach(d => {
    console.log(`[${d.occurred_at}] ${d.subject}`);
    console.log(`  ID: ${d.id}`);
    console.log(`  External ID: ${d.external_id}`);
    console.log(`  Source: ${d.source_table}`);
    console.log(`  Awaiting response: ${d.awaiting_our_response}`);
    console.log('');
  });

  // Check if there are duplicates by external_id
  const externalIds = data?.map(d => d.external_id).filter(Boolean);
  const duplicateIds = externalIds?.filter((id, i) => externalIds.indexOf(id) !== i);
  if (duplicateIds?.length) {
    console.log('DUPLICATE external_ids found:', duplicateIds);
  }
}
check();
