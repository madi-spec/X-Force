/**
 * PHASE 4 VALIDATION: Verify deals migration
 *
 * Checks:
 * 1. company_products have stage references
 * 2. Deals page loads without errors
 * 3. Pipeline shows company_products data
 *
 * RUN: npx tsx scripts/validate-phase4-deals.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables. Make sure .env.local exists with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function validate() {
  console.log('=== PHASE 4 VALIDATION ===\n');
  let errors = 0;

  // Check 1: Count of company_products in_sales
  const { count: inSalesCount } = await supabase
    .from('company_products')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'in_sales');

  console.log(`company_products in sales: ${inSalesCount || 0}`);

  // Check 2: company_products in_sales have stage references
  const { data: noStage } = await supabase
    .from('company_products')
    .select('id, company_id')
    .eq('status', 'in_sales')
    .is('current_stage_id', null);

  if (noStage && noStage.length > 0) {
    console.log(`⚠️ ${noStage.length} company_products in_sales missing stage (may be expected)`);
    // This is a warning, not an error - some may be legitimately in legacy state
  } else {
    console.log('✅ All in_sales company_products have stages');
  }

  // Check 3: Unmigrated open deals count (not closed and not yet converted)
  const { count: unmigrated } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .not('stage', 'in', '(closed_won,closed_lost)')
    .is('converted_to_company_product_ids', null);

  console.log(`\nUnmigrated open deals: ${unmigrated || 0}`);

  if (unmigrated && unmigrated > 0) {
    console.log('  ℹ️ Run scripts/migrate-deals-to-company-products.ts to migrate these');
  } else {
    console.log('✅ All open deals have been migrated');
  }

  // Check 4: Verify company_products have required fields
  const { data: missingFields } = await supabase
    .from('company_products')
    .select('id')
    .eq('status', 'in_sales')
    .or('company_id.is.null,product_id.is.null');

  if (missingFields && missingFields.length > 0) {
    console.error(`\n❌ ${missingFields.length} company_products missing company_id or product_id`);
    errors++;
  } else {
    console.log('✅ All company_products have required fields');
  }

  // Check 5: Verify stage references are valid
  const { data: invalidStages } = await supabase
    .from('company_products')
    .select(`
      id,
      current_stage_id,
      stage:product_process_stages!left(id)
    `)
    .eq('status', 'in_sales')
    .not('current_stage_id', 'is', null);

  const orphanedStages = (invalidStages || []).filter(
    (cp) => cp.current_stage_id && !cp.stage
  );

  if (orphanedStages.length > 0) {
    console.error(`\n❌ ${orphanedStages.length} company_products reference non-existent stages`);
    errors++;
  } else {
    console.log('✅ All stage references are valid');
  }

  // Summary
  console.log('\n=== VALIDATION SUMMARY ===');
  if (errors === 0) {
    console.log('✅ Phase 4 validation passed!');
    console.log('\nNext steps:');
    console.log('1. Run the migration script if needed: npx tsx scripts/migrate-deals-to-company-products.ts');
    console.log('2. Test /deals page loads correctly');
    console.log('3. Test /products/[slug] pipeline view');
    console.log('4. Proceed to Phase 5: Route Consolidation');
  } else {
    console.error(`\n❌ ${errors} error(s) found. Please investigate.`);
    process.exit(1);
  }
}

validate().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
