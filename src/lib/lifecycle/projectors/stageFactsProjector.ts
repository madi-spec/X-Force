/**
 * Company Product Stage Facts Projector
 *
 * Projects stage entry/exit events into company_product_stage_facts.
 * This table provides historical stage duration analytics.
 *
 * KEY INVARIANTS:
 * 1. At most ONE open stage fact per company_product_id (exited_at IS NULL)
 * 2. Stage transitions CLOSE the previous fact and OPEN a new one
 * 3. Process completion CLOSES the final stage fact
 * 4. Duration is calculated on exit
 *
 * DERIVED FROM EVENTS:
 * - CompanyProductProcessSet (with initialStageId) → opens first stage fact
 * - CompanyProductStageSet → closes previous, opens new
 * - CompanyProductProcessCompleted → closes final stage fact
 *
 * IDEMPOTENCY:
 * - Uses event_id references to prevent duplicate facts
 * - Checks for existing open fact before creating new one
 */

import type { EventStore } from '@/types/eventSourcing';
import type { Projector, AnySupabaseClient } from './core';
import type { ProcessType, TerminalOutcome } from '../events';

// ============================================================================
// EVENT DATA TYPES
// ============================================================================

interface ProcessSetEventData {
  fromProcessId: string | null;
  toProcessId: string;
  toProcessType: ProcessType;
  processVersion: number;
  initialStageId?: string;
  initialStageName?: string;
}

interface StageSetEventData {
  fromStageId: string | null;
  fromStageName: string | null;
  fromStageOrder: number | null;
  toStageId: string;
  toStageName: string;
  toStageOrder: number;
  isProgression: boolean;
  reason?: string;
}

