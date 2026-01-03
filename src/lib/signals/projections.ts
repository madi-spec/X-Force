/**
 * Signal Projections
 *
 * Materialized views derived from Signal events.
 * All projections are idempotent: replaying events produces identical state.
 *
 * Key insight: Signals are the intelligence layer between detection (Command Center)
 * and action (Work items). They carry evidence and explanations, not just triggers.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  SignalEvent,
  SignalDetectedEvent,
  SignalAcknowledgedEvent,
  SignalResolvedEvent,
  SignalEscalatedEvent,
  SignalWorkItemCreatedEvent,
  SignalWorkItemAttachedEvent,
  SignalType,
  SignalSeverity,
  SignalStatus,
  SignalEntityRef,
  SignalEvidence,
  PlaybookRecommendation,
} from './events';

// ============================================================================
// PROJECTION TYPES
// ============================================================================

/**
 * ActiveSignalsProjection - All active signals for a user/team
 * Keyed by: userId (or teamId for team views)
 */
export interface ActiveSignalsProjection {
  user_id: string;

  // Counts by severity
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_count: number;

  // Counts by status
  active_count: number;
  acknowledged_count: number;

  // Signal IDs sorted by priority
  signal_ids: string[];

  // Projection metadata
  last_event_sequence: number;
  last_projected_at: string;
}

/**
 * SignalDetailProjection - Full detail for a single signal
 * Keyed by: signalId
 */
export interface SignalDetailProjection {
  signal_id: string;
  signal_type: SignalType;
  severity: SignalSeverity;
  status: SignalStatus;

  // Entity this signal is about
  entity_type: SignalEntityRef['type'];
  entity_id: string;
  entity_name: string;

  // Human-readable explanation (never black box)
  explanation: string;

  // Evidence supporting this signal (audit trail)
  evidence: SignalEvidence;

  // Priority calculation (transparent, not black box)
  priority_factors: {
    base_score: number;
    recency_bonus: number;
    value_multiplier: number;
    engagement_factor: number;
  };
  priority_score: number;

  // Detection metadata
  detection_source: 'playbook' | 'rule_engine' | 'ai_analysis' | 'threshold_breach';
  detection_rule_id: string | null;

  // Playbook recommendation
  playbook: PlaybookRecommendation | null;

  // Work item linkage
  work_item_id: string | null;
  work_item_created_at: string | null;

  // User interaction
  acknowledged_by_user_id: string | null;
  acknowledged_at: string | null;
  acknowledged_notes: string | null;

  // Resolution
  resolution_type: 'addressed' | 'false_positive' | 'expired' | 'superseded' | null;
  resolution_notes: string | null;
  resolved_by_user_id: string | null;
  resolved_by_work_item_id: string | null;
  resolved_at: string | null;
  superseded_by_signal_id: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  expires_at: string | null;

  // Event replay checkpoint
  last_event_sequence: number;
}

/**
 * SignalsByEntityProjection - All signals for a specific entity
 * Keyed by: entityType + entityId
 */
export interface SignalsByEntityProjection {
  entity_type: SignalEntityRef['type'];
  entity_id: string;
  entity_name: string;

  // Active signals
  active_signal_ids: string[];
  active_count: number;

  // Signal history (last 30 days)
  resolved_signal_ids: string[];
  resolved_count: number;

  // Summary stats
  total_signals_30d: number;
  critical_signals_30d: number;
  false_positive_count_30d: number;

  // Last projected
  last_event_sequence: number;
  last_projected_at: string;
}

// ============================================================================
// PROJECTOR - IDEMPOTENT EVENT PROCESSOR
// ============================================================================

/**
 * SignalProjector
 *
 * Processes Signal events and updates projections idempotently.
 * Each event is processed exactly once using sequence number tracking.
 */
