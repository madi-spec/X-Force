import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { count: total } = await supabase.from('companies').select('*', { count: 'exact', head: true });
  console.log('Total companies:', total);

  const { count: withRevId } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .not('vfp_customer_id', 'is', null);
  console.log('Companies with vfp_customer_id:', withRevId);

  // Check a sample
  const { data: sample } = await supabase
    .from('companies')
    .select('name, vfp_customer_id')
    .not('vfp_customer_id', 'is', null)
    .limit(5);
  console.log('Sample:', sample);

  // Check if any Rev IDs from Excel exist
  const testRevIds = ['4219', '2900', '1733', '3624', '3600'];
  for (const revId of testRevIds) {
    const { data } = await supabase
      .from('companies')
      .select('id, name, vfp_customer_id')
      .eq('vfp_customer_id', revId)
      .single();
    console.log(`Rev ID ${revId}:`, data ? data.name : 'NOT FOUND');
  }
}

check().catch(console.error);