interface ProcessCompletedEventData {
  processId: string;
  processType: ProcessType;
  terminalStageId: string;
  terminalStageName: string;
  outcome: TerminalOutcome;
  durationDays: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculates business days between two dates.
 * Excludes Saturdays and Sundays.
 */
function calculateBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);

  while (current < end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Determines exit reason based on stage order change.
 */
function determineExitReason(
  fromOrder: number | null,
  toOrder: number,
  isCompleted: boolean
): string {
  if (isCompleted) return 'completed';
  if (fromOrder === null) return 'progressed';
  if (toOrder > fromOrder) return 'progressed';
  if (toOrder < fromOrder) return 'regressed';
  return 'progressed';
}

// ============================================================================
// PROJECTOR IMPLEMENTATION
// ============================================================================

export const CompanyProductStageFactsProjector: Projector = {
  name: 'company_product_stage_facts',
  aggregateTypes: ['CompanyProduct'],

  async processEvent(supabase: AnySupabaseClient, event: EventStore): Promise<void> {
    const aggregateId = event.aggregate_id;
    const eventData = event.event_data as unknown;

    // Skip events that don't affect stage facts
    if (!['CompanyProductProcessSet', 'CompanyProductStageSet', 'CompanyProductProcessCompleted'].includes(event.event_type)) {
      return;
    }

    // Fetch company product info
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

    switch (event.event_type) {
      case 'CompanyProductProcessSet': {
        const data = eventData as ProcessSetEventData;

        // Only create stage fact if initial stage is set
        if (!data.initialStageId || !data.initialStageName) {
          return;
        }

        // Check if fact already exists for this entry event
        const { data: existing } = await supabase
          .from('company_product_stage_facts')
          .select('id')
          .eq('entry_event_id', event.id)
          .single();

        if (existing) {
          // Already processed this event - idempotent
          return;
        }

        // Close any existing open stage fact (shouldn't happen but safety)
        await closeOpenStageFacts(supabase, aggregateId, event);

        // Fetch stage details
        const { data: stage } = await supabase
          .from('product_process_stages')
          .select('slug, stage_order, sla_days')
          .eq('id', data.initialStageId)
          .single();

        // Create new stage fact
        const { error: insertError } = await supabase
          .from('company_product_stage_facts')
          .insert({
            company_product_id: aggregateId,
            company_id: companyProduct.company_id,
            product_id: companyProduct.product_id,
            process_id: data.toProcessId,
            process_type: data.toProcessType,
            stage_id: data.initialStageId,
            stage_name: data.initialStageName,
            stage_slug: stage?.slug || data.initialStageName.toLowerCase().replace(/\s+/g, '-'),
            stage_order: stage?.stage_order || 1,
            entered_at: event.occurred_at,
            sla_days: stage?.sla_days,
            entry_event_id: event.id,
            projected_at: new Date().toISOString(),
          });

        if (insertError) {
          throw new Error(`Failed to insert stage fact: ${insertError.message}`);
        }
        break;
      }

      case 'CompanyProductStageSet': {
        const data = eventData as StageSetEventData;

        // Check if fact already exists for this entry event
        const { data: existing } = await supabase
          .from('company_product_stage_facts')
          .select('id')
          .eq('entry_event_id', event.id)
          .single();

        if (existing) {
          // Already processed - idempotent
          return;
        }

        // Close the previous open stage fact
        await closeOpenStageFacts(supabase, aggregateId, event, data.fromStageOrder, data.toStageOrder);

        // Fetch current process info from read model
        const { data: readModel } = await supabase
          .from('company_product_read_model')
          .select('current_process_id, current_process_type')
          .eq('company_product_id', aggregateId)
          .single();

        if (!readModel?.current_process_id) {
          throw new Error(`No active process for company_product ${aggregateId}`);
        }

        // Fetch stage details
        const { data: stage } = await supabase
          .from('product_process_stages')
          .select('slug, sla_days')
          .eq('id', data.toStageId)
          .single();

        // Create new stage fact
        const { error: insertError } = await supabase
          .from('company_product_stage_facts')
          .insert({
            company_product_id: aggregateId,
            company_id: companyProduct.company_id,
            product_id: companyProduct.product_id,
            process_id: readModel.current_process_id,
            process_type: readModel.current_process_type,
            stage_id: data.toStageId,
            stage_name: data.toStageName,
            stage_slug: stage?.slug || data.toStageName.toLowerCase().replace(/\s+/g, '-'),
            stage_order: data.toStageOrder,
            entered_at: event.occurred_at,
            sla_days: stage?.sla_days,
            entry_event_id: event.id,
            projected_at: new Date().toISOString(),
          });

        if (insertError) {
          throw new Error(`Failed to insert stage fact: ${insertError.message}`);
        }
        break;
      }

      case 'CompanyProductProcessCompleted': {
        const data = eventData as ProcessCompletedEventData;

        // Close the final stage fact
        await closeOpenStageFacts(supabase, aggregateId, event, null, null, 'completed');
        break;
      }
    }
  },

  async clear(supabase: AnySupabaseClient): Promise<void> {
    const { error } = await supabase
      .from('company_product_stage_facts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to clear stage facts: ${error.message}`);
    }
  },
};

/**
 * Closes any open stage facts for a company product.
 */
async function closeOpenStageFacts(
  supabase: AnySupabaseClient,
  companyProductId: string,
  exitEvent: EventStore,
  fromStageOrder?: number | null,
  toStageOrder?: number | null,
  explicitExitReason?: string
): Promise<void> {
  // Find open stage fact
  const { data: openFact, error: findError } = await supabase
    .from('company_product_stage_facts')
    .select('*')
    .eq('company_product_id', companyProductId)
    .is('exited_at', null)
    .single();

  if (findError) {
    if (findError.code === 'PGRST116') {
      // No open fact - that's fine
      return;
    }
    throw new Error(`Failed to find open stage fact: ${findError.message}`);
  }

  if (!openFact) {
    return;
  }

  // Calculate duration
  const enteredAt = new Date(openFact.entered_at);
  const exitedAt = new Date(exitEvent.occurred_at);
  const durationSeconds = Math.floor((exitedAt.getTime() - enteredAt.getTime()) / 1000);
  const durationBusinessDays = calculateBusinessDays(enteredAt, exitedAt);

  // Calculate SLA status
  let slaMet: boolean | null = null;
  let daysOverSla: number | null = null;

  if (openFact.sla_days) {
    const actualDays = durationBusinessDays;
    slaMet = actualDays <= openFact.sla_days;
    if (!slaMet) {
      daysOverSla = actualDays - openFact.sla_days;
    }
  }

  // Determine exit reason
  const exitReason = explicitExitReason || determineExitReason(
    fromStageOrder ?? openFact.stage_order,
    toStageOrder ?? openFact.stage_order + 1,
    explicitExitReason === 'completed'
  );

  // Update the stage fact
  const { error: updateError } = await supabase
    .from('company_product_stage_facts')
    .update({
      exited_at: exitEvent.occurred_at,
      duration_seconds: durationSeconds,
      duration_business_days: durationBusinessDays,
      sla_met: slaMet,
      days_over_sla: daysOverSla,
      exit_reason: exitReason,
      exit_event_id: exitEvent.id,
      projected_at: new Date().toISOString(),
    })
    .eq('id', openFact.id);

  if (updateError) {
    throw new Error(`Failed to close stage fact: ${updateError.message}`);
  }
}
