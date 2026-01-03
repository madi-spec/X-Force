/**
 * SupportCase Read Model Projector
 *
 * Projects support_case events into the support_case_read_model table.
 * Provides current state snapshot for each support case.
 *
 * DERIVED FROM EVENTS:
 * - SupportCaseCreated → creates initial read model
 * - SupportCaseAssigned → updates owner info
 * - SupportCaseStatusChanged → updates status
 * - SupportCaseSeverityChanged → updates severity
 * - SupportCaseCategoryChanged → updates category
 * - CustomerMessageLogged → updates customer contact time
 * - AgentResponseSent → updates agent response time
 * - SlaConfigured → sets SLA deadlines
 * - SlaBreached → sets breach flags
 * - SupportCaseResolved → sets resolution info
 * - SupportCaseClosed → sets closed_at
 * - SupportCaseReopened → clears closed state
 * - SupportCaseEscalated → increments escalation count
 * - CsatSubmitted → updates CSAT
 * - TagAdded/TagRemoved → updates tags
 *
 * IDEMPOTENCY:
 * - Uses upsert with support_case_id as key
 * - Same event applied twice produces same result
 */

import type { EventStore } from '@/types/eventSourcing';
import type { Projector, AnySupabaseClient } from '@/lib/lifecycle/projectors/core';
import type {
  SupportCaseCreatedData,
  SupportCaseAssignedData,
  SupportCaseStatusChangedData,
  SupportCaseSeverityChangedData,
  SlaConfiguredData,
  SlaBreachedData,
  SupportCaseResolvedData,
  SupportCaseClosedData,
  SupportCaseReopenedData,
} from '../events';
import { SUPPORT_CASE_AGGREGATE_TYPE } from '../events';

// ============================================================================
// EVENT DATA TYPES (additional ones not in events.ts)
// ============================================================================

interface SupportCaseCategoryChangedData {
  toCategory: string;
  toSubcategory?: string;
}

interface CustomerMessageLoggedData {
  receivedAt: string;
}

interface AgentResponseSentData {
  isFirstResponse: boolean;
  responseTimeMinutes?: number;
}

interface SupportCaseEscalatedData {
  escalationLevel: number;
  escalatedToTeam?: string;
  escalatedToUserId?: string;
  escalatedToUserName?: string;
}

interface CsatSubmittedData {
  score: number;
  comment?: string;
}

interface TagAddedData {
  tag: string;
}

interface TagRemovedData {
  tag: string;
}

// ============================================================================
// PROJECTOR IMPLEMENTATION
// ============================================================================

