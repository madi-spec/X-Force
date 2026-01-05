/**
 * WorkItem Projector Idempotency Tests
 *
 * Validates that the projector is idempotent:
 * - Processing the same event twice produces identical state
 * - Replaying all events produces the same final state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WorkItemProjector,
  WorkQueueProjection,
  WorkItemDetailProjection,
} from '@/lib/work/projections';
import {
  WorkItemCreatedEvent,
  WorkItemResolvedEvent,
  WorkItemSnoozedEvent,
  WorkItemSignalAttachedEvent,
  WorkItemPriorityUpdatedEvent,
  CreateWorkItemInput,
} from '@/lib/work/events';

// Mock Supabase client
const createMockSupabase = () => {
  const itemStore = new Map<string, WorkItemDetailProjection>();
  const queueStore = new Map<string, WorkQueueProjection>();

  return {
    from: vi.fn((table: string) => {
      if (table === 'work_item_projections') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(async () => {
            // Return mock data based on what was stored
            const mockId = 'test-work-item-1';
            const item = itemStore.get(mockId);
            return { data: item || null, error: null };
          }),
          upsert: vi.fn().mockImplementation(async (data: WorkItemDetailProjection) => {
            itemStore.set(data.work_item_id, data);
            return { data, error: null };
          }),
          update: vi.fn().mockImplementation(async (updates: Partial<WorkItemDetailProjection>) => {
            const mockId = 'test-work-item-1';
            const existing = itemStore.get(mockId);
            if (existing) {
              itemStore.set(mockId, { ...existing, ...updates });
            }
            return { data: null, error: null };
          }),
          delete: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockImplementation(async () => {
            return { data: Array.from(itemStore.values()), error: null };
          }),
        };
      }

      if (table === 'work_queue_projections') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(async () => {
            return { data: null, error: null };
          }),
          upsert: vi.fn().mockImplementation(async (data: WorkQueueProjection) => {
            const key = `${data.user_id}:${data.focus_lens}:${data.queue_id}`;
            queueStore.set(key, data);
            return { data, error: null };
          }),
        };
      }

      if (table === 'event_store') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(async () => {
            return { data: { sequence_number: 0 }, error: null };
          }),
          insert: vi.fn().mockImplementation(async () => {
            return { data: null, error: null };
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(async () => ({ data: null, error: null })),
      };
    }),
    _itemStore: itemStore,
    _queueStore: queueStore,
  };
};

describe('WorkItemProjector', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let projector: WorkItemProjector;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    projector = new WorkItemProjector(mockSupabase as any);
  });

  describe('Idempotency', () => {
    it('processing the same WorkItemCreated event twice produces identical state', async () => {
      const event: WorkItemCreatedEvent = {
        event_type: 'WorkItemCreated',
        event_data: {
          work_item_id: 'test-work-item-1',
          focus_lens: 'sales',
          queue_id: 'follow_ups',
          company_id: 'company-1',
          company_name: 'Test Company',
          source_type: 'communication',
          signal_type: 'message_needs_reply',
          title: 'Follow up with Test Company',
          subtitle: 'Waiting for response',
          why_here: 'Customer replied to your email and is waiting for a response',
          priority: 'high',
          priority_score: 75,
          assigned_to_user_id: 'user-1',
        },
        actor_type: 'system',
        actor_id: 'system',
        occurred_at: new Date().toISOString(),
        sequence_number: 1,
      } as any;

      // First processing
      const result1 = await projector.projectEvent(event);
      const state1 = mockSupabase._itemStore.get('test-work-item-1');

      // Second processing of the same event
      const result2 = await projector.projectEvent(event);
      const state2 = mockSupabase._itemStore.get('test-work-item-1');

      expect(result1).toBe(true);
      expect(result2).toBe(false); // Should skip duplicate
      expect(state1).toEqual(state2);
    });

    it('processing events in order produces expected final state', async () => {
      const createEvent: WorkItemCreatedEvent = {
        event_type: 'WorkItemCreated',
        event_data: {
          work_item_id: 'test-work-item-1',
          focus_lens: 'sales',
          queue_id: 'follow_ups',
          company_id: 'company-1',
          company_name: 'Test Company',
          source_type: 'communication',
          signal_type: 'message_needs_reply',
          title: 'Follow up with Test Company',
          subtitle: 'Waiting for response',
          why_here: 'Initial reason',
          priority: 'medium',
          priority_score: 50,
          assigned_to_user_id: 'user-1',
        },
        actor_type: 'system',
        actor_id: 'system',
        occurred_at: new Date().toISOString(),
        sequence_number: 1,
      } as any;

      const priorityEvent: WorkItemPriorityUpdatedEvent = {
        event_type: 'WorkItemPriorityUpdated',
        event_data: {
          work_item_id: 'test-work-item-1',
          previous_priority: 'medium',
          new_priority: 'high',
          previous_score: 50,
          new_score: 80,
          reason: 'Escalated due to SLA risk',
        },
        actor_type: 'system',
        actor_id: 'system',
        occurred_at: new Date().toISOString(),
        sequence_number: 2,
      } as any;

      // Process events in order
      await projector.projectEvent(createEvent);
      await projector.projectEvent(priorityEvent);

      const finalState = mockSupabase._itemStore.get('test-work-item-1');

      expect(finalState).toBeDefined();
      expect(finalState?.priority).toBe('high');
      expect(finalState?.priority_score).toBe(80);
      expect(finalState?.status).toBe('open');
    });

    it('signal attachment is idempotent', async () => {
      // Set up initial state
      const initialState: WorkItemDetailProjection = {
        work_item_id: 'test-work-item-1',
        focus_lens: 'sales',
        queue_id: 'follow_ups',
        company_id: 'company-1',
        company_name: 'Test Company',
        deal_id: null,
        case_id: null,
        communication_id: null,
        contact_id: null,
        source_type: 'communication',
        signal_type: 'message_needs_reply',
        signal_id: null,
        title: 'Test Item',
        subtitle: 'Subtitle',
        why_here: 'Initial reason',
        priority: 'medium',
        priority_score: 50,
        status: 'open',
        snoozed_until: null,
        assigned_to_user_id: 'user-1',
        assigned_to_team_id: null,
        resolution_type: null,
        resolution_notes: null,
        resolved_by_action: null,
        resolved_at: null,
        attached_signals: [],
        analysis_artifact_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_event_sequence: 1,
      };
      mockSupabase._itemStore.set('test-work-item-1', initialState);

      const signalEvent: WorkItemSignalAttachedEvent = {
        event_type: 'WorkItemSignalAttached',
        event_data: {
          work_item_id: 'test-work-item-1',
          signal_type: 'follow_up_due',
          signal_id: 'signal-1',
          signal_source: 'scheduler',
          signal_summary: 'Follow-up is overdue',
          priority_delta: 10,
          updated_why_here: 'Updated reason with new signal',
        },
        actor_type: 'system',
        actor_id: 'system',
        occurred_at: new Date().toISOString(),
        sequence_number: 2,
      } as any;

      // Process twice
      await projector.projectEvent(signalEvent);
      const stateAfterFirst = { ...mockSupabase._itemStore.get('test-work-item-1')! };

      await projector.projectEvent(signalEvent);
      const stateAfterSecond = mockSupabase._itemStore.get('test-work-item-1');

      // States should be identical (no duplicate signals added)
      expect(stateAfterFirst.attached_signals.length).toBe(1);
      expect(stateAfterSecond?.attached_signals.length).toBe(1);
      expect(stateAfterFirst.priority_score).toBe(60); // 50 + 10
    });
  });

  describe('State Transitions', () => {
    it('snoozing changes status to snoozed', async () => {
      // Set up initial state
      const initialState: WorkItemDetailProjection = {
        work_item_id: 'test-work-item-1',
        focus_lens: 'sales',
        queue_id: 'follow_ups',
        company_id: 'company-1',
        company_name: 'Test Company',
        deal_id: null,
        case_id: null,
        communication_id: null,
        contact_id: null,
        source_type: 'communication',
        signal_type: 'message_needs_reply',
        signal_id: null,
        title: 'Test Item',
        subtitle: 'Subtitle',
        why_here: 'Reason',
        priority: 'medium',
        priority_score: 50,
        status: 'open',
        snoozed_until: null,
        assigned_to_user_id: 'user-1',
        assigned_to_team_id: null,
        resolution_type: null,
        resolution_notes: null,
        resolved_by_action: null,
        resolved_at: null,
        attached_signals: [],
        analysis_artifact_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_event_sequence: 1,
      };
      mockSupabase._itemStore.set('test-work-item-1', initialState);

      const snoozeEvent: WorkItemSnoozedEvent = {
        event_type: 'WorkItemSnoozed',
        event_data: {
          work_item_id: 'test-work-item-1',
          snooze_until: '2024-01-15T09:00:00Z',
          snooze_reason: 'Waiting for customer callback',
        },
        actor_type: 'user',
        actor_id: 'user-1',
        occurred_at: new Date().toISOString(),
        sequence_number: 2,
      } as any;

      await projector.projectEvent(snoozeEvent);

      const state = mockSupabase._itemStore.get('test-work-item-1');
      expect(state?.status).toBe('snoozed');
      expect(state?.snoozed_until).toBe('2024-01-15T09:00:00Z');
    });

    it('resolving changes status to resolved', async () => {
      // Set up initial state
      const initialState: WorkItemDetailProjection = {
        work_item_id: 'test-work-item-1',
        focus_lens: 'sales',
        queue_id: 'follow_ups',
        company_id: 'company-1',
        company_name: 'Test Company',
        deal_id: null,
        case_id: null,
        communication_id: null,
        contact_id: null,
        source_type: 'communication',
        signal_type: 'message_needs_reply',
        signal_id: null,
        title: 'Test Item',
        subtitle: 'Subtitle',
        why_here: 'Reason',
        priority: 'medium',
        priority_score: 50,
        status: 'open',
        snoozed_until: null,
        assigned_to_user_id: 'user-1',
        assigned_to_team_id: null,
        resolution_type: null,
        resolution_notes: null,
        resolved_by_action: null,
        resolved_at: null,
        attached_signals: [],
        analysis_artifact_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_event_sequence: 1,
      };
      mockSupabase._itemStore.set('test-work-item-1', initialState);

      const resolveEvent: WorkItemResolvedEvent = {
        event_type: 'WorkItemResolved',
        event_data: {
          work_item_id: 'test-work-item-1',
          resolution_type: 'completed',
          resolution_notes: 'Replied to customer',
          resolved_by_action: 'replied',
        },
        actor_type: 'user',
        actor_id: 'user-1',
        occurred_at: new Date().toISOString(),
        sequence_number: 2,
      } as any;

      await projector.projectEvent(resolveEvent);

      const state = mockSupabase._itemStore.get('test-work-item-1');
      expect(state?.status).toBe('resolved');
      expect(state?.resolution_type).toBe('completed');
      expect(state?.resolved_by_action).toBe('replied');
      expect(state?.resolved_at).toBeDefined();
    });
  });

  describe('Priority Scoring', () => {
    it('correctly maps scores to priority tiers', () => {
      // Access the private method via prototype for testing
      const scoreToPriority = (projector as any).scoreToPriority.bind(projector);

      expect(scoreToPriority(95)).toBe('critical');
      expect(scoreToPriority(90)).toBe('critical');
      expect(scoreToPriority(89)).toBe('high');
      expect(scoreToPriority(70)).toBe('high');
      expect(scoreToPriority(69)).toBe('medium');
      expect(scoreToPriority(40)).toBe('medium');
      expect(scoreToPriority(39)).toBe('low');
      expect(scoreToPriority(0)).toBe('low');
    });
  });
});

describe('Event Sequence Checkpointing', () => {
  it('tracks last processed event sequence', async () => {
    const mockSupabase = createMockSupabase();
    const projector = new WorkItemProjector(mockSupabase as any);

    const event: WorkItemCreatedEvent = {
      event_type: 'WorkItemCreated',
      event_data: {
        work_item_id: 'test-work-item-1',
        focus_lens: 'sales',
        queue_id: 'follow_ups',
        company_id: 'company-1',
        company_name: 'Test Company',
        source_type: 'communication',
        signal_type: 'message_needs_reply',
        title: 'Test',
        subtitle: 'Sub',
        why_here: 'Reason',
        priority: 'medium',
        priority_score: 50,
      },
      actor_type: 'system',
      actor_id: 'system',
      occurred_at: new Date().toISOString(),
      sequence_number: 5,
    } as any;

    await projector.projectEvent(event);

    const state = mockSupabase._itemStore.get('test-work-item-1');
    expect(state?.last_event_sequence).toBe(5);
  });

  it('skips events with sequence <= last processed', async () => {
    const mockSupabase = createMockSupabase();
    const projector = new WorkItemProjector(mockSupabase as any);

    // Set up state with sequence 5 already processed
    const initialState: WorkItemDetailProjection = {
      work_item_id: 'test-work-item-1',
      focus_lens: 'sales',
      queue_id: 'follow_ups',
      company_id: 'company-1',
      company_name: 'Test Company',
      deal_id: null,
      case_id: null,
      communication_id: null,
      contact_id: null,
      source_type: 'communication',
      signal_type: 'message_needs_reply',
      signal_id: null,
      title: 'Test',
      subtitle: 'Sub',
      why_here: 'Reason',
      priority: 'medium',
      priority_score: 50,
      status: 'open',
      snoozed_until: null,
      assigned_to_user_id: null,
      assigned_to_team_id: null,
      resolution_type: null,
      resolution_notes: null,
      resolved_by_action: null,
      resolved_at: null,
      attached_signals: [],
      analysis_artifact_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_event_sequence: 5,
    };
    mockSupabase._itemStore.set('test-work-item-1', initialState);

    // Try to process event with sequence 3 (already processed)
    const oldEvent: WorkItemPriorityUpdatedEvent = {
      event_type: 'WorkItemPriorityUpdated',
      event_data: {
        work_item_id: 'test-work-item-1',
        previous_priority: 'medium',
        new_priority: 'critical',
        previous_score: 50,
        new_score: 100,
        reason: 'Old event',
      },
      actor_type: 'system',
      actor_id: 'system',
      occurred_at: new Date().toISOString(),
      sequence_number: 3,
    } as any;

    const result = await projector.projectEvent(oldEvent);

    expect(result).toBe(false);
    const state = mockSupabase._itemStore.get('test-work-item-1');
    expect(state?.priority).toBe('medium'); // Should not have changed
    expect(state?.priority_score).toBe(50);
  });
});
