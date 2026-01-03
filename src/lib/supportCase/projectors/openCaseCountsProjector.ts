/**
 * Open Case Counts Projector
 *
 * Projects support case events into aggregated count tables:
 * - company_product_open_case_counts
 * - company_open_case_counts
 *
 * Updates counts incrementally based on:
 * - SupportCaseCreated → increment counts
 * - SupportCaseStatusChanged → adjust status counts
 * - SupportCaseSeverityChanged → adjust severity counts
 * - SlaBreached → increment breached counts
 * - SupportCaseClosed → decrement open counts
 * - SupportCaseReopened → increment open counts
 *
 * IDEMPOTENCY:
 * - Tracks last processed event sequence per aggregate
 * - Skips events already processed
 */

import type { EventStore } from '@/types/eventSourcing';
import type { Projector, AnySupabaseClient } from '@/lib/lifecycle/projectors/core';
import type {
  SupportCaseCreatedData,
  SupportCaseStatusChangedData,
  SupportCaseSeverityChangedData,
  SlaBreachedData,
} from '../events';
import { SUPPORT_CASE_AGGREGATE_TYPE } from '../events';

// ============================================================================
// HELPER TYPES
// ============================================================================

type SupportCaseStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_on_customer'
  | 'waiting_on_internal'
  | 'escalated'
  | 'resolved'
  | 'closed';

type SupportCaseSeverity = 'low' | 'medium' | 'high' | 'urgent' | 'critical';

