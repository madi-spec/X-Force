/**
 * Find X-RAI 2.0 product and its sales stages
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function find() {
  // X-RAI 2.0 product ID from previous run
  const xrai2Id = '3a85b501-2f05-43f3-8d6f-7a2927375ddf';

  console.log('Looking up X-RAI 2.0 stages...');

  // Try product_sales_stages table (the original one)
  const { data: salesStages, error: salesErr } = await supabase
    .from('product_sales_stages')
    .select('id, name, slug, stage_order')
    .eq('product_id', xrai2Id)
    .order('stage_order');

  if (salesErr) {
    console.log('product_sales_stages error:', salesErr.message);
  } else if (salesStages && salesStages.length > 0) {
    console.log('\nX-RAI 2.0 Sales Stages (from product_sales_stages):');
    salesStages.forEach(s => console.log(`  ${s.stage_order}. ${s.name} [${s.id}]`));

    const previewReady = salesStages.find(s =>
      s.name.toLowerCase().includes('preview')
    );

    if (previewReady) {
      console.log(`\n✅ PRODUCT ID: ${xrai2Id}`);
      console.log(`✅ PREVIEW READY STAGE ID: ${previewReady.id}`);
    }
  } else {
    console.log('No stages found in product_sales_stages');
  }
}

find().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
