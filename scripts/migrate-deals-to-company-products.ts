/**
 * PHASE 4: Migrate deals to company_products
 *
 * Migrates ALL legacy deals to X-RAI 2.0 product, "Preview Ready" stage
 *
 * For each open deal:
 * 1. Create/update company_product for company + X-RAI 2.0
 * 2. Set to "Preview Ready" stage
 * 3. Copy owner, value, notes to metadata
 * 4. Mark deal as migrated
 *
 * RUN: npx tsx scripts/migrate-deals-to-company-products.ts
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

// TARGET: X-RAI 2.0 product and "Preview Ready" stage
const TARGET_PRODUCT_ID = '3a85b501-2f05-43f3-8d6f-7a2927375ddf';
const TARGET_STAGE_ID = 'b834a4b5-ba2b-4f13-8f36-f8bcb85b9af3'; // Preview Ready

interface Deal {
  id: string;
  company_id: string | null;
  name: string;
  stage: string;
  owner_id: string;
  estimated_value: number | null;
  expected_close_date: string | null;
  health_score: number | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  created_at: string;
  updated_at: string;
  stage_entered_at: string | null;
  primary_product_category_id?: string;
  deal_type?: string;
  converted_to_company_product_ids?: string[];
  company?: { id: string; name: string } | { id: string; name: string }[] | null;
}

async function migrate() {
  console.log('=== PHASE 4: Migrate Deals to Company Products ===\n');
  console.log(`Target: X-RAI 2.0 (${TARGET_PRODUCT_ID})`);
  console.log(`Stage: Preview Ready (${TARGET_STAGE_ID})\n`);

  // Get all non-migrated deals (not closed_won/closed_lost and not already converted)
  const { data: deals, error: fetchError } = await supabase
    .from('deals')
    .select(`
      *,
      company:companies(id, name)
    `)
    .not('stage', 'in', '(closed_won,closed_lost)')
    .is('converted_to_company_product_ids', null);

  if (fetchError) {
    console.error('Failed to fetch deals:', fetchError);
    process.exit(1);
  }

  console.log(`Found ${deals?.length || 0} deals to migrate\n`);

  if (!deals || deals.length === 0) {
    console.log('No deals to migrate. Done.');
    return;
  }

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const deal of deals as Deal[]) {
    const company = Array.isArray(deal.company) ? deal.company[0] : deal.company;
    console.log(`\nProcessing: ${deal.name} (${company?.name || 'No company'})`);

    // Skip if no company
    if (!deal.company_id) {
      console.log('  ⚠️ Skipping: No company_id');
      skipped++;
      continue;
    }

    // Check if company_product already exists for this company + X-RAI 2.0
    const { data: existing } = await supabase
      .from('company_products')
      .select('id, status')
      .eq('company_id', deal.company_id)
      .eq('product_id', TARGET_PRODUCT_ID)
      .single();

    if (existing) {
      // Only update if not already active
      if (existing.status === 'active') {
        console.log('  ⚠️ Skipping: Already active customer');
        skipped++;
        continue;
      }

      // Update existing to use Preview Ready stage
      const { error: updateError } = await supabase
        .from('company_products')
        .update({
          current_stage_id: TARGET_STAGE_ID,
          stage_entered_at: deal.stage_entered_at || deal.updated_at || deal.created_at,
          owner_user_id: deal.owner_id,
          mrr: deal.estimated_value,
          close_confidence: deal.health_score,
          expected_close_date: deal.expected_close_date,
          last_human_touch_at: deal.updated_at,
          status: 'in_sales',
          metadata: {
            migrated_from_deal: deal.id,
            deal_name: deal.name,
            deal_type: deal.deal_type,
            original_stage: deal.stage,
            trial_start_date: deal.trial_start_date,
            trial_end_date: deal.trial_end_date,
          },
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('  ❌ Update failed:', updateError);
        errors++;
      } else {
        console.log('  ✅ Updated existing company_product');
        migrated++;

        // Mark deal as converted
        await supabase
          .from('deals')
          .update({
            converted_to_company_product_ids: [existing.id],
            conversion_status: 'converted',
            converted_at: new Date().toISOString(),
          })
          .eq('id', deal.id);
      }
    } else {
      // Create new company_product for X-RAI 2.0 in Preview Ready stage
      const { data: newCp, error: insertError } = await supabase
        .from('company_products')
        .insert({
          company_id: deal.company_id,
          product_id: TARGET_PRODUCT_ID,
          current_stage_id: TARGET_STAGE_ID,
          stage_entered_at: deal.stage_entered_at || deal.updated_at || deal.created_at,
          owner_user_id: deal.owner_id,
          mrr: deal.estimated_value,
          close_confidence: deal.health_score,
          expected_close_date: deal.expected_close_date,
          last_human_touch_at: deal.updated_at,
          status: 'in_sales',
          sales_started_at: deal.created_at,
          metadata: {
            migrated_from_deal: deal.id,
            deal_name: deal.name,
            deal_type: deal.deal_type,
            original_stage: deal.stage,
            trial_start_date: deal.trial_start_date,
            trial_end_date: deal.trial_end_date,
          },
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('  ❌ Insert failed:', insertError);
        errors++;
      } else {
        console.log('  ✅ Created new company_product');
        migrated++;

        // Mark deal as converted
        await supabase
          .from('deals')
          .update({
            converted_to_company_product_ids: [newCp.id],
            conversion_status: 'converted',
            converted_at: new Date().toISOString(),
          })
          .eq('id', deal.id);
      }
    }
  }

  console.log('\n=== MIGRATION SUMMARY ===');
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (errors > 0) {
    console.error('\n⚠️ Some errors occurred. Please review the logs above.');
    process.exit(1);
  }

  console.log('\n✅ Migration complete!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
