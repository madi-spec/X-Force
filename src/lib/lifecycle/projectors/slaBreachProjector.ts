/**
 * SLA Breach Facts Projector
 *
 * Projects SLA breach events into the sla_breach_facts table.
 * Tracks breach history for analytics and reporting.
 *
 * DERIVED FROM EVENTS:
 * - CompanyProductSLABreached → creates breach fact
 * - CompanyProductStageSet → resolves breach if moved to new stage
 *
 * IDEMPOTENCY:
 * - Checks for existing breach_event_id before insert
 * - Same event applied twice produces same result
 */

import type { EventStore } from '@/types/eventSourcing';
import type { Projector, AnySupabaseClient } from './core';

// ============================================================================
// EVENT DATA TYPES
// ============================================================================

interface SLABreachedEventData {
  stageId: string;
  stageName: string;
  slaDays: number;
  actualDays: number;
  daysOver: number;
}

interface StageSetEventData {
  fromStageId: string | null;
  toStageId: string;
}

// ============================================================================
// PROJECTOR IMPLEMENTATION
// ============================================================================

export const SLABreachFactsProjector: Projector = {
  name: 'sla_breach_facts',
  aggregateTypes: ['CompanyProduct'],

  async processEvent(supabase: AnySupabaseClient, event: EventStore): Promise<void> {
    const aggregateId = event.aggregate_id;

    // Handle SLA breach events
    if (event.event_type === 'CompanyProductSLABreached') {
      const data = event.event_data as unknown as SLABreachedEventData;

      // Fetch company_id and product_id from company_products
      const { data: companyProduct, error: cpError } = await supabase
        .from('company_products')
        .select('company_id, product_id')
        .eq('id', aggregateId)
        .single();

      if (cpError) {
        if (cpError.code === 'PGRST116') {
          console.warn(`CompanyProduct ${aggregateId} not found - skipping event ${event.id}`);
          return;
        }
        throw new Error(`Failed to fetch company_product: ${cpError.message}`);
      }

      // Get process type from stage
      const { data: stage } = await supabase
        .from('product_process_stages')
        .select('process:product_processes!inner(process_type)')
        .eq('id', data.stageId)
        .single();

      const processType = (stage?.process as unknown as { process_type: string })?.process_type || 'sales';

      // Check if breach fact already exists for this event (idempotency)
      const { data: existing } = await supabase
        .from('sla_breach_facts')
        .select('id')
        .eq('breach_event_id', event.id)
        .limit(1);

      if (existing && existing.length > 0) {
        // Already processed this event, skip
        return;
      }

      // Insert breach fact
      const { error } = await supabase
        .from('sla_breach_facts')
        .insert({
          company_product_id: aggregateId,
          company_id: companyProduct.company_id,
          product_id: companyProduct.product_id,
          stage_id: data.stageId,
          stage_name: data.stageName,
          process_type: processType,
          sla_days: data.slaDays,
          actual_days: data.actualDays,
          days_over: data.daysOver,
          breached_at: event.occurred_at,
          resolved_at: null,
          breach_event_id: event.id,
          resolution_event_id: null,
          projected_at: new Date().toISOString(),
        });

      if (error) {
        throw new Error(`Failed to insert SLA breach fact: ${error.message}`);
      }
    }

    // Handle stage transitions - resolve any open breaches for the old stage
    if (event.event_type === 'CompanyProductStageSet') {
      const data = event.event_data as unknown as StageSetEventData;

      if (data.fromStageId) {
        // Mark any unresolved breaches for the old stage as resolved
        const { error } = await supabase
          .from('sla_breach_facts')
          .update({
            resolved_at: event.occurred_at,
            resolution_event_id: event.id,
            projected_at: new Date().toISOString(),
          })
          .eq('company_product_id', aggregateId)
          .eq('stage_id', data.fromStageId)
          .is('resolved_at', null);

        if (error) {
          throw new Error(`Failed to resolve SLA breach: ${error.message}`);
        }
      }
    }
  },

  async clear(supabase: AnySupabaseClient): Promise<void> {
    // Delete all SLA breach facts for rebuild
    const { error } = await supabase
      .from('sla_breach_facts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to clear SLA breach facts: ${error.message}`);
    }
  },
};
