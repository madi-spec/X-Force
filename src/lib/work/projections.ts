/**
 * Work Item Projections
 *
 * Materialized views derived from WorkItem events.
 * All projections are idempotent: replaying events produces identical state.
 *
 * Key insight: Each event has a unique (aggregate_id, sequence_number) that
 * we use as a checkpoint. On replay, we skip events already processed.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { LensType } from '@/lib/lens/types';
import {
  WorkItemEvent,
  WorkItemCreatedEvent,
  WorkItemSignalAttachedEvent,
  WorkItemAssignedEvent,
  WorkItemResolvedEvent,
  WorkItemSnoozedEvent,
  WorkItemReopenedEvent,
  WorkItemPriorityUpdatedEvent,
  WorkItemSourceType,
  WorkItemSignalType,
  WorkItemStatus,
  WorkItemPriority,
} from './events';
import { QueueId } from './types';

// ============================================================================
// PROJECTION TYPES
// ============================================================================

/**
 * WorkQueueProjection - Queue listing for a user's focus lens
 * Keyed by: userId + focusLens + queueId
 */
export interface WorkQueueProjection {
  user_id: string;
  focus_lens: LensType;
  queue_id: QueueId;

  // Queue summary
  total_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;

  // Items (sorted by priority_score DESC, then created_at ASC)
  item_ids: string[];

  // Projection metadata
  last_event_sequence: number;
  last_projected_at: string;
}

/**
 * WorkItemDetailProjection - Full detail for a single work item
 * Keyed by: workItemId
 */
export interface WorkItemDetailProjection {
  work_item_id: string;
  focus_lens: LensType;
  queue_id: QueueId;

  // Entity references (immutable from created event)
  company_id: string;
  company_name: string;
  deal_id: string | null;
  case_id: string | null;
  communication_id: string | null;
  contact_id: string | null;

  // Deep linking for communications (for opening drawer to exact message)
  trigger_communication_id: string | null;
  trigger_message_id: string | null;

  // Source signal (from created event)
  source_type: WorkItemSourceType;
  signal_type: WorkItemSignalType;
  signal_id: string | null;

  // Display (mutable via events)
  title: string;
  subtitle: string;
  why_here: string;
  priority: WorkItemPriority;
  priority_score: number;

  // Status (derived from events)
  status: WorkItemStatus;
  snoozed_until: string | null;

  // Assignment (mutable via events)
  assigned_to_user_id: string | null;
  assigned_to_team_id: string | null;

  // Resolution (set when resolved)
  resolution_type: 'completed' | 'cancelled' | 'merged' | 'invalid' | null;
  resolution_notes: string | null;
  resolved_by_action: string | null;
  resolved_at: string | null;

  // Attached signals (accumulated)
  attached_signals: AttachedSignal[];

  // Analysis artifact
  analysis_artifact_id: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Event replay checkpoint
  last_event_sequence: number;
}

export interface AttachedSignal {
  signal_id: string;
  signal_type: WorkItemSignalType;
  signal_source: WorkItemSourceType;
  signal_summary: string;
  attached_at: string;
}

// ============================================================================
// PROJECTOR - IDEMPOTENT EVENT PROCESSOR
// ============================================================================

/**
 * WorkItemProjector
 *
 * Processes WorkItem events and updates projections idempotently.
 * Each event is processed exactly once using sequence number tracking.
 */
export class WorkItemProjector {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Project a single event into the relevant projections
   * Returns true if the event was processed, false if already processed
   */
  async projectEvent(event: WorkItemEvent): Promise<boolean> {
    const eventSequence = (event as any).sequence_number || 0;
    const workItemId = event.event_data.work_item_id;

    // Get current projection to check if event already processed
    const existing = await this.getItemDetail(workItemId);
    if (existing && existing.last_event_sequence >= eventSequence) {
      // Event already processed - idempotency check
      return false;
    }

    // Process event based on type
    switch (event.event_type) {
      case 'WorkItemCreated':
        await this.handleCreated(event as WorkItemCreatedEvent, eventSequence);
        break;
      case 'WorkItemSignalAttached':
        await this.handleSignalAttached(event as WorkItemSignalAttachedEvent, eventSequence);
        break;
      case 'WorkItemAssigned':
        await this.handleAssigned(event as WorkItemAssignedEvent, eventSequence);
        break;
      case 'WorkItemResolved':
        await this.handleResolved(event as WorkItemResolvedEvent, eventSequence);
        break;
      case 'WorkItemSnoozed':
        await this.handleSnoozed(event as WorkItemSnoozedEvent, eventSequence);
        break;
      case 'WorkItemReopened':
        await this.handleReopened(event as WorkItemReopenedEvent, eventSequence);
        break;
      case 'WorkItemPriorityUpdated':
        await this.handlePriorityUpdated(event as WorkItemPriorityUpdatedEvent, eventSequence);
        break;
    }

    return true;
  }

