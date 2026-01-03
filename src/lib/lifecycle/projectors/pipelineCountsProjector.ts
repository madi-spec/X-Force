/**
 * Product Pipeline Stage Counts Projector
 *
 * Projects aggregated counts per stage for fast kanban rendering.
 * This is a DERIVED projection - rebuilt from company_product_read_model.
 *
 * STRATEGY:
 * Unlike other projectors that process events incrementally, this projector
 * is more efficient when rebuilt from the read model periodically.
 *
 * WHY REBUILD INSTEAD OF INCREMENT:
 * 1. Counts are aggregates - rebuilding is O(stages) not O(events)
 * 2. Incrementing requires tracking "was in stage X, now in stage Y"
 * 3. Rebuilding ensures correctness even after bugs or data fixes
 * 4. Kanban doesn't need real-time - seconds of delay is fine
 *
 * METRICS CALCULATED:
 * - total_count: All company products in this stage
 * - active_count: Not stalled (under SLA warning threshold)
 * - stalled_count: In SLA warning zone
 * - breached_count: Over SLA deadline
 * - avg_days_in_stage: Average days spent in stage
 */

import type { EventStore } from '@/types/eventSourcing';
import type { Projector, AnySupabaseClient } from './core';

// ============================================================================
// PROJECTOR IMPLEMENTATION
// ============================================================================

export const ProductPipelineStageCountsProjector: Projector = {
  name: 'product_pipeline_stage_counts',
  aggregateTypes: ['CompanyProduct'],

  async processEvent(supabase: AnySupabaseClient, event: EventStore): Promise<void> {
    // This projector rebuilds on batch completion, not per event
    // Individual event processing is a no-op
    // The afterBatch hook triggers the rebuild
  },

  async afterBatch(supabase: AnySupabaseClient): Promise<void> {
    // Rebuild counts from current read model state
    await rebuildPipelineCounts(supabase);
  },

  async clear(supabase: AnySupabaseClient): Promise<void> {
    const { error } = await supabase
      .from('product_pipeline_stage_counts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to clear pipeline counts: ${error.message}`);
    }
  },
};

/**
 * Rebuilds all pipeline stage counts from the read model.
 */