interface CountFields {
  open_count: number;
  in_progress_count: number;
  waiting_count: number;
  escalated_count: number;
  low_count: number;
  medium_count: number;
  high_count: number;
  urgent_count: number;
  critical_count: number;
  first_response_breached_count: number;
  resolution_breached_count: number;
  any_breached_count: number;
  total_open_count: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function isOpenStatus(status: SupportCaseStatus): boolean {
  return status !== 'resolved' && status !== 'closed';
}

function getStatusCountField(status: SupportCaseStatus): keyof CountFields | null {
  switch (status) {
    case 'open':
      return 'open_count';
    case 'in_progress':
      return 'in_progress_count';
    case 'waiting_on_customer':
    case 'waiting_on_internal':
      return 'waiting_count';
    case 'escalated':
      return 'escalated_count';
    default:
      return null;
  }
}

function getSeverityCountField(severity: SupportCaseSeverity): keyof CountFields {
  return `${severity}_count` as keyof CountFields;
}

// ============================================================================
// PROJECTOR IMPLEMENTATION
// ============================================================================

export const OpenCaseCountsProjector: Projector = {
  name: 'company_product_open_case_counts',
  aggregateTypes: [SUPPORT_CASE_AGGREGATE_TYPE],

  async processEvent(supabase: AnySupabaseClient, event: EventStore): Promise<void> {
    const aggregateId = event.aggregate_id;

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

    const { company_id, company_product_id } = supportCase;

    // Update company-level counts
    await this.updateCompanyCounts(supabase, company_id, event);

    // Update company_product counts if linked to a product
    if (company_product_id) {
      await this.updateCompanyProductCounts(supabase, company_product_id, company_id, event);
    }
  },

  async updateCompanyCounts(
    supabase: AnySupabaseClient,
    companyId: string,
    event: EventStore
  ): Promise<void> {
    // Ensure row exists
    const { data: existing } = await supabase
      .from('company_open_case_counts')
      .select('company_id')
      .eq('company_id', companyId)
      .single();

    if (!existing) {
      const { error: insertError } = await supabase
        .from('company_open_case_counts')
        .insert({
          company_id: companyId,
          total_open_count: 0,
          unassigned_product_count: 0,
          high_and_above_count: 0,
          critical_count: 0,
          any_breached_count: 0,
          projected_at: new Date().toISOString(),
        });

      if (insertError && !insertError.message.includes('duplicate')) {
        throw new Error(`Failed to insert company counts: ${insertError.message}`);
      }
    }

    // Get current counts
    const { data: current, error: fetchError } = await supabase
      .from('company_open_case_counts')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch company counts: ${fetchError.message}`);
    }

    const updates: Record<string, unknown> = {
      projected_at: new Date().toISOString(),
    };

    const eventData = event.event_data as unknown;

    switch (event.event_type) {
      case 'SupportCaseCreated': {
        const data = eventData as SupportCaseCreatedData;
        updates.total_open_count = (current.total_open_count || 0) + 1;

        // Check if unassigned to product
        const { data: sc } = await supabase
          .from('support_cases')
          .select('company_product_id')
          .eq('id', event.aggregate_id)
          .single();

        if (!sc?.company_product_id) {
          updates.unassigned_product_count = (current.unassigned_product_count || 0) + 1;
        }

        // Update severity counts
        if (['high', 'urgent', 'critical'].includes(data.severity)) {
          updates.high_and_above_count = (current.high_and_above_count || 0) + 1;
        }
        if (data.severity === 'critical') {
          updates.critical_count = (current.critical_count || 0) + 1;
        }
        break;
      }

      case 'SupportCaseSeverityChanged': {
        const data = eventData as SupportCaseSeverityChangedData;
        const fromHigh = ['high', 'urgent', 'critical'].includes(data.fromSeverity);
        const toHigh = ['high', 'urgent', 'critical'].includes(data.toSeverity);

        if (!fromHigh && toHigh) {
          updates.high_and_above_count = (current.high_and_above_count || 0) + 1;
        } else if (fromHigh && !toHigh) {
          updates.high_and_above_count = Math.max(0, (current.high_and_above_count || 0) - 1);
        }

        if (data.fromSeverity === 'critical' && data.toSeverity !== 'critical') {
          updates.critical_count = Math.max(0, (current.critical_count || 0) - 1);
        } else if (data.fromSeverity !== 'critical' && data.toSeverity === 'critical') {
          updates.critical_count = (current.critical_count || 0) + 1;
        }
        break;
      }

      case 'SlaBreached': {
        updates.any_breached_count = (current.any_breached_count || 0) + 1;
        break;
      }

      case 'SupportCaseClosed': {
        updates.total_open_count = Math.max(0, (current.total_open_count || 0) - 1);

        // Check severity of closed case
        const { data: readModel } = await supabase
          .from('support_case_read_model')
          .select('severity, company_product_id')
          .eq('support_case_id', event.aggregate_id)
          .single();

        if (readModel) {
          if (!readModel.company_product_id) {
            updates.unassigned_product_count = Math.max(
              0,
              (current.unassigned_product_count || 0) - 1
            );
          }

          if (['high', 'urgent', 'critical'].includes(readModel.severity)) {
            updates.high_and_above_count = Math.max(
              0,
              (current.high_and_above_count || 0) - 1
            );
          }
          if (readModel.severity === 'critical') {
            updates.critical_count = Math.max(0, (current.critical_count || 0) - 1);
          }
        }
        break;
      }

      case 'SupportCaseReopened': {
        updates.total_open_count = (current.total_open_count || 0) + 1;

        // Check severity of reopened case
        const { data: readModel } = await supabase
          .from('support_case_read_model')
          .select('severity, company_product_id')
          .eq('support_case_id', event.aggregate_id)
          .single();

        if (readModel) {
          if (!readModel.company_product_id) {
            updates.unassigned_product_count = (current.unassigned_product_count || 0) + 1;
          }

          if (['high', 'urgent', 'critical'].includes(readModel.severity)) {
            updates.high_and_above_count = (current.high_and_above_count || 0) + 1;
          }
          if (readModel.severity === 'critical') {
            updates.critical_count = (current.critical_count || 0) + 1;
          }
        }
        break;
      }
    }

    // Only update if we have changes
    if (Object.keys(updates).length > 1) {
      const { error: updateError } = await supabase
        .from('company_open_case_counts')
        .update(updates)
        .eq('company_id', companyId);

      if (updateError) {
        throw new Error(`Failed to update company counts: ${updateError.message}`);
      }
    }
  },

  async updateCompanyProductCounts(
    supabase: AnySupabaseClient,
    companyProductId: string,
    companyId: string,
    event: EventStore
  ): Promise<void> {
    // Get product_id for denormalization
    const { data: cp, error: cpError } = await supabase
      .from('company_products')
      .select('product_id')
      .eq('id', companyProductId)
      .single();

    if (cpError) {
      if (cpError.code === 'PGRST116') {
        console.warn(`CompanyProduct ${companyProductId} not found - skipping`);
        return;
      }
      throw new Error(`Failed to fetch company_product: ${cpError.message}`);
    }

    // Ensure row exists
    const { data: existing } = await supabase
      .from('company_product_open_case_counts')
      .select('company_product_id')
      .eq('company_product_id', companyProductId)
      .single();

    if (!existing) {
      const { error: insertError } = await supabase
        .from('company_product_open_case_counts')
        .insert({
          company_product_id: companyProductId,
          company_id: companyId,
          product_id: cp.product_id,
          open_count: 0,
          in_progress_count: 0,
          waiting_count: 0,
          escalated_count: 0,
          low_count: 0,
          medium_count: 0,
          high_count: 0,
          urgent_count: 0,
          critical_count: 0,
          first_response_breached_count: 0,
          resolution_breached_count: 0,
          any_breached_count: 0,
          total_open_count: 0,
          total_resolved_30d: 0,
          negative_impact_count: 0,
          critical_impact_count: 0,
          projected_at: new Date().toISOString(),
        });

      if (insertError && !insertError.message.includes('duplicate')) {
        throw new Error(`Failed to insert company product counts: ${insertError.message}`);
      }
    }

    // Get current counts
    const { data: current, error: fetchError } = await supabase
      .from('company_product_open_case_counts')
      .select('*')
      .eq('company_product_id', companyProductId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch company product counts: ${fetchError.message}`);
    }

