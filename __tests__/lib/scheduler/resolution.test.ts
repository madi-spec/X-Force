/**
 * Tests for Scheduler Resolution Logic
 *
 * These tests verify the deterministic rules for when scheduling events
 * resolve work items. The logic must be testable and consistent.
 */

import { describe, it, expect } from 'vitest';
import {
  shouldSchedulingResolveWorkItem,
  shouldReopenOnCancel,
  SCHEDULER_RESOLUTION_RULES,
  extractSchedulerContext,
} from '../../../src/lib/scheduler/events';

describe('Scheduler Resolution Rules', () => {
  describe('shouldSchedulingResolveWorkItem', () => {
    // =========================================================================
    // meeting_scheduled signal
    // =========================================================================
    describe('meeting_scheduled signal', () => {
      it('resolves when meeting is booked', () => {
        const result = shouldSchedulingResolveWorkItem(
          'meeting_scheduled',
          'MeetingBooked',
          true
        );

        expect(result.resolves).toBe(true);
        expect(result.reason).toContain('Meeting booked');
      });

      it('does NOT resolve when just scheduling requested', () => {
        const result = shouldSchedulingResolveWorkItem(
          'meeting_scheduled',
          'SchedulingRequested',
          false
        );

        expect(result.resolves).toBe(false);
        expect(result.reason).toContain('requires meeting_booked');
      });

      it('does NOT resolve when meeting is cancelled', () => {
        const result = shouldSchedulingResolveWorkItem(
          'meeting_scheduled',
          'MeetingCancelled',
          false
        );

        expect(result.resolves).toBe(false);
        expect(result.reason).toContain('cancellation');
      });
    });

    // =========================================================================
    // follow_up_due signal
    // =========================================================================
    describe('follow_up_due signal', () => {
      it('resolves when meeting is booked', () => {
        const result = shouldSchedulingResolveWorkItem(
          'follow_up_due',
          'MeetingBooked',
          true
        );

        expect(result.resolves).toBe(true);
        expect(result.reason).toContain('Meeting booked');
      });

      it('does NOT resolve when just scheduling requested', () => {
        const result = shouldSchedulingResolveWorkItem(
          'follow_up_due',
          'SchedulingRequested',
          false
        );

        expect(result.resolves).toBe(false);
      });
    });

    // =========================================================================
    // deal_stalled signal
    // =========================================================================
    describe('deal_stalled signal', () => {
      it('resolves when meeting is booked', () => {
        const result = shouldSchedulingResolveWorkItem(
          'deal_stalled',
          'MeetingBooked',
          true
        );

        expect(result.resolves).toBe(true);
        expect(result.reason).toContain('Meeting booked');
      });

      it('does NOT resolve when just scheduling requested', () => {
        const result = shouldSchedulingResolveWorkItem(
          'deal_stalled',
          'SchedulingRequested',
          false
        );

        expect(result.resolves).toBe(false);
      });
    });

    // =========================================================================
    // churn_risk signal
    // =========================================================================
    describe('churn_risk signal', () => {
      it('resolves when meeting is booked', () => {
        const result = shouldSchedulingResolveWorkItem(
          'churn_risk',
          'MeetingBooked',
          true
        );

        expect(result.resolves).toBe(true);
        expect(result.reason).toContain('Meeting booked');
      });

      it('does NOT resolve when just scheduling requested', () => {
        const result = shouldSchedulingResolveWorkItem(
          'churn_risk',
          'SchedulingRequested',
          false
        );

        expect(result.resolves).toBe(false);
      });
    });

    // =========================================================================
    // opportunity_detected signal
    // =========================================================================
    describe('opportunity_detected signal', () => {
      it('resolves when scheduling is just requested', () => {
        const result = shouldSchedulingResolveWorkItem(
          'opportunity_detected',
          'SchedulingRequested',
          false
        );

        expect(result.resolves).toBe(true);
        expect(result.reason).toContain('Scheduling initiated');
      });

      it('also resolves when meeting is booked', () => {
        const result = shouldSchedulingResolveWorkItem(
          'opportunity_detected',
          'MeetingBooked',
          true
        );

        expect(result.resolves).toBe(true);
      });
    });

    // =========================================================================
    // trial_ending signal
    // =========================================================================
    describe('trial_ending signal', () => {
      it('resolves when meeting is booked', () => {
        const result = shouldSchedulingResolveWorkItem(
          'trial_ending',
          'MeetingBooked',
          true
        );

        expect(result.resolves).toBe(true);
      });

      it('does NOT resolve when just scheduling requested', () => {
        const result = shouldSchedulingResolveWorkItem(
          'trial_ending',
          'SchedulingRequested',
          false
        );

        expect(result.resolves).toBe(false);
      });
    });

    // =========================================================================
    // MeetingCompleted event
    // =========================================================================
    describe('MeetingCompleted event', () => {
      it('resolves signals that resolve on meeting_booked', () => {
        const result = shouldSchedulingResolveWorkItem(
          'follow_up_due',
          'MeetingCompleted',
          false
        );

        expect(result.resolves).toBe(true);
        expect(result.reason).toContain('Meeting completed');
      });

      it('resolves signals that resolve on scheduling_requested', () => {
        const result = shouldSchedulingResolveWorkItem(
          'opportunity_detected',
          'MeetingCompleted',
          false
        );

        expect(result.resolves).toBe(true);
      });
    });

    // =========================================================================
    // Unknown signal types
    // =========================================================================
    describe('unknown signal types', () => {
      it('does NOT resolve for unknown signals', () => {
        const result = shouldSchedulingResolveWorkItem(
          'unknown_signal_type',
          'MeetingBooked',
          true
        );

        expect(result.resolves).toBe(false);
        expect(result.reason).toContain('No scheduler resolution rule');
      });
    });
  });

  describe('shouldReopenOnCancel', () => {
    it('returns true for signals that should reopen on cancel', () => {
      const reopenSignals = [
        'meeting_scheduled',
        'follow_up_due',
        'deal_stalled',
        'churn_risk',
        'trial_ending',
      ];

      for (const signal of reopenSignals) {
        const result = shouldReopenOnCancel(signal);
        expect(result.shouldReopen).toBe(true);
        expect(result.reason).toContain('Reopening');
      }
    });

    it('returns false for signals that should NOT reopen on cancel', () => {
      const result = shouldReopenOnCancel('opportunity_detected');

      expect(result.shouldReopen).toBe(false);
      expect(result.reason).toContain('does not require reopening');
    });

    it('returns false for unknown signals', () => {
      const result = shouldReopenOnCancel('unknown_signal');

      expect(result.shouldReopen).toBe(false);
      expect(result.reason).toContain('No scheduler resolution rule');
    });
  });

  describe('SCHEDULER_RESOLUTION_RULES', () => {
    it('has rules for common signal types', () => {
      const ruleTypes = SCHEDULER_RESOLUTION_RULES.map(r => r.work_item_signal_type);

      expect(ruleTypes).toContain('meeting_scheduled');
      expect(ruleTypes).toContain('follow_up_due');
      expect(ruleTypes).toContain('deal_stalled');
      expect(ruleTypes).toContain('churn_risk');
      expect(ruleTypes).toContain('opportunity_detected');
      expect(ruleTypes).toContain('trial_ending');
    });

    it('all rules have required fields', () => {
      for (const rule of SCHEDULER_RESOLUTION_RULES) {
        expect(rule.work_item_signal_type).toBeTruthy();
        expect(rule.resolves_when).toBeTruthy();
        expect(typeof rule.reopen_on_cancel).toBe('boolean');
        expect(rule.description).toBeTruthy();
      }
    });

    it('resolves_when is a valid value', () => {
      const validValues = ['meeting_booked', 'scheduling_requested', 'meeting_completed', 'manual'];

      for (const rule of SCHEDULER_RESOLUTION_RULES) {
        expect(validValues).toContain(rule.resolves_when);
      }
    });
  });
});

