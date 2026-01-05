import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const slug = 'xrai-2';
  const selectedProcess = 'sales';

  console.log('=== Full Page Debug ===\n');

  // Get product
  const { data: product } = await supabase
    .from('products')
    .select('id, name')
    .eq('slug', slug)
    .single();

  console.log('Product:', product?.name);

  // Get processes
  const { data: processes } = await supabase
    .from('product_processes')
    .select('id, name, process_type, status')
    .eq('product_id', product?.id)
    .eq('status', 'published');

  console.log('Processes:', processes?.map(p => p.process_type));

  // Get process stages
  const processIds = processes?.map(p => p.id) || [];
  const { data: processStages } = await supabase
    .from('product_process_stages')
    .select('*')
    .in('process_id', processIds)
    .order('stage_order');

  console.log('Process stages count:', processStages?.length);

  // This is what the default 'pipeline' view uses
  const { data: projectionData, count: projCount } = await supabase
    .from('company_product_read_model')
    .select('*', { count: 'exact' })
    .eq('product_id', product?.id);

  console.log('\n=== company_product_read_model (used by default view) ===');
  console.log('Count:', projCount);

  // This is what the 'in_sales' view uses
  const { data: pipeline, count: pipeCount } = await supabase
    .from('company_products')
    .select('id', { count: 'exact' })
    .eq('product_id', product?.id)
    .eq('status', 'in_sales');

  console.log('\n=== company_products (used by In Sales tab) ===');
  console.log('Count:', pipeCount);

  // The default view groups by projectionData
  const selectedProcessData = processes?.find(p => p.process_type === selectedProcess);
  const selectedProcessStages = processStages?.filter(s => s.process_id === selectedProcessData?.id) || [];

  console.log('\n=== Default View Analysis ===');
  console.log('Selected process:', selectedProcessData?.name);
  console.log('Selected process stages:', selectedProcessStages?.length);

  const projectionByStage = selectedProcessStages.map(stage => ({
    name: stage.name,
    companies: (projectionData || []).filter(p =>
      p.current_process_type === selectedProcess &&
      p.current_stage_id === stage.id
    ),
  }));

  console.log('projectionByStage:');
  projectionByStage.forEach(s => console.log(`  - ${s.name}: ${s.companies.length} companies`));

  console.log('\n=== DIAGNOSIS ===');
  if (projCount === 0) {
    console.log('❌ company_product_read_model is EMPTY!');
    console.log('   The default "pipeline" view uses this table.');
    console.log('   Click "In Sales" tab to see the data from company_products.');
    console.log('   Or populate the read model with a projector.');
  }
}

debug().then(() => process.exit(0));
