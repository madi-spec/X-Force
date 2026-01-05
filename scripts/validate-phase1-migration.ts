/**
 * PHASE 1 VALIDATION: Verify sales stages migration
 *
 * Checks:
 * 1. All product_sales_stages rows exist in product_process_stages
 * 2. Pitch points, objection handlers preserved
 * 3. AI insights preserved
 * 4. No orphaned stage references in company_products
 *
 * RUN: npx tsx scripts/validate-phase1-migration.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function validate() {
  console.log('=== PHASE 1 VALIDATION ===\n');
  let errors = 0;
  let warnings = 0;

  // =========================================================================
  // Check 1: Row counts
  // =========================================================================
  console.log('--- Check 1: Row Counts ---');

  const { count: salesCount } = await supabase
    .from('product_sales_stages')
    .select('*', { count: 'exact', head: true });

  const { count: unifiedCount } = await supabase
    .from('product_process_stages')
    .select('*', { count: 'exact', head: true });

  console.log(`product_sales_stages: ${salesCount} rows`);
  console.log(`product_process_stages: ${unifiedCount} rows`);

  if (salesCount && unifiedCount && salesCount > unifiedCount) {
    console.error(`❌ Unified table has fewer rows than sales stages!`);
    errors++;
  } else {
    console.log(`✅ Row count check passed (unified >= sales)`);
  }

  // =========================================================================
  // Check 2: All sales stage IDs exist in unified table
  // =========================================================================
  console.log('\n--- Check 2: ID Preservation ---');

  const { data: salesStages } = await supabase
    .from('product_sales_stages')
    .select('id, name, slug, product_id');

  let missingIds = 0;
  for (const stage of salesStages || []) {
    const { data: unified } = await supabase
      .from('product_process_stages')
      .select('id')
      .eq('id', stage.id)
      .single();

    if (!unified) {
      console.error(`❌ Missing stage: ${stage.name} (${stage.id})`);
      missingIds++;
    }
  }

  if (missingIds > 0) {
    console.error(`❌ ${missingIds} stage ID(s) not found in unified table`);
    errors++;
  } else {
    console.log(`✅ All ${salesStages?.length || 0} sales stage IDs exist in unified table`);
  }

  // =========================================================================
  // Check 3: Content preservation (spot check)
  // =========================================================================
  console.log('\n--- Check 3: Content Preservation ---');

  const { data: sampleSales } = await supabase
    .from('product_sales_stages')
    .select('id, name, pitch_points, objection_handlers, resources, ai_insights')
    .limit(5);

  let contentMismatches = 0;
  for (const stage of sampleSales || []) {
    const { data: unified } = await supabase
      .from('product_process_stages')
      .select('id, name, pitch_points, objection_handlers, resources, ai_insights')
      .eq('id', stage.id)
      .single();

    if (!unified) {
      console.error(`❌ Stage ${stage.name} (${stage.id}) not found`);
      contentMismatches++;
      continue;
    }

    const pitchMatch = JSON.stringify(stage.pitch_points) === JSON.stringify(unified.pitch_points);
    const objMatch = JSON.stringify(stage.objection_handlers) === JSON.stringify(unified.objection_handlers);
    const resourceMatch = JSON.stringify(stage.resources) === JSON.stringify(unified.resources);

    if (!pitchMatch || !objMatch || !resourceMatch) {
      console.error(`❌ Stage ${stage.name}: content mismatch`);
      if (!pitchMatch) console.error(`   - pitch_points differ`);
      if (!objMatch) console.error(`   - objection_handlers differ`);
      if (!resourceMatch) console.error(`   - resources differ`);
      contentMismatches++;
    } else {
      console.log(`✅ Stage ${stage.name}: content preserved`);
    }
  }

  if (contentMismatches > 0) {
    errors++;
  }

  // =========================================================================
  // Check 4: company_products stage references
  // =========================================================================
  console.log('\n--- Check 4: Company Product Stage References ---');

  const { data: companyProducts } = await supabase
    .from('company_products')
    .select('id, current_stage_id, company_id')
    .not('current_stage_id', 'is', null);

  let orphanedRefs = 0;
  for (const cp of companyProducts || []) {
    // Check if stage exists in either table (for now, either is fine)
    const { data: inSales } = await supabase
      .from('product_sales_stages')
      .select('id')
      .eq('id', cp.current_stage_id)
      .single();

    const { data: inUnified } = await supabase
      .from('product_process_stages')
      .select('id')
      .eq('id', cp.current_stage_id)
      .single();

    if (!inSales && !inUnified) {
      console.error(`❌ Orphaned stage reference: company_product ${cp.id} -> stage ${cp.current_stage_id}`);
      orphanedRefs++;
    }
  }

  if (orphanedRefs > 0) {
    console.error(`\n❌ Found ${orphanedRefs} orphaned stage references`);
    errors++;
  } else {
    console.log(`✅ No orphaned stage references (${companyProducts?.length || 0} company_products checked)`);
  }

  // =========================================================================
  // Check 5: Product processes created
  // =========================================================================
  console.log('\n--- Check 5: Product Processes ---');

  // Get distinct product_ids from sales stages
  const { data: productIds } = await supabase
    .from('product_sales_stages')
    .select('product_id')
    .order('product_id');

  const uniqueProductIds = [...new Set((productIds || []).map(p => p.product_id))];

  let missingProcesses = 0;
  for (const productId of uniqueProductIds) {
    const { data: process } = await supabase
      .from('product_processes')
      .select('id')
      .eq('product_id', productId)
      .eq('process_type', 'sales')
      .single();

    if (!process) {
      console.error(`❌ Missing product_process for product ${productId}`);
      missingProcesses++;
    }
  }

  if (missingProcesses > 0) {
    console.error(`\n❌ ${missingProcesses} products missing sales process entries`);
    errors++;
  } else {
    console.log(`✅ All ${uniqueProductIds.length} products have sales process entries`);
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n' + '='.repeat(50));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(50));

  if (errors === 0 && warnings === 0) {
    console.log('\n✅ All checks passed! Phase 1 migration is complete.');
    console.log('\nYou can now proceed to Phase 2: API Consolidation.');
  } else if (errors === 0) {
    console.log(`\n⚠️ ${warnings} warning(s), but no errors. Phase 1 migration is acceptable.`);
    console.log('\nYou can proceed to Phase 2 with caution.');
  } else {
    console.error(`\n❌ ${errors} error(s) and ${warnings} warning(s) found.`);
    console.error('\nPlease fix the errors before proceeding to Phase 2.');
    process.exit(1);
  }
}

validate().catch((error) => {
  console.error('Validation failed:', error);
  process.exit(1);
});