export async function rebuildPipelineCounts(supabase: AnySupabaseClient): Promise<void> {
  // Get all unique product/process/stage combinations from read model
  const { data: readModels, error: rmError } = await supabase
    .from('company_product_read_model')
    .select(`
      product_id,
      current_process_id,
      current_process_type,
      current_stage_id,
      current_stage_name,
      days_in_current_stage,
      is_sla_warning,
      is_sla_breached,
      process_completed_at
    `)
    .not('current_stage_id', 'is', null)
    .is('process_completed_at', null); // Only active processes

  if (rmError) {
    throw new Error(`Failed to fetch read models: ${rmError.message}`);
  }

  if (!readModels || readModels.length === 0) {
    // No active processes - clear all counts
    await supabase
      .from('product_pipeline_stage_counts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    return;
  }

  // Aggregate counts by product/process/stage
  const countsMap = new Map<string, {
    product_id: string;
    process_id: string;
    process_type: string;
    stage_id: string;
    stage_name: string;
    total_count: number;
    active_count: number;
    stalled_count: number;
    breached_count: number;
    days_sum: number;
    days_count: number;
  }>();

  for (const rm of readModels) {
    if (!rm.current_process_id || !rm.current_stage_id) continue;

    const key = `${rm.product_id}:${rm.current_process_id}:${rm.current_stage_id}`;

    if (!countsMap.has(key)) {
      countsMap.set(key, {
        product_id: rm.product_id,
        process_id: rm.current_process_id,
        process_type: rm.current_process_type,
        stage_id: rm.current_stage_id,
        stage_name: rm.current_stage_name || 'Unknown',
        total_count: 0,
        active_count: 0,
        stalled_count: 0,
        breached_count: 0,
        days_sum: 0,
        days_count: 0,
      });
    }

    const counts = countsMap.get(key)!;
    counts.total_count++;

    if (rm.is_sla_breached) {
      counts.breached_count++;
    } else if (rm.is_sla_warning) {
      counts.stalled_count++;
    } else {
      counts.active_count++;
    }

    if (rm.days_in_current_stage !== null) {
      counts.days_sum += rm.days_in_current_stage;
      counts.days_count++;
    }
  }

  // Get stage orders from product_process_stages
  const stageIds = [...new Set([...countsMap.values()].map(c => c.stage_id))];

  const { data: stages } = await supabase
    .from('product_process_stages')
    .select('id, stage_order')
    .in('id', stageIds);

  const stageOrderMap = new Map<string, number>();
  if (stages) {
    for (const stage of stages) {
      stageOrderMap.set(stage.id, stage.stage_order);
    }
  }

  // Build upsert records
  const records = [...countsMap.values()].map(counts => ({
    product_id: counts.product_id,
    process_id: counts.process_id,
    process_type: counts.process_type,
    stage_id: counts.stage_id,
    stage_name: counts.stage_name,
    stage_order: stageOrderMap.get(counts.stage_id) || 0,
    total_count: counts.total_count,
    active_count: counts.active_count,
    stalled_count: counts.stalled_count,
    breached_count: counts.breached_count,
    avg_days_in_stage: counts.days_count > 0 ? counts.days_sum / counts.days_count : null,
    projected_at: new Date().toISOString(),
  }));

  if (records.length === 0) {
    return;
  }

  // Delete existing counts for products we're updating
  const productIds = [...new Set(records.map(r => r.product_id))];

  const { error: deleteError } = await supabase
    .from('product_pipeline_stage_counts')
    .delete()
    .in('product_id', productIds);

  if (deleteError) {
    throw new Error(`Failed to delete old counts: ${deleteError.message}`);
  }

  // Insert new counts
  const { error: insertError } = await supabase
    .from('product_pipeline_stage_counts')
    .insert(records);

  if (insertError) {
    throw new Error(`Failed to insert pipeline counts: ${insertError.message}`);
  }
}

/**
 * Rebuilds counts for a specific product only.
 * More efficient for single-product updates.
 */
export async function rebuildProductPipelineCounts(
  supabase: AnySupabaseClient,
  productId: string
): Promise<void> {
  // Get read models for this product
  const { data: readModels, error: rmError } = await supabase
    .from('company_product_read_model')
    .select(`
      current_process_id,
      current_process_type,
      current_stage_id,
      current_stage_name,
      days_in_current_stage,
      is_sla_warning,
      is_sla_breached,
      process_completed_at
    `)
    .eq('product_id', productId)
    .not('current_stage_id', 'is', null)
    .is('process_completed_at', null);

  if (rmError) {
    throw new Error(`Failed to fetch read models: ${rmError.message}`);
  }

  // Delete existing counts for this product
  const { error: deleteError } = await supabase
    .from('product_pipeline_stage_counts')
    .delete()
    .eq('product_id', productId);

  if (deleteError) {
    throw new Error(`Failed to delete old counts: ${deleteError.message}`);
  }

  if (!readModels || readModels.length === 0) {
    return;
  }

  // Aggregate counts by process/stage
  const countsMap = new Map<string, {
    process_id: string;
    process_type: string;
    stage_id: string;
    stage_name: string;
    total_count: number;
    active_count: number;
    stalled_count: number;
    breached_count: number;
    days_sum: number;
    days_count: number;
  }>();

  for (const rm of readModels) {
    if (!rm.current_process_id || !rm.current_stage_id) continue;

    const key = `${rm.current_process_id}:${rm.current_stage_id}`;

    if (!countsMap.has(key)) {
      countsMap.set(key, {
        process_id: rm.current_process_id,
        process_type: rm.current_process_type,
        stage_id: rm.current_stage_id,
        stage_name: rm.current_stage_name || 'Unknown',
        total_count: 0,
        active_count: 0,
        stalled_count: 0,
        breached_count: 0,
        days_sum: 0,
        days_count: 0,
      });
    }

    const counts = countsMap.get(key)!;
    counts.total_count++;

    if (rm.is_sla_breached) {
      counts.breached_count++;
    } else if (rm.is_sla_warning) {
      counts.stalled_count++;
    } else {
      counts.active_count++;
    }

    if (rm.days_in_current_stage !== null) {
      counts.days_sum += rm.days_in_current_stage;
      counts.days_count++;
    }
  }

  // Get stage orders
  const stageIds = [...new Set([...countsMap.values()].map(c => c.stage_id))];

  const { data: stages } = await supabase
    .from('product_process_stages')
    .select('id, stage_order')
    .in('id', stageIds);

  const stageOrderMap = new Map<string, number>();
  if (stages) {
    for (const stage of stages) {
      stageOrderMap.set(stage.id, stage.stage_order);
    }
  }

  // Build insert records
  const records = [...countsMap.values()].map(counts => ({
    product_id: productId,
    process_id: counts.process_id,
    process_type: counts.process_type,
    stage_id: counts.stage_id,
    stage_name: counts.stage_name,
    stage_order: stageOrderMap.get(counts.stage_id) || 0,
    total_count: counts.total_count,
    active_count: counts.active_count,
    stalled_count: counts.stalled_count,
    breached_count: counts.breached_count,
    avg_days_in_stage: counts.days_count > 0 ? counts.days_sum / counts.days_count : null,
    projected_at: new Date().toISOString(),
  }));

  if (records.length === 0) {
    return;
  }

  // Insert new counts
  const { error: insertError } = await supabase
    .from('product_pipeline_stage_counts')
    .insert(records);

  if (insertError) {
    throw new Error(`Failed to insert pipeline counts: ${insertError.message}`);
  }
}
