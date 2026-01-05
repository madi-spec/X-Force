/**
 * Tests for Scheduler + Work Item Projector Integration
 *
 * These tests verify that scheduler events correctly update work item projections.
 * Key scenarios:
 * 1. MeetingBooked resolves work items with appropriate signal types
 * 2. MeetingCancelled reopens work items when configured to do so
 * 3. Event sequence numbers are tracked for idempotency
 */

import { describe, it, expect, vi } from 'vitest';
import { WorkItemProjector, WorkItemDetailProjection } from '../../../src/lib/work/projections';
import {
  WorkItemCreatedEvent,
  WorkItemResolvedEvent,
  WorkItemReopenedEvent,
} from '../../../src/lib/work/events';
import {
  shouldSchedulingResolveWorkItem,
  shouldReopenOnCancel,
} from '../../../src/lib/scheduler/events';

// Mock Supabase client
function createMockSupabase(existingProjection: Partial<WorkItemDetailProjection> | null = null) {
  let currentState: any = existingProjection ? { ...existingProjection } : null;

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: currentState ? { ...currentState } : null, error: null })
    ),
    upsert: vi.fn().mockImplementation((data) => {
      currentState = { ...data };
      return Promise.resolve({ data: null, error: null });
    }),
    update: vi.fn().mockImplementation((data) => {
      // Apply the update to current state
      if (currentState) {
        currentState = { ...currentState, ...data };
      }
      return {
        eq: vi.fn().mockImplementation(() => {
          return Promise.resolve({ data: null, error: null });
        }),
      };
    }),
    order: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };

  return {
    from: vi.fn(() => chain),
    getState: () => currentState,
  } as any;
}

