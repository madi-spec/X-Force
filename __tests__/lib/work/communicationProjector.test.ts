/**
 * Tests for Communication + Work Item Projector Idempotency
 *
 * These tests verify that replaying events produces the same projections.
 * Key property: projectors must be idempotent.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkItemProjector, WorkItemDetailProjection } from '../../../src/lib/work/projections';
import {
  WorkItemCreatedEvent,
  WorkItemResolvedEvent,
  WorkItemSignalAttachedEvent,
} from '../../../src/lib/work/events';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
};

function createMockSupabase(data: any = null, error: any = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: data ? [data] : [], error }),
  };

  return {
    from: vi.fn(() => chain),
  } as any;
}

describe('Work Item Projector Idempotency', () => {
  describe('sequence number tracking', () => {
    it('skips events already processed (same sequence number)', async () => {
      // Setup: existing projection with sequence 5
      const existingProjection: Partial<WorkItemDetailProjection> = {
        work_item_id: 'work-123',
        last_event_sequence: 5,
        title: 'Original Title',
      };

      const supabase = createMockSupabase(existingProjection);
      const projector = new WorkItemProjector(supabase);

      // Try to process event with sequence 3 (already processed)
      const event: WorkItemCreatedEvent = {
        event_type: 'WorkItemCreated',
        event_data: {
          work_item_id: 'work-123',
          focus_lens: 'sales',
          queue_id: 'follow_ups',
          company_id: 'company-1',
          company_name: 'Test Company',
          source_type: 'communication',
          signal_type: 'message_needs_reply',
          title: 'New Title', // This should NOT be applied
          subtitle: '',
          why_here: 'Test',
          priority: 'high',
          priority_score: 75,
        },
        sequence_number: 3, // Lower than last_event_sequence
      } as any;

      const wasProcessed = await projector.projectEvent(event);

      // Event should be skipped
      expect(wasProcessed).toBe(false);
    });

    it('processes new events with higher sequence numbers', async () => {
      const existingProjection: Partial<WorkItemDetailProjection> = {
        work_item_id: 'work-123',
        last_event_sequence: 5,
        priority: 'medium',
        priority_score: 50,
        attached_signals: [],
        assigned_to_user_id: 'user-1',
        focus_lens: 'sales',
        queue_id: 'follow_ups',
      };

      const supabase = createMockSupabase(existingProjection);
      const projector = new WorkItemProjector(supabase);

      // Process event with sequence 6 (new)
      const event: WorkItemSignalAttachedEvent = {
        event_type: 'WorkItemSignalAttached',
        event_data: {
          work_item_id: 'work-123',
          signal_type: 'churn_risk',
          signal_id: 'signal-1',
          signal_source: 'command_center',
          signal_summary: 'Customer at risk',
          priority_delta: 20,
        },
        sequence_number: 6,
        occurred_at: new Date().toISOString(),
      } as any;

      const wasProcessed = await projector.projectEvent(event);

      // Event should be processed
      expect(wasProcessed).toBe(true);
    });
  });

  describe('replay produces same state', () => {
    it('replaying same events in order produces identical projection', async () => {
      // Create a sequence of events
      const events = [
        {
          event_type: 'WorkItemCreated',
          event_data: {
            work_item_id: 'work-replay-1',
            focus_lens: 'sales',
            queue_id: 'new_leads',
            company_id: 'company-1',
            company_name: 'Replay Test Co',
            source_type: 'communication',
            signal_type: 'message_needs_reply',
            title: 'Initial Title',
            subtitle: 'Subtitle',
            why_here: 'Test reason',
            priority: 'medium',
            priority_score: 50,
            trigger_communication_id: 'comm-1',
          },
          sequence_number: 1,
          occurred_at: '2024-01-01T10:00:00Z',
        },
        {
          event_type: 'WorkItemSignalAttached',
          event_data: {
            work_item_id: 'work-replay-1',
            signal_type: 'follow_up_due',
            signal_id: 'signal-1',
            signal_source: 'scheduler',
            signal_summary: 'Follow up needed',
            priority_delta: 10,
          },
          sequence_number: 2,
          occurred_at: '2024-01-02T10:00:00Z',
        },
        {
          event_type: 'WorkItemResolved',
          event_data: {
            work_item_id: 'work-replay-1',
            resolution_type: 'completed',
            resolution_notes: 'Replied to customer',
            resolved_by_action: 'replied',
          },
          sequence_number: 3,
          occurred_at: '2024-01-03T10:00:00Z',
        },
      ];

      // Simulate two independent replays
      let projection1: Partial<WorkItemDetailProjection> | null = null;
      let projection2: Partial<WorkItemDetailProjection> | null = null;

      // First replay
      const supabase1 = createMockSupabase(null);
      let currentState1: any = null;
      supabase1.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: currentState1, error: null })),
        upsert: vi.fn().mockImplementation((data) => {
          currentState1 = data;
          projection1 = data;
          return Promise.resolve({ data: null, error: null });
        }),
        update: vi.fn().mockImplementation((data) => ({
          eq: vi.fn().mockImplementation(() => {
            currentState1 = { ...currentState1, ...data };
            projection1 = currentState1;
            return Promise.resolve({ data: null, error: null });
          }),
        })),
        order: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      }));

      const projector1 = new WorkItemProjector(supabase1 as any);
      for (const event of events) {
        await projector1.projectEvent(event as any);
      }

      // Second replay (same events)
      const supabase2 = createMockSupabase(null);
      let currentState2: any = null;
      supabase2.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({ data: currentState2, error: null })),
        upsert: vi.fn().mockImplementation((data) => {
          currentState2 = data;
          projection2 = data;
          return Promise.resolve({ data: null, error: null });
        }),
        update: vi.fn().mockImplementation((data) => ({
          eq: vi.fn().mockImplementation(() => {
            currentState2 = { ...currentState2, ...data };
            projection2 = currentState2;
            return Promise.resolve({ data: null, error: null });
          }),
        })),
        order: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      }));

      const projector2 = new WorkItemProjector(supabase2 as any);
      for (const event of events) {
        await projector2.projectEvent(event as any);
      }

      // Both replays should produce identical state
      expect(projection1).toBeTruthy();
      expect(projection2).toBeTruthy();

      // Compare key fields (ignoring timestamps that might differ slightly)
      expect(projection1?.work_item_id).toBe(projection2?.work_item_id);
      expect(projection1?.status).toBe(projection2?.status);
      expect(projection1?.priority).toBe(projection2?.priority);
      expect(projection1?.resolution_type).toBe(projection2?.resolution_type);
      expect(projection1?.resolved_by_action).toBe(projection2?.resolved_by_action);
    });
  });

  describe('communication references in projections', () => {
    it('preserves trigger_communication_id from created event', async () => {
      let savedProjection: any = null;
      const supabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          upsert: vi.fn().mockImplementation((data) => {
            savedProjection = data;
            return Promise.resolve({ data: null, error: null });
          }),
          order: vi.fn().mockReturnThis(),
        })),
      } as any;

      const projector = new WorkItemProjector(supabase);

      const event: WorkItemCreatedEvent = {
        event_type: 'WorkItemCreated',
        event_data: {
          work_item_id: 'work-with-comm',
          focus_lens: 'customer_success',
          queue_id: 'at_risk',
          company_id: 'company-1',
          company_name: 'Test Co',
          source_type: 'communication',
          signal_type: 'message_needs_reply',
          trigger_communication_id: 'comm-trigger-123',
          trigger_message_id: 'msg-abc-456',
          title: 'Reply needed',
          subtitle: '',
          why_here: 'Customer waiting for response',
          priority: 'high',
          priority_score: 80,
        },
        sequence_number: 1,
        occurred_at: new Date().toISOString(),
      } as any;

      await projector.projectEvent(event);

      // Verify trigger communication references are preserved
      expect(savedProjection).toBeTruthy();
      expect(savedProjection.trigger_communication_id).toBe('comm-trigger-123');
      expect(savedProjection.trigger_message_id).toBe('msg-abc-456');
      expect(savedProjection.source_type).toBe('communication');
    });

    it('null communication references when not provided', async () => {
      let savedProjection: any = null;
      const supabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          upsert: vi.fn().mockImplementation((data) => {
            savedProjection = data;
            return Promise.resolve({ data: null, error: null });
          }),
          order: vi.fn().mockReturnThis(),
        })),
      } as any;

      const projector = new WorkItemProjector(supabase);

      const event: WorkItemCreatedEvent = {
        event_type: 'WorkItemCreated',
        event_data: {
          work_item_id: 'work-no-comm',
          focus_lens: 'sales',
          queue_id: 'stalled_deals',
          company_id: 'company-1',
          company_name: 'Test Co',
          source_type: 'lifecycle_stage', // Not from communication
          signal_type: 'deal_stalled',
          // No trigger_communication_id or trigger_message_id
          title: 'Deal stalled',
          subtitle: '',
          why_here: 'No activity in 7 days',
          priority: 'medium',
          priority_score: 60,
        },
        sequence_number: 1,
        occurred_at: new Date().toISOString(),
      } as any;

      await projector.projectEvent(event);

      // Verify null communication references
      expect(savedProjection).toBeTruthy();
      expect(savedProjection.trigger_communication_id).toBeNull();
      expect(savedProjection.trigger_message_id).toBeNull();
    });
  });
});

describe('Resolution by Reply', () => {
  it('records resolved_by_action when resolved via reply', async () => {
    const existingProjection: Partial<WorkItemDetailProjection> = {
      work_item_id: 'work-to-resolve',
      status: 'open',
      last_event_sequence: 1,
      assigned_to_user_id: 'user-1',
      focus_lens: 'customer_success',
      queue_id: 'at_risk',
      trigger_communication_id: 'comm-original',
    };

    let updatedProjection: any = null;
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: existingProjection, error: null }),
        update: vi.fn().mockImplementation((data) => ({
          eq: vi.fn().mockImplementation(() => {
            updatedProjection = { ...existingProjection, ...data };
            return Promise.resolve({ data: null, error: null });
          }),
        })),
        order: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    } as any;

    const projector = new WorkItemProjector(supabase);

    const resolveEvent: WorkItemResolvedEvent = {
      event_type: 'WorkItemResolved',
      event_data: {
        work_item_id: 'work-to-resolve',
        resolution_type: 'completed',
        resolution_notes: 'Replied to customer inquiry',
        resolved_by_action: 'replied', // Key field for tracking resolution method
      },
      sequence_number: 2,
      occurred_at: new Date().toISOString(),
    } as any;

    await projector.projectEvent(resolveEvent);

    expect(updatedProjection).toBeTruthy();
    expect(updatedProjection.status).toBe('resolved');
    expect(updatedProjection.resolution_type).toBe('completed');
    expect(updatedProjection.resolved_by_action).toBe('replied');
  });
});