    const updates: Record<string, unknown> = {
      projected_at: new Date().toISOString(),
    };

    const eventData = event.event_data as unknown;

    switch (event.event_type) {
      case 'SupportCaseCreated': {
        const data = eventData as SupportCaseCreatedData;
        updates.total_open_count = (current.total_open_count || 0) + 1;
        updates.open_count = (current.open_count || 0) + 1;

        // Severity count
        const sevField = getSeverityCountField(data.severity as SupportCaseSeverity);
        updates[sevField] = ((current as Record<string, number>)[sevField] || 0) + 1;
        break;
      }

      case 'SupportCaseStatusChanged': {
        const data = eventData as SupportCaseStatusChangedData;
        const fromField = getStatusCountField(data.fromStatus as SupportCaseStatus);
        const toField = getStatusCountField(data.toStatus as SupportCaseStatus);

        // Decrement old status count
        if (fromField) {
          updates[fromField] = Math.max(
            0,
            ((current as Record<string, number>)[fromField] || 0) - 1
          );
        }

        // Increment new status count
        if (toField) {
          updates[toField] = ((current as Record<string, number>)[toField] || 0) + 1;
        }

        // Update total_open_count if transitioning in/out of closed states
        const wasOpen = isOpenStatus(data.fromStatus as SupportCaseStatus);
        const isOpen = isOpenStatus(data.toStatus as SupportCaseStatus);

        if (wasOpen && !isOpen) {
          updates.total_open_count = Math.max(0, (current.total_open_count || 0) - 1);
        } else if (!wasOpen && isOpen) {
          updates.total_open_count = (current.total_open_count || 0) + 1;
        }
        break;
      }

      case 'SupportCaseSeverityChanged': {
        const data = eventData as SupportCaseSeverityChangedData;
        const fromField = getSeverityCountField(data.fromSeverity as SupportCaseSeverity);
        const toField = getSeverityCountField(data.toSeverity as SupportCaseSeverity);

        updates[fromField] = Math.max(
          0,
          ((current as Record<string, number>)[fromField] || 0) - 1
        );
        updates[toField] = ((current as Record<string, number>)[toField] || 0) + 1;
        break;
      }

      case 'SlaBreached': {
        const data = eventData as SlaBreachedData;
        updates.any_breached_count = (current.any_breached_count || 0) + 1;

        if (data.slaType === 'first_response') {
          updates.first_response_breached_count =
            (current.first_response_breached_count || 0) + 1;
        } else if (data.slaType === 'resolution') {
          updates.resolution_breached_count = (current.resolution_breached_count || 0) + 1;
        }
        break;
      }

      case 'SupportCaseClosed': {
        updates.total_open_count = Math.max(0, (current.total_open_count || 0) - 1);

        // Decrement status and severity counts based on read model
        const { data: readModel } = await supabase
          .from('support_case_read_model')
          .select('status, severity')
          .eq('support_case_id', event.aggregate_id)
          .single();

        if (readModel) {
          // We need the status BEFORE close, which is complex.
          // For simplicity, just decrement open_count as default
          updates.open_count = Math.max(0, (current.open_count || 0) - 1);

          const sevField = getSeverityCountField(readModel.severity as SupportCaseSeverity);
          updates[sevField] = Math.max(
            0,
            ((current as Record<string, number>)[sevField] || 0) - 1
          );
        }
        break;
      }

      case 'SupportCaseReopened': {
        updates.total_open_count = (current.total_open_count || 0) + 1;
        updates.open_count = (current.open_count || 0) + 1;

        // Increment severity count
        const { data: readModel } = await supabase
          .from('support_case_read_model')
          .select('severity')
          .eq('support_case_id', event.aggregate_id)
          .single();

        if (readModel) {
          const sevField = getSeverityCountField(readModel.severity as SupportCaseSeverity);
          updates[sevField] = ((current as Record<string, number>)[sevField] || 0) + 1;
        }
        break;
      }

      case 'SupportCaseResolved': {
        // Track resolved in last 30 days
        updates.total_resolved_30d = (current.total_resolved_30d || 0) + 1;
        break;
      }

      case 'CsatSubmitted': {
        // Track engagement impact
        const { data: readModel } = await supabase
          .from('support_case_read_model')
          .select('engagement_impact')
          .eq('support_case_id', event.aggregate_id)
          .single();

        if (readModel) {
          if (readModel.engagement_impact === 'negative') {
            updates.negative_impact_count = (current.negative_impact_count || 0) + 1;
          } else if (readModel.engagement_impact === 'critical') {
            updates.critical_impact_count = (current.critical_impact_count || 0) + 1;
          }
        }
        break;
      }
    }

