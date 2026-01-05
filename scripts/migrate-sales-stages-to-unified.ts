/**
 * PHASE 1.2: Migrate product_sales_stages data to product_process_stages
 *
 * This script:
 * 1. Creates product_processes entries for products with sales stages (if missing)
 * 2. Copies all stage data including pitch points, objection handlers, etc.
 * 3. Preserves original IDs to maintain FK references
 * 4. Is idempotent - safe to run multiple times
 *
 * RUN: npx tsx scripts/migrate-sales-stages-to-unified.ts
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

interface SalesStage {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  stage_order: number;
  goal: string | null;
  description: string | null;
  ai_sequence_id: string | null;
  ai_actions: unknown[] | null;
  pitch_points: unknown[] | null;
  objection_handlers: unknown[] | null;
  resources: unknown[] | null;
  exit_criteria: string | null;
  exit_actions: unknown | null;
  avg_days_in_stage: number | null;
  conversion_rate: number | null;
  ai_suggested_pitch_points: unknown[] | null;
  ai_suggested_objections: unknown[] | null;
  ai_insights: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  product?: { id: string; name: string; slug: string };
}

async function migrate() {
  console.log('=== PHASE 1.2: Migrate Sales Stages to Unified Table ===\n');
  console.log(`Supabase URL: ${supabaseUrl}\n`);

  // Step 1: Get all products with sales stages
  const { data: salesStages, error: fetchError } = await supabase
    .from('product_sales_stages')
    .select('*, product:products(id, name, slug)')
    .order('product_id')
    .order('stage_order');

  if (fetchError) {
    console.error('Failed to fetch sales stages:', fetchError);
    process.exit(1);
  }

  console.log(`Found ${salesStages?.length || 0} sales stages to migrate\n`);

  if (!salesStages || salesStages.length === 0) {
    console.log('No sales stages to migrate. Done.');
    return;
  }

  // Step 2: Group by product
  const byProduct = new Map<string, SalesStage[]>();
  for (const stage of salesStages as SalesStage[]) {
    const productId = stage.product_id;
    if (!byProduct.has(productId)) {
      byProduct.set(productId, []);
    }
    byProduct.get(productId)!.push(stage);
  }

  console.log(`Migrating stages for ${byProduct.size} products\n`);

  let totalMigrated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  // Step 3: Process each product
  for (const [productId, stages] of byProduct) {
    const productName = stages[0]?.product?.name || productId;
    console.log(`\n--- Product: ${productName} (${stages.length} stages) ---`);

    // 3a: Ensure product_processes entry exists
    const { data: existingProcess } = await supabase
      .from('product_processes')
      .select('id')
      .eq('product_id', productId)
      .eq('process_type', 'sales')
      .single();

    let processId: string;

    if (existingProcess) {
      processId = existingProcess.id;
      console.log(`  Using existing process: ${processId}`);
    } else {
      const { data: newProcess, error: createError } = await supabase
        .from('product_processes')
        .insert({
          product_id: productId,
          process_type: 'sales',
          name: 'Sales Process',
          status: 'published',
          version: 1,
        })
        .select('id')
        .single();

      if (createError) {
        console.error(`  Failed to create process:`, createError);
        totalErrors++;
        continue;
      }

      processId = newProcess.id;
      console.log(`  Created new process: ${processId}`);
    }

    // 3b: Migrate each stage
    for (const stage of stages) {
      // Check if already migrated (by checking if stage exists in unified table)
      const { data: existing } = await supabase
        .from('product_process_stages')
        .select('id')
        .eq('id', stage.id)
        .single();

      // Determine terminal status from slug
      const isTerminal = ['closed_won', 'closed_lost', 'churned', 'cancelled'].includes(stage.slug);
      const terminalType = stage.slug === 'closed_won' ? 'won' :
                          stage.slug === 'closed_lost' ? 'lost' :
                          stage.slug === 'churned' ? 'churned' :
                          stage.slug === 'cancelled' ? 'cancelled' : null;

      if (existing) {
        // Update existing with sales-specific fields
        const { error: updateError } = await supabase
          .from('product_process_stages')
          .update({
            goal: stage.goal,
            pitch_points: stage.pitch_points || [],
            objection_handlers: stage.objection_handlers || [],
            resources: stage.resources || [],
            ai_suggested_pitch_points: stage.ai_suggested_pitch_points || [],
            ai_suggested_objections: stage.ai_suggested_objections || [],
            ai_insights: stage.ai_insights || {},
            avg_days_in_stage: stage.avg_days_in_stage,
            conversion_rate: stage.conversion_rate,
            ai_sequence_id: stage.ai_sequence_id,
            ai_actions: stage.ai_actions || [],
            exit_actions: stage.exit_actions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', stage.id);

        if (updateError) {
          console.error(`  Failed to update stage ${stage.name}:`, updateError);
          totalErrors++;
        } else {
          console.log(`  Updated: ${stage.name}`);
          totalUpdated++;
        }
      } else {
        // Insert new stage (omit config - uses default, avoids schema cache issue)
        const { error: insertError } = await supabase
          .from('product_process_stages')
          .insert({
            id: stage.id, // Preserve original ID for FK references
            process_id: processId,
            name: stage.name,
            slug: stage.slug,
            stage_order: stage.stage_order,
            goal: stage.goal,
            description: stage.description,
            is_terminal: isTerminal,
            terminal_type: terminalType,
            pitch_points: stage.pitch_points || [],
            objection_handlers: stage.objection_handlers || [],
            resources: stage.resources || [],
            ai_suggested_pitch_points: stage.ai_suggested_pitch_points || [],
            ai_suggested_objections: stage.ai_suggested_objections || [],
            ai_insights: stage.ai_insights || {},
            avg_days_in_stage: stage.avg_days_in_stage,
            conversion_rate: stage.conversion_rate,
            ai_sequence_id: stage.ai_sequence_id,
            ai_actions: stage.ai_actions || [],
            exit_actions: stage.exit_actions,
            created_at: stage.created_at,
            updated_at: stage.updated_at,
          });

        if (insertError) {
          console.error(`  Failed to insert stage ${stage.name}:`, insertError);
          console.error(`  Error details:`, JSON.stringify(insertError, null, 2));
          totalErrors++;
        } else {
          console.log(`  Inserted: ${stage.name}`);
          totalMigrated++;
        }
      }
    }
  }

  console.log('\n=== MIGRATION SUMMARY ===');
  console.log(`New stages inserted: ${totalMigrated}`);
  console.log(`Existing stages updated: ${totalUpdated}`);
  console.log(`Errors: ${totalErrors}`);

  if (totalErrors === 0) {
    console.log('\n✅ Migration completed successfully!');
  } else {
    console.log('\n⚠️ Migration completed with errors. Please review the output above.');
    process.exit(1);
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
