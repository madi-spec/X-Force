import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const xrai2Id = '3a85b501-2f05-43f3-8d6f-7a2927375ddf';

  // Test with product_process_stages (the new unified table)
  const { data, error, count } = await supabase
    .from('company_products')
    .select(`
      id,
      company:companies(id, name),
      current_stage:product_process_stages(id, name, stage_order)
    `, { count: 'exact' })
    .eq('product_id', xrai2Id)
    .eq('status', 'in_sales')
    .limit(5);

  if (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }

  console.log(`✅ FK Migration successful!`);
  console.log(`Total X-RAI 2.0 in_sales: ${count}`);
  console.log('\nSample records:');
  data?.forEach(d => {
    const company = Array.isArray(d.company) ? d.company[0] : d.company;
    const stage = Array.isArray(d.current_stage) ? d.current_stage[0] : d.current_stage;
    console.log(`  - ${company?.name}: ${stage?.name} (order: ${stage?.stage_order})`);
  });
}

test().then(() => process.exit(0));