  /**
   * Replay all events for a work item to rebuild its projection
   * Used for recovery or reindexing
   */
  async replayWorkItem(workItemId: string): Promise<void> {
    // Delete existing projection
    await this.supabase
      .from('work_item_projections')
      .delete()
      .eq('work_item_id', workItemId);

    // Fetch all events for this work item
    const { data: events } = await this.supabase
      .from('event_store')
      .select('*')
      .eq('aggregate_type', 'work_item')
      .eq('aggregate_id', workItemId)
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

  /**
   * Rebuild queue projection for a user/lens combination
   */
  async rebuildQueueProjection(userId: string, focusLens: LensType): Promise<void> {
    // Get all open items assigned to this user in this focus
    const { data: items } = await this.supabase
      .from('work_item_projections')
      .select('*')
      .eq('assigned_to_user_id', userId)
      .eq('focus_lens', focusLens)
      .eq('status', 'open');

    if (!items) return;

    // Group by queue
    const queueGroups = new Map<QueueId, WorkItemDetailProjection[]>();
    for (const item of items) {
      const existing = queueGroups.get(item.queue_id) || [];
      existing.push(item);
      queueGroups.set(item.queue_id, existing);
    }

    // Update each queue projection
    for (const [queueId, queueItems] of queueGroups) {
      await this.updateQueueProjection(userId, focusLens, queueId, queueItems);
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  private async handleCreated(
    event: WorkItemCreatedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;
    const now = new Date().toISOString();

    const projection: WorkItemDetailProjection = {
      work_item_id: data.work_item_id,
      focus_lens: data.focus_lens,
      queue_id: data.queue_id,
      company_id: data.company_id,
      company_name: data.company_name,
      deal_id: data.deal_id || null,
      case_id: data.case_id || null,
      communication_id: data.communication_id || null,
      contact_id: data.contact_id || null,
      // Deep linking for communications
      trigger_communication_id: data.trigger_communication_id || null,
      trigger_message_id: data.trigger_message_id || null,
      source_type: data.source_type,
      signal_type: data.signal_type,
      signal_id: data.signal_id || null,
      title: data.title,
      subtitle: data.subtitle,
      why_here: data.why_here,
      priority: data.priority,
      priority_score: data.priority_score,
      status: 'open',
      snoozed_until: null,
      assigned_to_user_id: data.assigned_to_user_id || null,
      assigned_to_team_id: data.assigned_to_team_id || null,
      resolution_type: null,
      resolution_notes: null,
      resolved_by_action: null,
      resolved_at: null,
      attached_signals: [],
      analysis_artifact_id: data.analysis_artifact_id || null,
      created_at: (event as any).occurred_at || now,
      updated_at: now,
      last_event_sequence: sequence,
    };

    await this.upsertItemProjection(projection);

    // Update queue projection if assigned
    if (data.assigned_to_user_id) {
      await this.updateQueueAfterChange(
        data.assigned_to_user_id,
        data.focus_lens,
        data.queue_id
      );
    }
  }

  private async handleSignalAttached(
    event: WorkItemSignalAttachedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;

    const existing = await this.getItemDetail(data.work_item_id);
    if (!existing) return;

    const newSignal: AttachedSignal = {
      signal_id: data.signal_id,
      signal_type: data.signal_type,
      signal_source: data.signal_source,
      signal_summary: data.signal_summary,
      attached_at: (event as any).occurred_at || new Date().toISOString(),
    };

    // Update projection with new signal
    const updates: Partial<WorkItemDetailProjection> = {
      attached_signals: [...existing.attached_signals, newSignal],
      priority_score: existing.priority_score + data.priority_delta,
      updated_at: new Date().toISOString(),
      last_event_sequence: sequence,
    };

    // Update why_here if provided
    if (data.updated_why_here) {
      updates.why_here = data.updated_why_here;
    }

    // Recalculate priority tier
    updates.priority = this.scoreToPriority(updates.priority_score!);

    await this.updateItemProjection(data.work_item_id, updates);

    if (existing.assigned_to_user_id) {
      await this.updateQueueAfterChange(
        existing.assigned_to_user_id,
        existing.focus_lens,
        existing.queue_id
      );
    }
  }

  private async handleAssigned(
    event: WorkItemAssignedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;

    const existing = await this.getItemDetail(data.work_item_id);
    if (!existing) return;

    await this.updateItemProjection(data.work_item_id, {
      assigned_to_user_id: data.new_user_id,
      assigned_to_team_id: data.new_team_id,
      updated_at: new Date().toISOString(),
      last_event_sequence: sequence,
    });

    // Update old user's queue
    if (data.previous_user_id) {
      await this.updateQueueAfterChange(
        data.previous_user_id,
        existing.focus_lens,
        existing.queue_id
      );
    }

    // Update new user's queue
    if (data.new_user_id) {
      await this.updateQueueAfterChange(
        data.new_user_id,
        existing.focus_lens,
        existing.queue_id
      );
    }
  }

  private async handleResolved(
    event: WorkItemResolvedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;

    const existing = await this.getItemDetail(data.work_item_id);
    if (!existing) return;

    const now = new Date().toISOString();

    await this.updateItemProjection(data.work_item_id, {
      status: 'resolved',
      resolution_type: data.resolution_type,
      resolution_notes: data.resolution_notes || null,
      resolved_by_action: data.resolved_by_action || null,
      resolved_at: now,
      updated_at: now,
      last_event_sequence: sequence,
    });

    if (existing.assigned_to_user_id) {
      await this.updateQueueAfterChange(
        existing.assigned_to_user_id,
        existing.focus_lens,
        existing.queue_id
      );
    }
  }

  private async handleSnoozed(
    event: WorkItemSnoozedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;

    const existing = await this.getItemDetail(data.work_item_id);
    if (!existing) return;

    await this.updateItemProjection(data.work_item_id, {
      status: 'snoozed',
      snoozed_until: data.snooze_until,
      updated_at: new Date().toISOString(),
      last_event_sequence: sequence,
    });

    if (existing.assigned_to_user_id) {
      await this.updateQueueAfterChange(
        existing.assigned_to_user_id,
        existing.focus_lens,
        existing.queue_id
      );
    }
  }

  private async handleReopened(
    event: WorkItemReopenedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;

    const existing = await this.getItemDetail(data.work_item_id);
    if (!existing) return;

    await this.updateItemProjection(data.work_item_id, {
      status: 'open',
      snoozed_until: null,
      updated_at: new Date().toISOString(),
      last_event_sequence: sequence,
    });

    if (existing.assigned_to_user_id) {
      await this.updateQueueAfterChange(
        existing.assigned_to_user_id,
        existing.focus_lens,
        existing.queue_id
      );
    }
  }

  private async handlePriorityUpdated(
    event: WorkItemPriorityUpdatedEvent,
    sequence: number
  ): Promise<void> {
    const { event_data: data } = event;

    const existing = await this.getItemDetail(data.work_item_id);
    if (!existing) return;

    await this.updateItemProjection(data.work_item_id, {
      priority: data.new_priority,
      priority_score: data.new_score,
      updated_at: new Date().toISOString(),
      last_event_sequence: sequence,
    });

    if (existing.assigned_to_user_id) {
      await this.updateQueueAfterChange(
        existing.assigned_to_user_id,
        existing.focus_lens,
        existing.queue_id
      );
    }
  }

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  private async getItemDetail(workItemId: string): Promise<WorkItemDetailProjection | null> {
    const { data } = await this.supabase
      .from('work_item_projections')
      .select('*')
      .eq('work_item_id', workItemId)
      .single();

    return data as WorkItemDetailProjection | null;
  }

  private async upsertItemProjection(projection: WorkItemDetailProjection): Promise<void> {
    await this.supabase
      .from('work_item_projections')
      .upsert(projection, { onConflict: 'work_item_id' });
  }

  private async updateItemProjection(
    workItemId: string,
    updates: Partial<WorkItemDetailProjection>
  ): Promise<void> {
    await this.supabase
      .from('work_item_projections')
      .update(updates)
      .eq('work_item_id', workItemId);
  }

  private async updateQueueAfterChange(
    userId: string,
    focusLens: LensType,
    queueId: QueueId
  ): Promise<void> {
    // Get all open items in this queue for this user
    const { data: items } = await this.supabase
      .from('work_item_projections')
      .select('*')
      .eq('assigned_to_user_id', userId)
      .eq('focus_lens', focusLens)
      .eq('queue_id', queueId)
      .eq('status', 'open')
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: true });

    await this.updateQueueProjection(
      userId,
      focusLens,
      queueId,
      (items || []) as WorkItemDetailProjection[]
    );
  }

  private async updateQueueProjection(
    userId: string,
    focusLens: LensType,
    queueId: QueueId,
    items: WorkItemDetailProjection[]
  ): Promise<void> {
    const now = new Date().toISOString();

    const projection: WorkQueueProjection = {
      user_id: userId,
      focus_lens: focusLens,
      queue_id: queueId,
      total_count: items.length,
      critical_count: items.filter(i => i.priority === 'critical').length,
      high_count: items.filter(i => i.priority === 'high').length,
      medium_count: items.filter(i => i.priority === 'medium').length,
      low_count: items.filter(i => i.priority === 'low').length,
      item_ids: items.map(i => i.work_item_id),
      last_event_sequence: Math.max(0, ...items.map(i => i.last_event_sequence)),
      last_projected_at: now,
    };

    // Upsert with composite key
    await this.supabase
      .from('work_queue_projections')
      .upsert(projection, {
        onConflict: 'user_id,focus_lens,queue_id',
      });
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private scoreToPriority(score: number): WorkItemPriority {
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private parseEvent(rawEvent: any): WorkItemEvent | null {
    if (!rawEvent || !rawEvent.event_type) return null;

    return {
      event_type: rawEvent.event_type,
      event_data: rawEvent.event_data,
      sequence_number: rawEvent.sequence_number,
      occurred_at: rawEvent.occurred_at,
      actor_type: rawEvent.actor_type,
      actor_id: rawEvent.actor_id,
    } as WorkItemEvent;
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get queue projection for a user/lens/queue combination
 */
export async function getQueueProjection(
  supabase: SupabaseClient,
  userId: string,
  focusLens: LensType,
  queueId: QueueId
): Promise<WorkQueueProjection | null> {
  const { data } = await supabase
    .from('work_queue_projections')
    .select('*')
    .eq('user_id', userId)
    .eq('focus_lens', focusLens)
    .eq('queue_id', queueId)
    .single();

  return data as WorkQueueProjection | null;
}

/**
 * Get all queue projections for a user/lens
 */
export async function getQueuesForUser(
  supabase: SupabaseClient,
  userId: string,
  focusLens: LensType
): Promise<WorkQueueProjection[]> {
  const { data } = await supabase
    .from('work_queue_projections')
    .select('*')
    .eq('user_id', userId)
    .eq('focus_lens', focusLens)
    .order('queue_id');

  return (data || []) as WorkQueueProjection[];
}

/**
 * Get work item detail projection
 */
export async function getWorkItemDetail(
  supabase: SupabaseClient,
  workItemId: string
): Promise<WorkItemDetailProjection | null> {
  const { data } = await supabase
    .from('work_item_projections')
    .select('*')
    .eq('work_item_id', workItemId)
    .single();

  return data as WorkItemDetailProjection | null;
}

/**
 * Get work items in a queue for a user
 */
export async function getQueueItems(
  supabase: SupabaseClient,
  userId: string,
  focusLens: LensType,
  queueId: QueueId,
  options: { limit?: number; offset?: number } = {}
): Promise<WorkItemDetailProjection[]> {
  const { limit = 20, offset = 0 } = options;

  const { data } = await supabase
    .from('work_item_projections')
    .select('*')
    .eq('assigned_to_user_id', userId)
    .eq('focus_lens', focusLens)
    .eq('queue_id', queueId)
    .eq('status', 'open')
    .order('priority_score', { ascending: false })
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  return (data || []) as WorkItemDetailProjection[];
}
