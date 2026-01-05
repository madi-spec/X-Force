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
    .select('id, source_table, external_id')
    .not('external_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  console.log('Sample external_ids by source:\n');
  const bySource: Record<string, string[]> = {};
  data?.forEach(c => {
    const source = c.source_table || 'unknown';
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(c.external_id);
  });

  Object.entries(bySource).forEach(([source, ids]) => {
    console.log(`${source}:`);
    [...new Set(ids)].slice(0, 5).forEach(id => console.log(`  ${id}`));
    console.log('');
  });

  // Check the Ivey duplicates specifically
  console.log('=== Ivey duplicate external_ids ===');
  const { data: ivey } = await supabase
    .from('communications')
    .select('id, source_table, external_id, subject')
    .eq('company_id', '18b71dd9-2b71-4308-adfe-5d0a94b2e087')
    .ilike('subject', '%FW: x-rai free trial%');

  ivey?.forEach(c => {
    console.log(`\n${c.source_table}: ${c.subject}`);
    console.log(`  external_id: ${c.external_id}`);
  });
}

run().catch(console.error);
