import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const xrai2Id = '3a85b501-2f05-43f3-8d6f-7a2927375ddf';
  const salesProcessId = '15c94d39-c77b-4ec9-aab9-84264f709916';
  const previewReadyId = 'b834a4b5-ba2b-4f13-8f36-f8bcb85b9af3';

  console.log('=== Process Stages Debug ===\n');

  // Check product_process_stages for the sales process
  const { data: stagesForProcess } = await supabase
    .from('product_process_stages')
    .select('id, name, process_id, stage_order')
    .eq('process_id', salesProcessId)
    .order('stage_order');

  console.log(`Stages linked to sales process (${salesProcessId}):`);
  stagesForProcess?.forEach(s => console.log(`  ${s.stage_order}. ${s.name} [${s.id}]`));

  // Check the Preview Ready stage specifically
  const { data: previewReadyStage } = await supabase
    .from('product_process_stages')
    .select('id, name, process_id')
    .eq('id', previewReadyId)
    .single();

  console.log(`\nPreview Ready stage process_id: ${previewReadyStage?.process_id}`);
  console.log(`Expected sales process_id: ${salesProcessId}`);
  console.log(`Match: ${previewReadyStage?.process_id === salesProcessId ? 'YES' : 'NO'}`);

  // Check how many company_products in_sales for X-RAI 2.0
  const { count } = await supabase
    .from('company_products')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', xrai2Id)
    .eq('status', 'in_sales');

  console.log(`\ncompany_products in_sales for X-RAI 2.0: ${count}`);

  // Check if the page pipeline query would work
  const { data: pipeline, error } = await supabase
    .from('company_products')
    .select(`
      id,
      current_stage_id,
      current_stage:product_process_stages(id, name, slug, stage_order),
      company:companies(id, name)
    `)
    .eq('product_id', xrai2Id)
    .eq('status', 'in_sales')
    .limit(5);

  console.log('\nSample pipeline query result:');
  if (error) console.log('Error:', error);
  pipeline?.forEach(p => {
    const company = Array.isArray(p.company) ? p.company[0] : p.company;
    const stage = Array.isArray(p.current_stage) ? p.current_stage[0] : p.current_stage;
    console.log(`  - ${company?.name}: stage=${stage?.name || 'NULL'} (${p.current_stage_id})`);
  });
}

debug().then(() => process.exit(0));
