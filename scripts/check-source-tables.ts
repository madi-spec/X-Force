import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data } = await supabase
    .from('communications')
    .select('source_table')
    .not('source_table', 'is', null);

  const sources: Record<string, number> = {};
  data?.forEach(c => sources[c.source_table] = (sources[c.source_table] || 0) + 1);
  console.log('Source table counts:', sources);

  // Check for microsoft_graph specifically
  const { data: msGraph } = await supabase
    .from('communications')
    .select('id, source_table, source_id, external_id')
    .eq('source_table', 'microsoft_graph')
    .limit(5);

  if (msGraph?.length) {
    console.log('\nmicrosoft_graph sources:');
    msGraph.forEach(c => {
      console.log(`  ${c.id}: source_id=${c.source_id}, external_id=${c.external_id?.substring(0, 40)}`);
    });
  }
}

run().catch(console.error);