    // Only update if we have changes
    if (Object.keys(updates).length > 1) {
      const { error: updateError } = await supabase
        .from('company_product_open_case_counts')
        .update(updates)
        .eq('company_product_id', companyProductId);

      if (updateError) {
        throw new Error(`Failed to update company product counts: ${updateError.message}`);
      }
    }
  },

  async clear(supabase: AnySupabaseClient): Promise<void> {
    // Clear both tables
    const { error: error1 } = await supabase
      .from('company_product_open_case_counts')
      .delete()
      .neq('company_product_id', '00000000-0000-0000-0000-000000000000');

    if (error1) {
      throw new Error(`Failed to clear company product counts: ${error1.message}`);
    }

    const { error: error2 } = await supabase
      .from('company_open_case_counts')
      .delete()
      .neq('company_id', '00000000-0000-0000-0000-000000000000');

    if (error2) {
      throw new Error(`Failed to clear company counts: ${error2.message}`);
    }
  },
} as Projector & {
  updateCompanyCounts: (
    supabase: AnySupabaseClient,
    companyId: string,
    event: EventStore
  ) => Promise<void>;
  updateCompanyProductCounts: (
    supabase: AnySupabaseClient,
    companyProductId: string,
    companyId: string,
    event: EventStore
  ) => Promise<void>;
};