export const SupportCaseReadModelProjector: Projector = {
  name: 'support_case_read_model',
  aggregateTypes: [SUPPORT_CASE_AGGREGATE_TYPE],

  async processEvent(supabase: AnySupabaseClient, event: EventStore): Promise<void> {
    const aggregateId = event.aggregate_id;
    const eventData = event.event_data as unknown;

    // Fetch support_case identity to get company_id and company_product_id
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

    // Base update for all events
    const baseUpdate = {
      support_case_id: aggregateId,
      company_id: supportCase.company_id,
      company_product_id: supportCase.company_product_id,
      last_event_at: event.occurred_at,
      last_event_type: event.event_type,
      last_event_sequence: event.sequence_number,
      projected_at: new Date().toISOString(),
    };

    let specificUpdate: Record<string, unknown> = {};

    switch (event.event_type) {
      case 'SupportCaseCreated': {
        const data = eventData as SupportCaseCreatedData;
        specificUpdate = {
          title: data.title,
          description: data.description || null,
          external_id: data.externalId || null,
          source: data.source,
          status: 'open',
          severity: data.severity,
          category: data.category || null,
          subcategory: data.subcategory || null,
          opened_at: event.occurred_at,
          tags: [],
          response_count: 0,
          customer_response_count: 0,
          agent_response_count: 0,
          escalation_count: 0,
          reopen_count: 0,
          first_response_breached: false,
          resolution_breached: false,
        };
        break;
      }

      case 'SupportCaseAssigned': {
        const data = eventData as SupportCaseAssignedData;
        specificUpdate = {
          owner_id: data.toOwnerId,
          owner_name: data.toOwnerName,
          assigned_team: data.team || null,
        };
        break;
      }

      case 'SupportCaseStatusChanged': {
        const data = eventData as SupportCaseStatusChangedData;
        specificUpdate = {
          status: data.toStatus,
        };
        break;
      }

      case 'SupportCaseSeverityChanged': {
        const data = eventData as SupportCaseSeverityChangedData;
        specificUpdate = {
          severity: data.toSeverity,
        };
        // Update SLA deadlines if provided
        if (data.newFirstResponseDueAt) {
          specificUpdate.first_response_due_at = data.newFirstResponseDueAt;
        }
        if (data.newResolutionDueAt) {
          specificUpdate.resolution_due_at = data.newResolutionDueAt;
        }
        break;
      }

      case 'SupportCaseCategoryChanged': {
        const data = eventData as SupportCaseCategoryChangedData;
        specificUpdate = {
          category: data.toCategory,
          subcategory: data.toSubcategory || null,
        };
        break;
      }

      case 'CustomerMessageLogged': {
        const data = eventData as CustomerMessageLoggedData;
        // Increment customer response count
        const { data: current } = await supabase
          .from('support_case_read_model')
          .select('customer_response_count, response_count')
          .eq('support_case_id', aggregateId)
          .single();

        specificUpdate = {
          last_customer_contact_at: data.receivedAt,
          customer_response_count: (current?.customer_response_count || 0) + 1,
          response_count: (current?.response_count || 0) + 1,
        };
        break;
      }

      case 'AgentResponseSent': {
        const data = eventData as AgentResponseSentData;
        const { data: current } = await supabase
          .from('support_case_read_model')
          .select('agent_response_count, response_count, first_response_at')
          .eq('support_case_id', aggregateId)
          .single();

        specificUpdate = {
          last_agent_response_at: event.occurred_at,
          agent_response_count: (current?.agent_response_count || 0) + 1,
          response_count: (current?.response_count || 0) + 1,
        };

        // Record first response time
        if (data.isFirstResponse && !current?.first_response_at) {
          specificUpdate.first_response_at = event.occurred_at;
        }
        break;
      }

      case 'SlaConfigured': {
        const data = eventData as SlaConfiguredData;
        if (data.slaType === 'first_response') {
          specificUpdate.first_response_due_at = data.dueAt;
        } else if (data.slaType === 'resolution') {
          specificUpdate.resolution_due_at = data.dueAt;
        }
        break;
      }

      case 'SlaBreached': {
        const data = eventData as SlaBreachedData;
        if (data.slaType === 'first_response') {
          specificUpdate.first_response_breached = true;
        } else if (data.slaType === 'resolution') {
          specificUpdate.resolution_breached = true;
        }
        break;
      }

      case 'SupportCaseResolved': {
        const data = eventData as SupportCaseResolvedData;
        specificUpdate = {
          status: 'resolved',
          resolved_at: event.occurred_at,
          resolution_summary: data.resolutionSummary,
          root_cause: data.rootCause || null,
        };
        break;
      }

      case 'SupportCaseClosed': {
        const data = eventData as SupportCaseClosedData;
        specificUpdate = {
          status: 'closed',
          closed_at: event.occurred_at,
        };
        // Optionally set engagement impact based on close reason
        if (data.closeReason === 'no_response' || data.closeReason === 'cancelled') {
          specificUpdate.engagement_impact = 'neutral';
        }
        break;
      }

      case 'SupportCaseReopened': {
        const { data: current } = await supabase
          .from('support_case_read_model')
          .select('reopen_count')
          .eq('support_case_id', aggregateId)
          .single();

        specificUpdate = {
          status: 'open',
          closed_at: null,
          resolved_at: null,
          resolution_summary: null,
          reopen_count: (current?.reopen_count || 0) + 1,
        };
        break;
      }

      case 'SupportCaseEscalated': {
        const data = eventData as SupportCaseEscalatedData;
        const { data: current } = await supabase
          .from('support_case_read_model')
          .select('escalation_count')
          .eq('support_case_id', aggregateId)
          .single();

        specificUpdate = {
          status: 'escalated',
          escalation_count: (current?.escalation_count || 0) + 1,
        };

        // Update assignment if escalated to specific user
        if (data.escalatedToUserId) {
          specificUpdate.owner_id = data.escalatedToUserId;
          specificUpdate.owner_name = data.escalatedToUserName;
        }
        if (data.escalatedToTeam) {
          specificUpdate.assigned_team = data.escalatedToTeam;
        }
        break;
      }

      case 'CsatSubmitted': {
        const data = eventData as CsatSubmittedData;
        specificUpdate = {
          csat_score: data.score,
          csat_comment: data.comment || null,
          csat_submitted_at: event.occurred_at,
        };

        // Infer engagement impact from CSAT
        if (data.score >= 4) {
          specificUpdate.engagement_impact = 'positive';
        } else if (data.score === 3) {
          specificUpdate.engagement_impact = 'neutral';
        } else if (data.score === 2) {
          specificUpdate.engagement_impact = 'negative';
        } else {
          specificUpdate.engagement_impact = 'critical';
        }
        break;
      }

      case 'TagAdded': {
        const data = eventData as TagAddedData;
        const { data: current } = await supabase
          .from('support_case_read_model')
          .select('tags')
          .eq('support_case_id', aggregateId)
          .single();

        const currentTags = (current?.tags as string[]) || [];
        if (!currentTags.includes(data.tag)) {
          specificUpdate.tags = [...currentTags, data.tag];
        }
        break;
      }

      case 'TagRemoved': {
        const data = eventData as TagRemovedData;
        const { data: current } = await supabase
          .from('support_case_read_model')
          .select('tags')
          .eq('support_case_id', aggregateId)
          .single();

        const currentTags = (current?.tags as string[]) || [];
        specificUpdate.tags = currentTags.filter((t: string) => t !== data.tag);
        break;
      }

      default:
        // Unknown event - just update metadata
        break;
    }

    // Upsert the read model
    const { error: upsertError } = await supabase
      .from('support_case_read_model')
      .upsert(
        {
          ...baseUpdate,
          ...specificUpdate,
          projection_version: event.sequence_number,
        },
        {
          onConflict: 'support_case_id',
        }
      );

    if (upsertError) {
      throw new Error(`Failed to upsert support case read model: ${upsertError.message}`);
    }
  },

  async clear(supabase: AnySupabaseClient): Promise<void> {
    const { error } = await supabase
      .from('support_case_read_model')
      .delete()
      .neq('support_case_id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      throw new Error(`Failed to clear support case read model: ${error.message}`);
    }
  },
};