export class SignalProjector {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Project a single event into the relevant projections
   * Returns true if the event was processed, false if already processed
   */
  async projectEvent(event: SignalEvent): Promise<boolean> {
    const eventSequence = (event as any).sequence_number || 0;
    const signalId = this.getSignalId(event);

    if (!signalId) return false;

    // Get current projection to check if event already processed
    const existing = await this.getSignalDetail(signalId);
    if (existing && existing.last_event_sequence >= eventSequence) {
      // Event already processed - idempotency check
      return false;
    }

    // Process event based on type
    switch (event.event_type) {
      case 'SignalDetected':
        await this.handleDetected(event as SignalDetectedEvent, eventSequence);
        break;
      case 'SignalAcknowledged':
        await this.handleAcknowledged(event as SignalAcknowledgedEvent, eventSequence);
        break;
      case 'SignalResolved':
        await this.handleResolved(event as SignalResolvedEvent, eventSequence);
        break;
      case 'SignalEscalated':
        await this.handleEscalated(event as SignalEscalatedEvent, eventSequence);
        break;
      case 'SignalWorkItemCreated':
        await this.handleWorkItemCreated(event as SignalWorkItemCreatedEvent, eventSequence);
        break;
      case 'SignalWorkItemAttached':
        await this.handleWorkItemAttached(event as SignalWorkItemAttachedEvent, eventSequence);
        break;
    }

    return true;
  }