describe('extractSchedulerContext', () => {
  it('extracts basic context from work item', () => {
    const workItem = {
      id: 'work-123',
      company_id: 'company-456',
      company_name: 'Test Company',
      signal_type: 'follow_up_due',
      title: 'Follow up needed',
      subtitle: 'Customer waiting',
      why_here: 'No contact in 7 days',
    };

    const context = extractSchedulerContext(workItem);

    expect(context.companyId).toBe('company-456');
    expect(context.companyName).toBe('Test Company');
    expect(context.suggestedMeetingType).toBe('follow_up');
    expect(context.suggestedDuration).toBe(30);
    expect(context.context).toContain('No contact in 7 days');
  });

  it('suggests demo for demo_requested signal', () => {
    const workItem = {
      id: 'work-123',
      company_id: 'company-456',
      company_name: 'Test Company',
      signal_type: 'demo_requested',
      title: 'Demo requested',
    };

    const context = extractSchedulerContext(workItem);

    expect(context.suggestedMeetingType).toBe('demo');
    expect(context.suggestedDuration).toBe(60);
  });

  it('extracts contact info from linked communication', () => {
    const workItem = {
      id: 'work-123',
      company_id: 'company-456',
      company_name: 'Test Company',
      signal_type: 'message_needs_reply',
      title: 'Reply needed',
    };

    const linkedCommunication = {
      id: 'comm-789',
      contact_name: 'John Doe',
      contact_email: 'john@test.com',
      contact_id: 'contact-111',
      subject: 'Re: Product inquiry',
      body_preview: 'I have a few questions about...',
    };

    const context = extractSchedulerContext(workItem, linkedCommunication);

    expect(context.contactId).toBe('contact-111');
    expect(context.contactName).toBe('John Doe');
    expect(context.contactEmail).toBe('john@test.com');
    expect(context.triggerCommunicationId).toBe('comm-789');
    expect(context.context).toContain('Product inquiry');
  });

  it('falls back to metadata for contact info when no communication', () => {
    const workItem = {
      id: 'work-123',
      company_id: 'company-456',
      company_name: 'Test Company',
      signal_type: 'deal_stalled',
      title: 'Deal stalled',
      metadata: {
        contact_id: 'contact-222',
        contact_name: 'Jane Smith',
        contact_email: 'jane@test.com',
        deal_id: 'deal-333',
      },
    };

    const context = extractSchedulerContext(workItem);

    expect(context.contactId).toBe('contact-222');
    expect(context.contactName).toBe('Jane Smith');
    expect(context.contactEmail).toBe('jane@test.com');
    expect(context.dealId).toBe('deal-333');
  });

  it('defaults to follow_up for unknown signal types', () => {
    const workItem = {
      id: 'work-123',
      company_id: 'company-456',
      company_name: 'Test Company',
      signal_type: 'unknown_signal',
      title: 'Unknown item',
    };

    const context = extractSchedulerContext(workItem);

    expect(context.suggestedMeetingType).toBe('follow_up');
    expect(context.suggestedDuration).toBe(30);
  });
});

describe('Idempotency', () => {
  it('same inputs always produce same outputs', () => {
    // Run the same resolution check multiple times
    const inputs = {
      signalType: 'follow_up_due',
      eventType: 'MeetingBooked' as const,
      meetingBooked: true,
    };

    const results = Array.from({ length: 10 }, () =>
      shouldSchedulingResolveWorkItem(
        inputs.signalType,
        inputs.eventType,
        inputs.meetingBooked
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
      'meeting_scheduled',
      'follow_up_due',
      'deal_stalled',
      'churn_risk',
      'opportunity_detected',
    ];

    // Shuffle and run multiple times
    for (let i = 0; i < 5; i++) {
      const shuffled = [...signalTypes].sort(() => Math.random() - 0.5);

      const results = shuffled.map(signal =>
        shouldSchedulingResolveWorkItem(signal, 'MeetingBooked', true)
      );

      // meeting_scheduled should always resolve on MeetingBooked
      const meetingScheduledResult = results[shuffled.indexOf('meeting_scheduled')];
      expect(meetingScheduledResult.resolves).toBe(true);
    }
  });
});
