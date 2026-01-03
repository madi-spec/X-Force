/**
 * Company Product Read Model Projector
 *
 * Projects events into the company_product_read_model table.
 * This table provides the current state snapshot for each company product.
 *
 * DERIVED FROM EVENTS:
 * - CompanyProductPhaseSet → updates lifecycle phase
 * - CompanyProductProcessSet → updates process info
 * - CompanyProductStageSet → updates stage info, timing
 * - CompanyProductProcessCompleted → marks process complete
 * - CompanyProductHealthUpdated → updates health metrics
 * - CompanyProductSLAWarning → sets warning flag
 * - CompanyProductSLABreached → sets breach flag
 *
 * IDEMPOTENCY:
 * - Uses upsert with company_product_id as key
 * - Same event applied twice produces same result
 */

import type { EventStore } from '@/types/eventSourcing';
import type { Projector, AnySupabaseClient } from './core';
import type { LifecyclePhase, ProcessType, TerminalOutcome } from '../events';

// ============================================================================
// EVENT DATA TYPES (for type-safe extraction)
// ============================================================================

interface PhaseSetEventData {
  toPhase: LifecyclePhase;
}

interface ProcessSetEventData {
  toProcessId: string;
  toProcessType: ProcessType;
  processVersion: number;
  initialStageId?: string;
  initialStageName?: string;
}

interface StageSetEventData {
  toStageId: string;
  toStageName: string;
  toStageOrder: number;
  isProgression: boolean;
}

interface ProcessCompletedEventData {
  processId: string;
  processType: ProcessType;
  terminalStageId: string;
  terminalStageName: string;
  outcome: TerminalOutcome;
  durationDays: number;
  stageTransitionCount: number;
}

interface HealthUpdatedEventData {
  toScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: Array<{ name: string; score: number; weight: number }>;
}

interface HealthReasonData {
  code: string;
  description: string;
  impact: number;
  source: string;
  referenceId?: string;
}

interface HealthComputedEventData {
  toScore: number;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  reasons: HealthReasonData[];
}

interface RiskLevelSetEventData {
  toRiskLevel: 'none' | 'low' | 'medium' | 'high';
  reasons: HealthReasonData[];
}

interface SLAWarningEventData {
  stageId: string;
  stageName: string;
  slaDays: number;
  warningDays: number;
  actualDays: number;
}

interface SLABreachedEventData {
  stageId: string;
  stageName: string;
  slaDays: number;
  actualDays: number;
  daysOver: number;
}

interface OwnerSetEventData {
  toOwnerId: string;
  toOwnerName: string;
}

interface TierSetEventData {
  toTier: number;
}

interface MRRSetEventData {
  toMRR: number;
  currency: string;
}

interface SeatsSetEventData {
  toSeats: number;
}

interface NextStepDueSetEventData {
  toNextStep: string;
  toDueDate: string;
  isOverdue?: boolean;
}

// ============================================================================
// PROJECTOR IMPLEMENTATION
// ============================================================================

