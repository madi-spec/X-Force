/**
 * SupportCase SLA Facts Projector
 *
 * Projects SLA-related events into support_case_sla_facts table.
 * Tracks SLA targets, met/breach status for analytics.
 *
 * DERIVED FROM EVENTS:
 * - SlaConfigured → creates SLA fact record
 * - AgentResponseSent (first response) → marks first_response SLA as met
 * - SupportCaseResolved → marks resolution SLA as met
 * - SlaBreached → marks SLA as breached
 *
 * IDEMPOTENCY:
 * - Uses sla_set_event_id as idempotency key
 * - Same event applied twice produces same result
 */

import type { EventStore } from '@/types/eventSourcing';
import type { Projector, AnySupabaseClient } from '@/lib/lifecycle/projectors/core';
import type {
  SlaConfiguredData,
  SlaBreachedData,
  SupportCaseResolvedData,
} from '../events';
import { SUPPORT_CASE_AGGREGATE_TYPE } from '../events';

// ============================================================================
// EVENT DATA TYPES
// ============================================================================

interface AgentResponseSentData {
  isFirstResponse: boolean;
  responseTimeMinutes?: number;
}

// ============================================================================
// PROJECTOR IMPLEMENTATION
// ============================================================================

export const SupportCaseSlaFactsProjector: Projector = {
  name: 'support_case_sla_facts',
  aggregateTypes: [SUPPORT_CASE_AGGREGATE_TYPE],

  async processEvent(supabase: AnySupabaseClient, event: EventStore): Promise<void> {
    const aggregateId = event.aggregate_id;

    // Handle SLA configured event - creates new SLA fact
    if (event.event_type === 'SlaConfigured') {
      const data = event.event_data as unknown as SlaConfiguredData;

      // Fetch support case details
      const { data: supportCase, error: scError } = await supabase
        .from('support_cases')
        .select('company_id, company_product_id')
        .eq('id', aggregateId)
        .single();

      if (scError) {
        if (scError.code === 'PGRST116') {
          console.warn(`SupportCase ${aggregateId} not found - skipping event ${event.id}`);
          return;
        }
        throw new Error(`Failed to fetch support_case: ${scError.message}`);
      }

      // Get current severity from read model
      const { data: readModel } = await supabase
        .from('support_case_read_model')
        .select('severity')
        .eq('support_case_id', aggregateId)
        .single();

      // Check for existing SLA fact (idempotency)
      const { data: existing } = await supabase
        .from('support_case_sla_facts')
        .select('id')
        .eq('sla_set_event_id', event.id)
        .limit(1);

      if (existing && existing.length > 0) {
        // Already processed
        return;
      }

      // Insert new SLA fact
      const { error: insertError } = await supabase
        .from('support_case_sla_facts')
        .insert({
          support_case_id: aggregateId,
          company_id: supportCase.company_id,
          company_product_id: supportCase.company_product_id,
          sla_type: data.slaType,
          severity: readModel?.severity || 'medium',
          target_hours: data.targetHours,
          due_at: data.dueAt,
          is_breached: false,
          sla_set_event_id: event.id,
          projected_at: new Date().toISOString(),
        });

      if (insertError) {
        throw new Error(`Failed to insert SLA fact: ${insertError.message}`);
      }
    }

    // Handle first response - marks first_response SLA as met
    if (event.event_type === 'AgentResponseSent') {
      const data = event.event_data as unknown as AgentResponseSentData;

      if (data.isFirstResponse) {
        // Find unmet first_response SLA for this case
        const { data: slaFact, error: findError } = await supabase
          .from('support_case_sla_facts')
          .select('id, due_at')
          .eq('support_case_id', aggregateId)
          .eq('sla_type', 'first_response')
          .is('met_at', null)
          .is('breached_at', null)
          .single();

        if (findError && findError.code !== 'PGRST116') {
          throw new Error(`Failed to find SLA fact: ${findError.message}`);
        }

        if (slaFact) {
          // Calculate actual hours
          const dueAt = new Date(slaFact.due_at);
          const metAt = new Date(event.occurred_at);
          const targetMs = dueAt.getTime() - metAt.getTime();
          // If we have responseTimeMinutes use it, otherwise calculate from creation
          const actualHours = data.responseTimeMinutes
            ? data.responseTimeMinutes / 60
            : null;

          const { error: updateError } = await supabase
            .from('support_case_sla_facts')
            .update({
              met_at: event.occurred_at,
              sla_met_event_id: event.id,
              actual_hours: actualHours,
              projected_at: new Date().toISOString(),
            })
            .eq('id', slaFact.id);

          if (updateError) {
            throw new Error(`Failed to update SLA fact: ${updateError.message}`);
          }
        }
      }
    }

    // Handle resolution - marks resolution SLA as met
    if (event.event_type === 'SupportCaseResolved') {
      const data = event.event_data as unknown as SupportCaseResolvedData;

      // Find unmet resolution SLA for this case
      const { data: slaFact, error: findError } = await supabase
        .from('support_case_sla_facts')
        .select('id')
        .eq('support_case_id', aggregateId)
        .eq('sla_type', 'resolution')
        .is('met_at', null)
        .is('breached_at', null)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        throw new Error(`Failed to find SLA fact: ${findError.message}`);
      }

      if (slaFact) {
        const { error: updateError } = await supabase
          .from('support_case_sla_facts')
          .update({
            met_at: event.occurred_at,
            sla_met_event_id: event.id,
            actual_hours: data.resolutionTimeHours,
            projected_at: new Date().toISOString(),
          })
          .eq('id', slaFact.id);

        if (updateError) {
          throw new Error(`Failed to update SLA fact: ${updateError.message}`);
        }
      }
    }

    // Handle SLA breach
    if (event.event_type === 'SlaBreached') {
      const data = event.event_data as unknown as SlaBreachedData;

      // Find the SLA fact for this type
      const { data: slaFact, error: findError } = await supabase
        .from('support_case_sla_facts')
        .select('id')
        .eq('support_case_id', aggregateId)
        .eq('sla_type', data.slaType)
        .is('met_at', null)
        .is('breached_at', null)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        throw new Error(`Failed to find SLA fact: ${findError.message}`);
      }

      if (slaFact) {
        const { error: updateError } = await supabase
          .from('support_case_sla_facts')
          .update({
            breached_at: data.breachedAt,
            is_breached: true,
            actual_hours: data.actualHours,
            hours_over_sla: data.hoursOver,
            sla_breached_event_id: event.id,
            projected_at: new Date().toISOString(),
          })
          .eq('id', slaFact.id);

        if (updateError) {
          throw new Error(`Failed to update SLA fact: ${updateError.message}`);
        }
      }
    }
  },

  async clear(supabase: AnySupabaseClient): Promise<void> {
    const { error } = await supabase
      .from('support_case_sla_facts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      throw new Error(`Failed to clear support case SLA facts: ${error.message}`);
    }
  },
};
