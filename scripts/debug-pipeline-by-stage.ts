import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const slug = 'xrai-2';

  console.log('=== Simulating Page Query Exactly ===\n');

  // Step 1: Get product (same as page)
  const { data: product } = await supabase
    .from('products')
    .select('*, tiers:product_tiers(*), modules:products!parent_product_id(*)')
    .eq('slug', slug)
    .single();

  console.log('Product:', product?.name, product?.id);

  // Step 2: Get processes (same as page)
  const { data: processes } = await supabase
    .from('product_processes')
    .select('id, name, process_type, version, status')
    .eq('product_id', product?.id)
    .eq('status', 'published');

  console.log('Processes:', processes?.length);

  // Step 3: Get processStages (same as page)
  const processIds = processes?.map(p => p.id) || [];
  const { data: processStages } = processIds.length > 0
    ? await supabase
        .from('product_process_stages')
        .select('*')
        .in('process_id', processIds)
        .order('stage_order', { ascending: true })
    : { data: [] };

  console.log('processStages:', processStages?.length);

  // Step 4: Get sales stages (same as page lines 110-114)
  const salesProcess = processes?.find(p => p.process_type === 'sales');
  const stages = (processStages || [])
    .filter(s => s.process_id === salesProcess?.id)
    .sort((a, b) => a.stage_order - b.stage_order);

  console.log('salesProcess:', salesProcess?.id);
  console.log('stages (filtered):', stages.length);
  stages.forEach(s => console.log(`  - ${s.name} [${s.id}]`));

  // Step 5: Get pipeline (same as page lines 116-128)
  const { data: pipeline } = await supabase
    .from('company_products')
    .select(`
      *,
      company:companies(id, name, domain, city, state),
      current_stage:product_process_stages(id, name, slug, stage_order),
      owner_user:users(id, name)
    `)
    .eq('product_id', product?.id)
    .eq('status', 'in_sales')
    .order('stage_entered_at', { ascending: true });

  console.log('\npipeline count:', pipeline?.length);

  // Step 6: Create pipelineByStage (same as page lines 181-188)
  const pipelineByStage = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    slug: stage.slug,
    stage_order: stage.stage_order,
    goal: stage.goal ?? null,
    companies: (pipeline || []).filter((p) => p.current_stage_id === stage.id),
  }));

  console.log('\npipelineByStage:');
  pipelineByStage.forEach(s => {
    console.log(`  - ${s.name}: ${s.companies.length} companies`);
  });

  const total = pipelineByStage.reduce((sum, s) => sum + s.companies.length, 0);
  console.log('\nTotal in pipeline:', total);
}

debug().then(() => process.exit(0));
