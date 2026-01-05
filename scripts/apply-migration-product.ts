import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function applyMigration() {
  console.log('Creating X-RAI Migration product...');

  // 1. Create or update the migration product
  const { data: product, error: productError } = await supabase
    .from('products')
    .upsert({
      name: 'X-RAI 1.0 → 2.0 Migration',
      slug: 'xrai-migration',
      description: 'Migration pipeline for converting X-RAI 1.0 customers to X-RAI 2.0',
      product_type: 'suite',
      is_active: true,
      is_sellable: true,
      display_order: 15,
      color: '#F97316',
      icon: '🔄'
    }, { onConflict: 'slug' })
    .select()
    .single();

  if (productError) {
    console.error('Error creating product:', productError);
    return;
  }

  console.log('Product created:', product.name, product.id);

  // 2. Delete existing stages and create new ones
  await supabase
    .from('product_sales_stages')
    .delete()
    .eq('product_id', product.id);

  const stages = [
    { name: 'Engaging', slug: 'engaging', stage_order: 1, goal: 'Initial contact about upgrade opportunity' },
    { name: 'Demo', slug: 'demo', stage_order: 2, goal: 'Show X-RAI 2.0 platform and discuss advantages' },
    { name: 'Scheduled', slug: 'scheduled', stage_order: 3, goal: 'Transition date confirmed' }
  ];

  const { data: insertedStages, error: stagesError } = await supabase
    .from('product_sales_stages')
    .insert(stages.map(s => ({ ...s, product_id: product.id })))
    .select();

  if (stagesError) {
    console.error('Error creating stages:', stagesError);
    return;
  }

  console.log('Stages created:', insertedStages?.map(s => s.name).join(', '));

  const engagingStageId = insertedStages?.find(s => s.slug === 'engaging')?.id;

  // 3. Get X-RAI 1.0 and 2.0 product IDs
  const { data: xrai1 } = await supabase
    .from('products')
    .select('id')
    .eq('slug', 'xrai-1')
    .single();

  const { data: xrai2 } = await supabase
    .from('products')
    .select('id')
    .eq('slug', 'xrai-2')
    .single();

  if (!xrai1 || !xrai2) {
    console.error('Could not find X-RAI 1.0 or 2.0 products');
    return;
  }

  // 4. Find active X-RAI 1.0 customers not yet on X-RAI 2.0 or migration
  const { data: xrai1Customers } = await supabase
    .from('company_products')
    .select('company_id, mrr')
    .eq('product_id', xrai1.id)
    .eq('status', 'active');

  console.log(`Found ${xrai1Customers?.length || 0} active X-RAI 1.0 customers`);

  // 5. Filter out those already on X-RAI 2.0 or already in migration
  const { data: xrai2Customers } = await supabase
    .from('company_products')
    .select('company_id')
    .eq('product_id', xrai2.id)
    .not('status', 'in', '("declined","churned")');

  const { data: existingMigrations } = await supabase
    .from('company_products')
    .select('company_id')
    .eq('product_id', product.id);

  const xrai2CompanyIds = new Set(xrai2Customers?.map(c => c.company_id) || []);
  const migrationCompanyIds = new Set(existingMigrations?.map(c => c.company_id) || []);

  const customersToMigrate = (xrai1Customers || []).filter(
    c => !xrai2CompanyIds.has(c.company_id) && !migrationCompanyIds.has(c.company_id)
  );

  console.log(`${customersToMigrate.length} customers need migration records`);

  // 6. Create migration company_products
  if (customersToMigrate.length > 0) {
    const migrationRecords = customersToMigrate.map(c => ({
      company_id: c.company_id,
      product_id: product.id,
      status: 'in_sales',
      current_stage_id: engagingStageId,
      stage_entered_at: new Date().toISOString(),
      mrr: c.mrr,
      notes: 'Auto-created from X-RAI 1.0 active customer'
    }));

    const { error: insertError } = await supabase
      .from('company_products')
      .insert(migrationRecords);

    if (insertError) {
      console.error('Error creating migration records:', insertError);
      return;
    }

    console.log(`Created ${migrationRecords.length} migration records`);
  }

  console.log('\nMigration complete!');
}

applyMigration().catch(console.error);
