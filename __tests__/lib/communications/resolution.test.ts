/**
 * Tests for Communication Resolution Logic
 *
 * These tests verify the deterministic rules for when a reply
 * resolves a work item. The logic must be testable and consistent.
 */

import { describe, it, expect } from 'vitest';
import {
  shouldReplyResolveWorkItem,
  REPLY_RESOLUTION_RULES,
} from '../../../src/lib/communications/events';

describe('Communication Resolution Rules', () => {
  describe('shouldReplyResolveWorkItem', () => {
    // =========================================================================
    // message_needs_reply signal
    // =========================================================================
    describe('message_needs_reply signal', () => {
      it('resolves when reply is to the triggering message', () => {
        const result = shouldReplyResolveWorkItem(
          'message_needs_reply',
          'comm-123', // replyTargetCommunicationId
          'comm-123', // workItemTriggerCommunicationId - same!
          false       // isSchedulingReply
        );

        expect(result.resolves).toBe(true);
        expect(result.reason).toContain('reply to the message');
      });

      it('does NOT resolve when reply is to a different message', () => {
        const result = shouldReplyResolveWorkItem(
          'message_needs_reply',
          'comm-456', // replyTargetCommunicationId
          'comm-123', // workItemTriggerCommunicationId - different!
          false
        );

        expect(result.resolves).toBe(false);
        expect(result.reason).toContain('not to the triggering message');
      });

      it('does NOT resolve if trigger is null', () => {
        const result = shouldReplyResolveWorkItem(
          'message_needs_reply',
          'comm-456',
          null, // No trigger communication
          false
        );

        expect(result.resolves).toBe(false);
      });
    });

    // =========================================================================
    // follow_up_due signal
    // =========================================================================
    describe('follow_up_due signal', () => {
      it('resolves on any reply to the company', () => {
        const result = shouldReplyResolveWorkItem(
          'follow_up_due',
          'comm-999', // Any communication
          'comm-123', // Original trigger doesn't matter
          false
        );

        expect(result.resolves).toBe(true);
        expect(result.reason).toContain('any communication');
      });

      it('resolves even when trigger is null', () => {
        const result = shouldReplyResolveWorkItem(
          'follow_up_due',
          'comm-999',
          null,
          false
        );

        expect(result.resolves).toBe(true);
      });
    });

    // =========================================================================
    // meeting_scheduled signal
    // =========================================================================
    describe('meeting_scheduled signal', () => {
      it('resolves when reply schedules a meeting', () => {
        const result = shouldReplyResolveWorkItem(
          'meeting_scheduled',
          'comm-456',
          'comm-123',
          true // isSchedulingReply
        );

        expect(result.resolves).toBe(true);
        expect(result.reason).toContain('scheduled');
      });

      it('does NOT resolve for non-scheduling replies', () => {
        const result = shouldReplyResolveWorkItem(
          'meeting_scheduled',
          'comm-456',
          'comm-123',
          false // Not a scheduling reply
        );

        expect(result.resolves).toBe(false);
        expect(result.reason).toContain('did not schedule');
      });
    });

    // =========================================================================
    // promise_at_risk signal
    // =========================================================================
    describe('promise_at_risk signal', () => {
      it('resolves on any communication about the promise', () => {
        const result = shouldReplyResolveWorkItem(
          'promise_at_risk',
          'comm-any',
          'comm-original',
          false
        );

        expect(result.resolves).toBe(true);
        expect(result.reason).toContain('communicate');
      });
    });

    // =========================================================================
    // Unknown signal types
    // =========================================================================
    describe('unknown signal types', () => {
      it('does NOT resolve for unknown signals', () => {
        const result = shouldReplyResolveWorkItem(
          'unknown_signal_type',
          'comm-456',
          'comm-123',
          false
        );

        expect(result.resolves).toBe(false);
        expect(result.reason).toContain('No resolution rule');
      });
    });
  });

  describe('REPLY_RESOLUTION_RULES', () => {
    it('has rules for common signal types', () => {
      const ruleTypes = REPLY_RESOLUTION_RULES.map(r => r.work_item_signal_type);

      expect(ruleTypes).toContain('message_needs_reply');
      expect(ruleTypes).toContain('follow_up_due');
      expect(ruleTypes).toContain('meeting_scheduled');
      expect(ruleTypes).toContain('promise_at_risk');
    });

    it('all rules have required fields', () => {
      for (const rule of REPLY_RESOLUTION_RULES) {
        expect(rule.work_item_signal_type).toBeTruthy();
        expect(rule.resolves_when).toBeTruthy();
        expect(rule.description).toBeTruthy();
      }
    });

    it('resolves_when is a valid value', () => {
      const validValues = ['any_reply', 'reply_to_trigger', 'scheduled_meeting', 'manual'];

      for (const rule of REPLY_RESOLUTION_RULES) {
        expect(validValues).toContain(rule.resolves_when);
      }
    });
  });
});

describe('Idempotency', () => {
  it('same inputs always produce same outputs', () => {
    // Run the same resolution check multiple times
    const inputs = {
      signalType: 'message_needs_reply',
      replyTarget: 'comm-123',
      trigger: 'comm-123',
      isScheduling: false,
    };

    const results = Array.from({ length: 10 }, () =>
      shouldReplyResolveWorkItem(
        inputs.signalType,
        inputs.replyTarget,
        inputs.trigger,
        inputs.isScheduling
      )
    );

    // All results should be identical
    const firstResult = results[0];
    for (const result of results) {
      expect(result.resolves).toBe(firstResult.resolves);
      expect(result.reason).toBe(firstResult.reason);
    }
  });

  it('order of checks does not affect result', () => {
    // Check different signal types in different orders
    const signalTypes = [
      'message_needs_reply',
      'follow_up_due',
      'promise_at_risk',
      'meeting_scheduled',
    ];

    // Shuffle and run multiple times
    for (let i = 0; i < 5; i++) {
      const shuffled = [...signalTypes].sort(() => Math.random() - 0.5);

      const results = shuffled.map(signal =>
        shouldReplyResolveWorkItem(signal, 'comm-123', 'comm-123', false)
      );

      // Same signal type should always give same result
      const messageNeedsReplyResult = results[shuffled.indexOf('message_needs_reply')];
      expect(messageNeedsReplyResult.resolves).toBe(true);
    }
  });
});