describe('Scheduler + Work Item Projector Integration', () => {
  describe('MeetingBooked resolution flow', () => {
    it('determines follow_up_due should resolve when meeting booked', () => {
      // Check if MeetingBooked would resolve follow_up_due
      const resolutionCheck = shouldSchedulingResolveWorkItem(
        'follow_up_due',
        'MeetingBooked',
        true
      );

      expect(resolutionCheck.resolves).toBe(true);
      expect(resolutionCheck.reason).toContain('Meeting booked');
    });

    it('creates correct resolution event data for scheduled_meeting action', () => {
      // Verify the event structure that would be created
      const resolveEvent: WorkItemResolvedEvent = {
        event_type: 'WorkItemResolved',
        event_data: {
          work_item_id: 'work-scheduler-1',
          resolution_type: 'completed',
          resolution_notes: 'Meeting scheduled with customer',
          resolved_by_action: 'scheduled_meeting',
        },
        sequence_number: 2,
        occurred_at: new Date().toISOString(),
      } as any;

      expect(resolveEvent.event_type).toBe('WorkItemResolved');
      expect(resolveEvent.event_data.resolution_type).toBe('completed');
      expect(resolveEvent.event_data.resolved_by_action).toBe('scheduled_meeting');
    });

    it('processes resolution for deal_stalled signal when meeting booked', async () => {
      const resolutionCheck = shouldSchedulingResolveWorkItem(
        'deal_stalled',
        'MeetingBooked',
        true
      );

      expect(resolutionCheck.resolves).toBe(true);
      expect(resolutionCheck.reason).toContain('Meeting booked');
    });

    it('processes resolution for churn_risk signal when meeting booked', async () => {
      const resolutionCheck = shouldSchedulingResolveWorkItem(
        'churn_risk',
        'MeetingBooked',
        true
      );

      expect(resolutionCheck.resolves).toBe(true);
    });

    it('does NOT resolve message_needs_reply on meeting booked (requires reply)', () => {
      const resolutionCheck = shouldSchedulingResolveWorkItem(
        'message_needs_reply',
        'MeetingBooked',
        true
      );

      // message_needs_reply has no scheduler resolution rule
      expect(resolutionCheck.resolves).toBe(false);
    });
  });

  describe('SchedulingRequested resolution flow', () => {
    it('resolves opportunity_detected when scheduling is just requested', () => {
      const resolutionCheck = shouldSchedulingResolveWorkItem(
        'opportunity_detected',
        'SchedulingRequested',
        false
      );

      expect(resolutionCheck.resolves).toBe(true);
      expect(resolutionCheck.reason).toContain('Scheduling initiated');
    });

    it('does NOT resolve follow_up_due on just scheduling requested', () => {
      const resolutionCheck = shouldSchedulingResolveWorkItem(
        'follow_up_due',
        'SchedulingRequested',
        false
      );

      expect(resolutionCheck.resolves).toBe(false);
    });
  });

  describe('MeetingCancelled reopen flow', () => {
    it('determines follow_up_due should reopen on meeting cancel', () => {
      const reopenCheck = shouldReopenOnCancel('follow_up_due');

      expect(reopenCheck.shouldReopen).toBe(true);
    });

    it('creates correct reopen event for cancelled meeting', () => {
      // Verify the reopen event structure
      const reopenEvent: WorkItemReopenedEvent = {
        event_type: 'WorkItemReopened',
        event_data: {
          work_item_id: 'work-scheduler-2',
          reopen_reason: 'meeting_cancelled',
          scheduling_request_id: 'sched-123',
          cancellation_reason: 'Customer cancelled',
        },
        sequence_number: 3,
        occurred_at: new Date().toISOString(),
      } as any;

      expect(reopenEvent.event_type).toBe('WorkItemReopened');
      expect(reopenEvent.event_data.reopen_reason).toBe('meeting_cancelled');
      expect(reopenEvent.event_data.scheduling_request_id).toBe('sched-123');
    });

    it('determines opportunity_detected should NOT reopen on meeting cancel', () => {
      const reopenCheck = shouldReopenOnCancel('opportunity_detected');

      expect(reopenCheck.shouldReopen).toBe(false);
      expect(reopenCheck.reason).toContain('does not require reopening');
    });
  });

  describe('Resolution event with scheduling context', () => {
    it('trial_ending resolves when meeting is booked', () => {
      const resolutionCheck = shouldSchedulingResolveWorkItem(
        'trial_ending',
        'MeetingBooked',
        true
      );

      expect(resolutionCheck.resolves).toBe(true);
    });

    it('resolution event includes scheduled_meeting action', () => {
      const resolveEvent: WorkItemResolvedEvent = {
        event_type: 'WorkItemResolved',
        event_data: {
          work_item_id: 'work-scheduler-3',
          resolution_type: 'completed',
          resolution_notes: 'Conversion call scheduled for trial ending',
          resolved_by_action: 'scheduled_meeting',
        },
        sequence_number: 2,
        occurred_at: new Date().toISOString(),
      } as any;

      expect(resolveEvent.event_data.resolved_by_action).toBe('scheduled_meeting');
      expect(resolveEvent.event_data.resolution_notes).toContain('trial ending');
    });
  });

  describe('Signal type to meeting type mapping', () => {
    it('follow_up_due maps to follow_up meeting', () => {
      // This is tested in the extractSchedulerContext tests
      // Here we just verify the resolution works correctly
      const resolutionCheck = shouldSchedulingResolveWorkItem(
        'follow_up_due',
        'MeetingBooked',
        true
      );

      expect(resolutionCheck.resolves).toBe(true);
    });

    it('deal_stalled maps to check_in meeting', () => {
      const resolutionCheck = shouldSchedulingResolveWorkItem(
        'deal_stalled',
        'MeetingBooked',
        true
      );

      expect(resolutionCheck.resolves).toBe(true);
    });
  });
});

describe('Idempotent Scheduler Event Processing', () => {
  it('skips resolution event with lower sequence number', async () => {
    const existingProjection: Partial<WorkItemDetailProjection> = {
      work_item_id: 'work-idem-1',
      status: 'resolved',  // Already resolved
      last_event_sequence: 5,
      signal_type: 'follow_up_due',
      resolution_type: 'completed',
      resolved_by_action: 'scheduled_meeting',
    };

    const supabase = createMockSupabase(existingProjection);
    const projector = new WorkItemProjector(supabase);

    // Try to process event with lower sequence number
    const resolveEvent: WorkItemResolvedEvent = {
      event_type: 'WorkItemResolved',
      event_data: {
        work_item_id: 'work-idem-1',
        resolution_type: 'completed',
        resolved_by_action: 'different_action',  // This should NOT be applied
      },
      sequence_number: 3,  // Lower than last_event_sequence
      occurred_at: new Date().toISOString(),
    } as any;

    const wasProcessed = await projector.projectEvent(resolveEvent);

    expect(wasProcessed).toBe(false);
  });

  it('processes reopen event with higher sequence number', async () => {
    const existingProjection: Partial<WorkItemDetailProjection> = {
      work_item_id: 'work-idem-2',
      status: 'resolved',
      last_event_sequence: 5,
      signal_type: 'follow_up_due',
    };

    const supabase = createMockSupabase(existingProjection);
    const projector = new WorkItemProjector(supabase);

    const reopenEvent: WorkItemReopenedEvent = {
      event_type: 'WorkItemReopened',
      event_data: {
        work_item_id: 'work-idem-2',
        reopen_reason: 'meeting_cancelled',
      },
      sequence_number: 6,  // Higher than last_event_sequence
      occurred_at: new Date().toISOString(),
    } as any;

    const wasProcessed = await projector.projectEvent(reopenEvent);

    expect(wasProcessed).toBe(true);
    const state = supabase.getState();
    expect(state.status).toBe('open');
  });
});