export const CompanyProductReadModelProjector: Projector = {
  name: 'company_product_read_model',
  aggregateTypes: ['CompanyProduct'],

  async processEvent(supabase: AnySupabaseClient, event: EventStore): Promise<void> {
    const aggregateId = event.aggregate_id;
    const eventData = event.event_data as unknown;

    // First, ensure the read model row exists
    // We need to fetch company_id and product_id from company_products
    const { data: companyProduct, error: cpError } = await supabase
      .from('company_products')
      .select('company_id, product_id')
      .eq('id', aggregateId)
      .single();

    if (cpError) {
      // Company product might not exist yet - skip silently
      if (cpError.code === 'PGRST116') {
        console.warn(`CompanyProduct ${aggregateId} not found - skipping event ${event.id}`);
        return;
      }
      throw new Error(`Failed to fetch company_product: ${cpError.message}`);
    }

    // Base update fields for all events
    const baseUpdate = {
      company_product_id: aggregateId,
      company_id: companyProduct.company_id,
      product_id: companyProduct.product_id,
      last_event_at: event.occurred_at,
      last_event_type: event.event_type,
      last_event_sequence: event.sequence_number,
      projected_at: new Date().toISOString(),
    };

    // Build update based on event type
    let specificUpdate: Record<string, unknown> = {};

    switch (event.event_type) {
      case 'CompanyProductPhaseSet': {
        // Phase changes don't affect process/stage state directly
        // but we could track phase in a future schema addition
        break;
      }

      case 'CompanyProductProcessSet': {
        const data = eventData as ProcessSetEventData;
        specificUpdate = {
          current_process_type: data.toProcessType,
          current_process_id: data.toProcessId,
          process_started_at: event.occurred_at,
          process_completed_at: null,
          // Initial stage entry counts as first transition
          stage_transition_count: data.initialStageId ? 1 : 0,
          is_sla_breached: false,
          is_sla_warning: false,
        };

        // If initial stage is set
        if (data.initialStageId) {
          specificUpdate.current_stage_id = data.initialStageId;
          specificUpdate.current_stage_name = data.initialStageName;
          specificUpdate.stage_entered_at = event.occurred_at;

          // Fetch stage details for slug and SLA
          const { data: stage } = await supabase
            .from('product_process_stages')
            .select('slug, sla_days, sla_warning_days')
            .eq('id', data.initialStageId)
            .single();

          if (stage) {
            specificUpdate.current_stage_slug = stage.slug;
            if (stage.sla_days) {
              const deadline = new Date(event.occurred_at);
              deadline.setDate(deadline.getDate() + stage.sla_days);
              specificUpdate.stage_sla_deadline = deadline.toISOString();

              if (stage.sla_warning_days) {
                const warning = new Date(event.occurred_at);
                warning.setDate(warning.getDate() + stage.sla_warning_days);
                specificUpdate.stage_sla_warning_at = warning.toISOString();
              }
            }
          }
        }
        break;
      }

      case 'CompanyProductStageSet': {
        const data = eventData as StageSetEventData;
        specificUpdate = {
          current_stage_id: data.toStageId,
          current_stage_name: data.toStageName,
          stage_entered_at: event.occurred_at,
          is_sla_breached: false,
          is_sla_warning: false,
        };

        // Increment transition count
        const { data: current } = await supabase
          .from('company_product_read_model')
          .select('stage_transition_count')
          .eq('company_product_id', aggregateId)
          .single();

        specificUpdate.stage_transition_count = (current?.stage_transition_count || 0) + 1;

        // Fetch stage details
        const { data: stage } = await supabase
          .from('product_process_stages')
          .select('slug, sla_days, sla_warning_days')
          .eq('id', data.toStageId)
          .single();

        if (stage) {
          specificUpdate.current_stage_slug = stage.slug;
          if (stage.sla_days) {
            const deadline = new Date(event.occurred_at);
            deadline.setDate(deadline.getDate() + stage.sla_days);
            specificUpdate.stage_sla_deadline = deadline.toISOString();

            if (stage.sla_warning_days) {
              const warning = new Date(event.occurred_at);
              warning.setDate(warning.getDate() + stage.sla_warning_days);
              specificUpdate.stage_sla_warning_at = warning.toISOString();
            }
          } else {
            specificUpdate.stage_sla_deadline = null;
            specificUpdate.stage_sla_warning_at = null;
          }
        }
        break;
      }

      case 'CompanyProductProcessCompleted': {
        const data = eventData as ProcessCompletedEventData;
        specificUpdate = {
          process_completed_at: event.occurred_at,
          total_process_days: data.durationDays,
          stage_transition_count: data.stageTransitionCount,
        };
        break;
      }

      case 'CompanyProductHealthUpdated': {
        const data = eventData as HealthUpdatedEventData;
        specificUpdate = {
          health_score: data.toScore,
          risk_level: data.riskLevel,
          risk_factors: data.factors,
        };
        break;
      }

      case 'CompanyProductHealthComputed': {
        const data = eventData as HealthComputedEventData;
        specificUpdate = {
          health_score: data.toScore,
          risk_level: data.riskLevel,
          risk_factors: data.reasons,
        };
        break;
      }

      case 'CompanyProductRiskLevelSet': {
        const data = eventData as RiskLevelSetEventData;
        specificUpdate = {
          risk_level: data.toRiskLevel,
          // Also store reasons in risk_factors for visibility
          risk_factors: data.reasons,
        };
        break;
      }

      case 'CompanyProductSLAWarning': {
        specificUpdate = {
          is_sla_warning: true,
        };
        break;
      }

      case 'CompanyProductSLABreached': {
        specificUpdate = {
          is_sla_breached: true,
          is_sla_warning: true,
        };
        break;
      }

      case 'CompanyProductOwnerSet': {
        const data = eventData as OwnerSetEventData;
        specificUpdate = {
          owner_id: data.toOwnerId,
          owner_name: data.toOwnerName,
        };
        break;
      }

      case 'CompanyProductTierSet': {
        const data = eventData as TierSetEventData;
        specificUpdate = {
          tier: data.toTier,
        };
        break;
      }

      case 'CompanyProductMRRSet': {
        const data = eventData as MRRSetEventData;
        specificUpdate = {
          mrr: data.toMRR,
          mrr_currency: data.currency,
        };
        break;
      }

      case 'CompanyProductSeatsSet': {
        const data = eventData as SeatsSetEventData;
        specificUpdate = {
          seats: data.toSeats,
        };
        break;
      }

      case 'CompanyProductNextStepDueSet': {
        const data = eventData as NextStepDueSetEventData;
        specificUpdate = {
          next_step: data.toNextStep,
          next_step_due_date: data.toDueDate,
          is_next_step_overdue: data.isOverdue || false,
        };
        break;
      }

      default:
        // Unknown event type - just update metadata
        break;
    }

    // Calculate days in current stage
    const { data: existingModel } = await supabase
      .from('company_product_read_model')
      .select('stage_entered_at, process_started_at')
      .eq('company_product_id', aggregateId)
      .single();

    if (existingModel) {
      if (existingModel.stage_entered_at && !specificUpdate.stage_entered_at) {
        const stageEntered = new Date(existingModel.stage_entered_at);
        const now = new Date(event.occurred_at);
        specificUpdate.days_in_current_stage = Math.floor(
          (now.getTime() - stageEntered.getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      if (existingModel.process_started_at && !specificUpdate.process_started_at) {
        const processStarted = new Date(existingModel.process_started_at);
        const now = new Date(event.occurred_at);
        specificUpdate.total_process_days = Math.floor(
          (now.getTime() - processStarted.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    // Upsert the read model
    const { error: upsertError } = await supabase
      .from('company_product_read_model')
      .upsert(
        {
          ...baseUpdate,
          ...specificUpdate,
          projection_version: event.sequence_number,
        },
        {
          onConflict: 'company_product_id',
        }
      );

    if (upsertError) {
      throw new Error(`Failed to upsert read model: ${upsertError.message}`);
    }
  },

  async clear(supabase: AnySupabaseClient): Promise<void> {
    const { error } = await supabase
      .from('company_product_read_model')
      .delete()
      .neq('company_product_id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw new Error(`Failed to clear read model: ${error.message}`);
    }
  },
};
