import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const xrai2Id = '3a85b501-2f05-43f3-8d6f-7a2927375ddf';
  const previewReadyId = 'b834a4b5-ba2b-4f13-8f36-f8bcb85b9af3';

  console.log('=== Stage Tables Debug ===\n');

  // Check product_sales_stages
  const { data: salesStages } = await supabase
    .from('product_sales_stages')
    .select('id, name, product_id')
    .eq('product_id', xrai2Id);

  console.log('product_sales_stages for X-RAI 2.0:');
  salesStages?.forEach(s => console.log(`  - ${s.name} [${s.id}]`));

  // Check product_process_stages
  const { data: processStages } = await supabase
    .from('product_process_stages')
    .select('id, name, process_id');

  console.log('\nproduct_process_stages (all):');
  processStages?.slice(0, 10).forEach(s => console.log(`  - ${s.name} [${s.id}]`));
  if ((processStages?.length || 0) > 10) console.log(`  ... and ${(processStages?.length || 0) - 10} more`);

  // Check if Preview Ready exists in product_process_stages
  const previewInProcess = processStages?.find(s => s.id === previewReadyId);
  console.log(`\nPreview Ready (${previewReadyId}) in product_process_stages: ${previewInProcess ? 'YES' : 'NO'}`);

  // Check company_products with our stage
  const { data: cps, count } = await supabase
    .from('company_products')
    .select('id, current_stage_id', { count: 'exact' })
    .eq('current_stage_id', previewReadyId);

  console.log(`\ncompany_products with current_stage_id = ${previewReadyId}: ${count}`);

  // Check product_processes for X-RAI 2.0
  const { data: processes } = await supabase
    .from('product_processes')
    .select('id, process_type, status')
    .eq('product_id', xrai2Id);

  console.log('\nproduct_processes for X-RAI 2.0:');
  processes?.forEach(p => console.log(`  - ${p.process_type} (${p.status}) [${p.id}]`));
}

debug().then(() => process.exit(0));