  /**
   * Replay all events for a signal to rebuild its projection
   */
  async replaySignal(signalId: string): Promise<void> {
    // Delete existing projection
    await this.supabase
      .from('signal_projections')
      .delete()
      .eq('signal_id', signalId);

    // Fetch all events for this signal
    const { data: events } = await this.supabase
      .from('event_store')
      .select('*')
      .eq('aggregate_type', 'signal')
      .eq('aggregate_id', signalId)
      .order('sequence_number', { ascending: true });

    if (!events || events.length === 0) return;

    // Apply each event in order
    for (const rawEvent of events) {
      const event = this.parseEvent(rawEvent);
      if (event) {
        await this.projectEvent(event);
      }
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  private async handleDetected(
    event: SignalDetectedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;
    const now = new Date().toISOString();

    const projection: SignalDetailProjection = {
      signal_id: data.signal_id,
      signal_type: data.signal_type,
      severity: data.severity,
      status: 'active',
      entity_type: data.entity_ref.type,
      entity_id: data.entity_ref.id,
      entity_name: data.entity_ref.name,
      explanation: data.explanation,
      evidence: data.evidence,
      priority_factors: data.priority_factors,
      priority_score: data.priority_score,
      detection_source: data.detection_source,
      detection_rule_id: data.detection_rule_id || null,
      playbook: data.playbook || null,
      work_item_id: null,
      work_item_created_at: null,
      acknowledged_by_user_id: null,
      acknowledged_at: null,
      acknowledged_notes: null,
      resolution_type: null,
      resolution_notes: null,
      resolved_by_user_id: null,
      resolved_by_work_item_id: null,
      resolved_at: null,
      superseded_by_signal_id: null,
      created_at: (event as any).occurred_at || now,
      updated_at: now,
      expires_at: data.expires_at || null,
      last_event_sequence: sequence,
    };

    await this.upsertSignalProjection(projection);
    await this.updateEntitySignals(data.entity_ref.type, data.entity_ref.id, data.entity_ref.name);
  }

  private async handleAcknowledged(
    event: SignalAcknowledgedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;
    const now = new Date().toISOString();

    await this.updateSignalProjection(data.signal_id, {
      status: 'acknowledged',
      acknowledged_by_user_id: data.acknowledged_by_user_id,
      acknowledged_at: (event as any).occurred_at || now,
      acknowledged_notes: data.notes || null,
      updated_at: now,
      last_event_sequence: sequence,
    });
  }

  private async handleResolved(
    event: SignalResolvedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;
    const now = new Date().toISOString();

    const existing = await this.getSignalDetail(data.signal_id);

    await this.updateSignalProjection(data.signal_id, {
      status: 'resolved',
      resolution_type: data.resolution_type,
      resolution_notes: data.resolution_notes || null,
      resolved_by_user_id: data.resolved_by_user_id || null,
      resolved_by_work_item_id: data.resolved_by_work_item_id || null,
      resolved_at: now,
      superseded_by_signal_id: data.superseded_by_signal_id || null,
      updated_at: now,
      last_event_sequence: sequence,
    });

    // Update entity signals after resolution
    if (existing) {
      await this.updateEntitySignals(existing.entity_type, existing.entity_id, existing.entity_name);
    }
  }

  private async handleEscalated(
    event: SignalEscalatedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;
    const now = new Date().toISOString();

    const existing = await this.getSignalDetail(data.signal_id);
    if (!existing) return;

    // Merge new evidence with existing
    const mergedEvidence: SignalEvidence = {
      ...existing.evidence,
      ...data.new_evidence,
      // Merge arrays if present
      communication_ids: [
        ...(existing.evidence.communication_ids || []),
        ...(data.new_evidence?.communication_ids || []),
      ],
      meeting_ids: [
        ...(existing.evidence.meeting_ids || []),
        ...(data.new_evidence?.meeting_ids || []),
      ],
      transcript_ids: [
        ...(existing.evidence.transcript_ids || []),
        ...(data.new_evidence?.transcript_ids || []),
      ],
    };

    // Recalculate priority based on new severity
    const newPriorityFactors = {
      ...existing.priority_factors,
      base_score: this.getSeverityBaseScore(data.new_severity),
    };

    await this.updateSignalProjection(data.signal_id, {
      severity: data.new_severity,
      evidence: mergedEvidence,
      explanation: `${existing.explanation} [Escalated: ${data.escalation_reason}]`,
      priority_factors: newPriorityFactors,
      priority_score: this.calculatePriorityScore(newPriorityFactors),
      updated_at: now,
      last_event_sequence: sequence,
    });

    // Update entity signals after escalation
    await this.updateEntitySignals(existing.entity_type, existing.entity_id, existing.entity_name);
  }

  private async handleWorkItemCreated(
    event: SignalWorkItemCreatedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;
    const now = new Date().toISOString();

    await this.updateSignalProjection(data.signal_id, {
      work_item_id: data.work_item_id,
      work_item_created_at: now,
      updated_at: now,
      last_event_sequence: sequence,
    });
  }

  private async handleWorkItemAttached(
    event: SignalWorkItemAttachedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;
    const now = new Date().toISOString();

    const existing = await this.getSignalDetail(data.signal_id);
    if (!existing) return;

    // Update priority based on delta
    const newPriorityScore = Math.min(100, Math.max(1, existing.priority_score + data.priority_delta));

    await this.updateSignalProjection(data.signal_id, {
      work_item_id: data.work_item_id,
      priority_score: newPriorityScore,
      updated_at: now,
      last_event_sequence: sequence,
    });
  }

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  private async getSignalDetail(signalId: string): Promise<SignalDetailProjection | null> {
    const { data } = await this.supabase
      .from('signal_projections')
      .select('*')
      .eq('signal_id', signalId)
      .single();

    return data as SignalDetailProjection | null;
  }

  private async upsertSignalProjection(projection: SignalDetailProjection): Promise<void> {
    await this.supabase
      .from('signal_projections')
      .upsert(projection, { onConflict: 'signal_id' });
  }

  private async updateSignalProjection(
    signalId: string,
    updates: Partial<SignalDetailProjection>
  ): Promise<void> {
    await this.supabase
      .from('signal_projections')
      .update(updates)
      .eq('signal_id', signalId);
  }

  private async updateEntitySignals(
    entityType: SignalEntityRef['type'],
    entityId: string,
    entityName: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get all signals for this entity
    const { data: activeSignals } = await this.supabase
      .from('signal_projections')
      .select('signal_id, severity')
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .in('status', ['active', 'acknowledged'])
      .order('priority_score', { ascending: false });

    const { data: resolvedSignals } = await this.supabase
      .from('signal_projections')
      .select('signal_id, severity, resolution_type')
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .eq('status', 'resolved')
      .gte('resolved_at', thirtyDaysAgo);

    const active = activeSignals || [];
    const resolved = resolvedSignals || [];

    const projection: SignalsByEntityProjection = {
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      active_signal_ids: active.map(s => s.signal_id),
      active_count: active.length,
      resolved_signal_ids: resolved.map(s => s.signal_id),
      resolved_count: resolved.length,
      total_signals_30d: active.length + resolved.length,
      critical_signals_30d: [...active, ...resolved].filter(s => s.severity === 'critical').length,
      false_positive_count_30d: resolved.filter(s => s.resolution_type === 'false_positive').length,
      last_event_sequence: 0, // Will be updated properly
      last_projected_at: now,
    };

    await this.supabase
      .from('signal_entity_projections')
      .upsert(projection, { onConflict: 'entity_type,entity_id' });
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private getSignalId(event: SignalEvent): string | null {
    switch (event.event_type) {
      case 'SignalDetected':
        return (event as SignalDetectedEvent).event_data.signal_id;
      case 'SignalAcknowledged':
        return (event as SignalAcknowledgedEvent).event_data.signal_id;
      case 'SignalResolved':
        return (event as SignalResolvedEvent).event_data.signal_id;
      case 'SignalEscalated':
        return (event as SignalEscalatedEvent).event_data.signal_id;
      case 'SignalWorkItemCreated':
        return (event as SignalWorkItemCreatedEvent).event_data.signal_id;
      case 'SignalWorkItemAttached':
        return (event as SignalWorkItemAttachedEvent).event_data.signal_id;
      default:
        return null;
    }
  }

  private getSeverityBaseScore(severity: SignalSeverity): number {
    return {
      critical: 40,
      high: 30,
      medium: 20,
      low: 10,
    }[severity];
  }

  private calculatePriorityScore(factors: SignalDetailProjection['priority_factors']): number {
    const base = Math.min(40, Math.max(0, factors.base_score));
    const recency = Math.min(20, Math.max(0, factors.recency_bonus));
    const valueAdjustedBase = base * Math.min(2.0, Math.max(0.5, factors.value_multiplier));
    const engagement = Math.min(20, Math.max(0, factors.engagement_factor));
    const total = Math.round(valueAdjustedBase + recency + engagement);
    return Math.min(100, Math.max(1, total));
  }

  private parseEvent(rawEvent: any): SignalEvent | null {
    if (!rawEvent || !rawEvent.event_type) return null;

    return {
      event_type: rawEvent.event_type,
      event_data: rawEvent.event_data,
      sequence_number: rawEvent.sequence_number,
      occurred_at: rawEvent.occurred_at,
    } as SignalEvent;
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get active signals for a user (via entity ownership or assignment)
 */
export async function getActiveSignalsForUser(
  supabase: SupabaseClient,
  userId: string,
  options: { limit?: number; offset?: number; severity?: SignalSeverity[] } = {}
): Promise<SignalDetailProjection[]> {
  const { limit = 50, offset = 0, severity } = options;

  let query = supabase
    .from('signal_projections')
    .select('*')
    .in('status', ['active', 'acknowledged'])
    .order('priority_score', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (severity && severity.length > 0) {
    query = query.in('severity', severity);
  }

  const { data } = await query;
  return (data || []) as SignalDetailProjection[];
}

/**
 * Get signal detail projection
 */
export async function getSignalDetail(
  supabase: SupabaseClient,
  signalId: string
): Promise<SignalDetailProjection | null> {
  const { data } = await supabase
    .from('signal_projections')
    .select('*')
    .eq('signal_id', signalId)
    .single();

  return data as SignalDetailProjection | null;
}

/**
 * Get signals for a specific entity
 */
export async function getSignalsForEntity(
  supabase: SupabaseClient,
  entityType: SignalEntityRef['type'],
  entityId: string,
  options: { includeResolved?: boolean; limit?: number } = {}
): Promise<SignalDetailProjection[]> {
  const { includeResolved = false, limit = 20 } = options;

  let query = supabase
    .from('signal_projections')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('priority_score', { ascending: false })
    .limit(limit);

  if (!includeResolved) {
    query = query.in('status', ['active', 'acknowledged']);
  }

  const { data } = await query;
  return (data || []) as SignalDetailProjection[];
}

/**
 * Get signals by type for tuning/admin view
 */
export async function getSignalsByType(
  supabase: SupabaseClient,
  signalType: SignalType,
  options: {
    limit?: number;
    offset?: number;
    status?: SignalStatus[];
    fromDate?: string;
    toDate?: string;
  } = {}
): Promise<SignalDetailProjection[]> {
  const { limit = 50, offset = 0, status, fromDate, toDate } = options;

  let query = supabase
    .from('signal_projections')
    .select('*')
    .eq('signal_type', signalType)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status.length > 0) {
    query = query.in('status', status);
  }

  if (fromDate) {
    query = query.gte('created_at', fromDate);
  }

  if (toDate) {
    query = query.lte('created_at', toDate);
  }

  const { data } = await query;
  return (data || []) as SignalDetailProjection[];
}

/**
 * Get signal statistics for tuning view
 */
export async function getSignalStats(
  supabase: SupabaseClient,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<{
  byType: Array<{ signal_type: SignalType; count: number; false_positive_count: number }>;
  bySeverity: Array<{ severity: SignalSeverity; count: number }>;
  byDetectionSource: Array<{ source: string; count: number }>;
  totalActive: number;
  totalResolved: number;
  avgTimeToResolution: number | null;
}> {
  const { fromDate, toDate } = options;

  // Get counts by type
  let typeQuery = supabase
    .from('signal_projections')
    .select('signal_type, resolution_type');

  if (fromDate) typeQuery = typeQuery.gte('created_at', fromDate);
  if (toDate) typeQuery = typeQuery.lte('created_at', toDate);

  const { data: typeData } = await typeQuery;

  const typeStats = new Map<SignalType, { count: number; false_positive_count: number }>();
  for (const row of typeData || []) {
    const existing = typeStats.get(row.signal_type) || { count: 0, false_positive_count: 0 };
    existing.count++;
    if (row.resolution_type === 'false_positive') existing.false_positive_count++;
    typeStats.set(row.signal_type, existing);
  }

  // Get counts by severity
  let severityQuery = supabase
    .from('signal_projections')
    .select('severity');

  if (fromDate) severityQuery = severityQuery.gte('created_at', fromDate);
  if (toDate) severityQuery = severityQuery.lte('created_at', toDate);

  const { data: severityData } = await severityQuery;

  const severityStats = new Map<SignalSeverity, number>();
  for (const row of severityData || []) {
    severityStats.set(row.severity, (severityStats.get(row.severity) || 0) + 1);
  }

  // Get counts by detection source
  let sourceQuery = supabase
    .from('signal_projections')
    .select('detection_source');

  if (fromDate) sourceQuery = sourceQuery.gte('created_at', fromDate);
  if (toDate) sourceQuery = sourceQuery.lte('created_at', toDate);

  const { data: sourceData } = await sourceQuery;

  const sourceStats = new Map<string, number>();
  for (const row of sourceData || []) {
    sourceStats.set(row.detection_source, (sourceStats.get(row.detection_source) || 0) + 1);
  }

  // Get active/resolved counts
  const { count: activeCount } = await supabase
    .from('signal_projections')
    .select('*', { count: 'exact', head: true })
    .in('status', ['active', 'acknowledged']);

  const { count: resolvedCount } = await supabase
    .from('signal_projections')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'resolved');

  return {
    byType: Array.from(typeStats.entries()).map(([signal_type, stats]) => ({
      signal_type,
      ...stats,
    })),
    bySeverity: Array.from(severityStats.entries()).map(([severity, count]) => ({
      severity,
      count,
    })),
    byDetectionSource: Array.from(sourceStats.entries()).map(([source, count]) => ({
      source,
      count,
    })),
    totalActive: activeCount || 0,
    totalResolved: resolvedCount || 0,
    avgTimeToResolution: null, // TODO: Calculate from resolved_at - created_at
  };
}

/**
 * Get signals that need to expire (for cron job)
 */
export async function getExpiredSignals(
  supabase: SupabaseClient
): Promise<SignalDetailProjection[]> {
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('signal_projections')
    .select('*')
    .in('status', ['active', 'acknowledged'])
    .lte('expires_at', now);

  return (data || []) as SignalDetailProjection[];
}