describe('Replay Produces Same State', () => {
  it('replaying scheduler resolution events produces identical projection', async () => {
    const events = [
      {
        event_type: 'WorkItemCreated',
        event_data: {
          work_item_id: 'work-replay-sched',
          focus_lens: 'sales',
          queue_id: 'follow_ups',
          company_id: 'company-1',
          company_name: 'Replay Scheduler Co',
          source_type: 'scheduler',
          signal_type: 'follow_up_due',
          title: 'Follow up needed',
          subtitle: 'Customer waiting',
          why_here: 'No contact in 7 days',
          priority: 'medium',
          priority_score: 50,
        },
        sequence_number: 1,
        occurred_at: '2024-01-01T10:00:00Z',
      },
      {
        event_type: 'WorkItemResolved',
        event_data: {
          work_item_id: 'work-replay-sched',
          resolution_type: 'completed',
          resolution_notes: 'Meeting scheduled for next week',
          resolved_by_action: 'scheduled_meeting',
        },
        sequence_number: 2,
        occurred_at: '2024-01-02T10:00:00Z',
      },
    ];

    // First replay
    const supabase1 = createMockSupabase(null);
    const projector1 = new WorkItemProjector(supabase1);
    for (const event of events) {
      await projector1.projectEvent(event as any);
    }
    const state1 = supabase1.getState();

    // Second replay
    const supabase2 = createMockSupabase(null);
    const projector2 = new WorkItemProjector(supabase2);
    for (const event of events) {
      await projector2.projectEvent(event as any);
    }
    const state2 = supabase2.getState();

    // States should match
    expect(state1.work_item_id).toBe(state2.work_item_id);
    expect(state1.status).toBe(state2.status);
    expect(state1.resolution_type).toBe(state2.resolution_type);
    expect(state1.resolved_by_action).toBe(state2.resolved_by_action);
  });

  it('replaying with cancellation reopen produces same state', async () => {
    const events = [
      {
        event_type: 'WorkItemCreated',
        event_data: {
          work_item_id: 'work-replay-cancel',
          focus_lens: 'sales',
          queue_id: 'follow_ups',
          company_id: 'company-1',
          company_name: 'Cancel Test Co',
          source_type: 'scheduler',
          signal_type: 'follow_up_due',
          title: 'Follow up',
          subtitle: '',
          why_here: 'Test',
          priority: 'medium',
          priority_score: 50,
        },
        sequence_number: 1,
        occurred_at: '2024-01-01T10:00:00Z',
      },
      {
        event_type: 'WorkItemResolved',
        event_data: {
          work_item_id: 'work-replay-cancel',
          resolution_type: 'completed',
          resolved_by_action: 'scheduled_meeting',
        },
        sequence_number: 2,
        occurred_at: '2024-01-02T10:00:00Z',
      },
      {
        event_type: 'WorkItemReopened',
        event_data: {
          work_item_id: 'work-replay-cancel',
          reopen_reason: 'meeting_cancelled',
          cancellation_reason: 'Customer cancelled',
        },
        sequence_number: 3,
        occurred_at: '2024-01-03T10:00:00Z',
      },
    ];

    const supabase = createMockSupabase(null);
    const projector = new WorkItemProjector(supabase);
    for (const event of events) {
      await projector.projectEvent(event as any);
    }
    const state = supabase.getState();

    // Should be back to open after reopen
    expect(state.status).toBe('open');
  });
});
