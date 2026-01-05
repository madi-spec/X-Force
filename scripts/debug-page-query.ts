import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const slug = 'xrai-2';

  console.log('=== Debugging Product Page Query ===\n');

  // Step 1: Get product
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (productError || !product) {
    console.error('Product not found:', productError);
    return;
  }
  console.log('Product:', product.name, `(${product.id})`);

  // Step 2: Get processes
  const { data: processes } = await supabase
    .from('product_processes')
    .select('id, name, process_type, version, status')
    .eq('product_id', product.id)
    .eq('status', 'published');

  console.log('\nProcesses:', processes?.length || 0);
  processes?.forEach(p => console.log(`  - ${p.process_type}: ${p.name} (${p.status})`));

  // Step 3: Get process stages
  const processIds = processes?.map(p => p.id) || [];
  const { data: processStages } = processIds.length > 0
    ? await supabase
        .from('product_process_stages')
        .select('id, name, process_id, stage_order')
        .in('process_id', processIds)
        .order('stage_order')
    : { data: [] };

  console.log('\nProcess Stages:', processStages?.length || 0);
  processStages?.forEach(s => console.log(`  ${s.stage_order}. ${s.name} [${s.id}]`));

  // Step 4: Get pipeline
  const { data: pipeline, count } = await supabase
    .from('company_products')
    .select(`
      id,
      current_stage_id,
      company:companies(id, name),
      current_stage:product_process_stages(id, name, slug, stage_order)
    `, { count: 'exact' })
    .eq('product_id', product.id)
    .eq('status', 'in_sales');

  console.log('\nPipeline count:', count);
  console.log('Sample pipeline items:');
  pipeline?.slice(0, 5).forEach(p => {
    const company = Array.isArray(p.company) ? p.company[0] : p.company;
    const stage = Array.isArray(p.current_stage) ? p.current_stage[0] : p.current_stage;
    console.log(`  - ${company?.name}: stage_id=${p.current_stage_id}, stage=${stage?.name || 'NULL'}`);
  });

  // Step 5: Check stage matching
  const salesProcess = processes?.find(p => p.process_type === 'sales');
  const salesStages = (processStages || []).filter(s => s.process_id === salesProcess?.id);

  console.log('\nSales process ID:', salesProcess?.id);
  console.log('Sales stages count:', salesStages.length);

  // Check if pipeline stages match
  const stageIds = new Set(salesStages.map(s => s.id));
  const pipelineStageIds = new Set(pipeline?.map(p => p.current_stage_id).filter(Boolean));

  console.log('\nStage ID comparison:');
  console.log('  Sales stage IDs:', [...stageIds].slice(0, 3));
  console.log('  Pipeline stage IDs:', [...pipelineStageIds].slice(0, 3));

  const matching = [...pipelineStageIds].filter(id => stageIds.has(id));
  console.log('  Matching:', matching.length, 'of', pipelineStageIds.size);
}

debug().then(() => process.exit(0));
