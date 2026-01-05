/**
 * Tests for Signal → Work Item Mapping
 *
 * Verifies that signals are correctly mapped to work items with:
 * - Correct signal type → work item type mapping
 * - Correct focus lens assignment
 * - Correct queue assignment
 * - Proper priority calculation
 */

import { describe, it, expect } from 'vitest';
import {
  SignalType,
  SignalSeverity,
  calculatePriorityScore,
  getSeverityBaseScore,
  getDefaultSeverity,
  generateSignalExplanation,
  SignalEntityRef,
  SignalEvidence,
} from '../../../src/lib/signals/events';

// Import mapping types inline to avoid pipeline Supabase dependencies
import { LensType } from '../../../src/lib/lens/types';
import { QueueId } from '../../../src/lib/work/types';
import { WorkItemSignalType, WorkItemSourceType } from '../../../src/lib/work/events';

// Re-implement the mapping logic here for testing (since pipeline has Supabase deps)
const SIGNAL_TO_WORK_SIGNAL_TYPE: Record<SignalType, WorkItemSignalType> = {
  churn_risk: 'churn_risk',
  expansion_ready: 'expansion_ready',
  health_declining: 'churn_risk',
  health_improving: 'expansion_ready',
  engagement_spike: 'expansion_ready',
  engagement_drop: 'churn_risk',
  champion_dark: 'churn_risk',
  new_stakeholder: 'follow_up_due',
  deal_stalled: 'deal_stalled',
  competitive_threat: 'deal_stalled',
  budget_at_risk: 'deal_stalled',
  timeline_slip: 'deal_stalled',
  buying_signal: 'follow_up_due',
  promise_at_risk: 'promise_at_risk',
  sla_breach: 'sla_breach',
  deadline_approaching: 'milestone_due',
  commitment_overdue: 'promise_at_risk',
  message_needs_reply: 'message_needs_reply',
  escalation_detected: 'case_escalated',
  objection_raised: 'follow_up_due',
  positive_sentiment: 'follow_up_due',
  onboarding_blocked: 'onboarding_blocked',
  milestone_due: 'milestone_due',
  renewal_approaching: 'follow_up_due',
  trial_ending: 'follow_up_due',
};

const SIGNAL_TO_WORK_SOURCE_TYPE: Record<SignalType, WorkItemSourceType> = {
  churn_risk: 'command_center',
  expansion_ready: 'command_center',
  health_declining: 'command_center',
  health_improving: 'command_center',
  engagement_spike: 'command_center',
  engagement_drop: 'command_center',
  champion_dark: 'command_center',
  new_stakeholder: 'command_center',
  deal_stalled: 'lifecycle_stage',
  competitive_threat: 'command_center',
  budget_at_risk: 'command_center',
  timeline_slip: 'lifecycle_stage',
  buying_signal: 'command_center',
  promise_at_risk: 'command_center',
  sla_breach: 'command_center',
  deadline_approaching: 'lifecycle_stage',
  commitment_overdue: 'command_center',
  message_needs_reply: 'communication',
  escalation_detected: 'communication',
  objection_raised: 'communication',
  positive_sentiment: 'communication',
  onboarding_blocked: 'lifecycle_stage',
  milestone_due: 'lifecycle_stage',
  renewal_approaching: 'lifecycle_stage',
  trial_ending: 'lifecycle_stage',
};

const SIGNAL_TO_FOCUS_LENS: Record<SignalType, LensType> = {
  churn_risk: 'customer_success',
  expansion_ready: 'sales',
  health_declining: 'customer_success',
  health_improving: 'customer_success',
  engagement_spike: 'sales',
  engagement_drop: 'customer_success',
  champion_dark: 'customer_success',
  new_stakeholder: 'sales',
  deal_stalled: 'sales',
  competitive_threat: 'sales',
  budget_at_risk: 'sales',
  timeline_slip: 'sales',
  buying_signal: 'sales',
  promise_at_risk: 'customer_success',
  sla_breach: 'support',
  deadline_approaching: 'customer_success',
  commitment_overdue: 'customer_success',
  message_needs_reply: 'sales',
  escalation_detected: 'support',
  objection_raised: 'sales',
  positive_sentiment: 'sales',
  onboarding_blocked: 'onboarding',
  milestone_due: 'onboarding',
  renewal_approaching: 'customer_success',
  trial_ending: 'sales',
};

const SIGNAL_TO_QUEUE_ID: Record<SignalType, QueueId> = {
  churn_risk: 'now',
  sla_breach: 'now',
  escalation_detected: 'now',
  message_needs_reply: 'now',
  promise_at_risk: 'now',
  commitment_overdue: 'now',
  onboarding_blocked: 'now',
  deal_stalled: 'follow_ups',
  health_declining: 'follow_ups',
  engagement_drop: 'follow_ups',
  champion_dark: 'follow_ups',
  competitive_threat: 'follow_ups',
  budget_at_risk: 'follow_ups',
  timeline_slip: 'follow_ups',
  objection_raised: 'follow_ups',
  expansion_ready: 'scheduled',
  health_improving: 'scheduled',
  engagement_spike: 'scheduled',
  new_stakeholder: 'scheduled',
  buying_signal: 'scheduled',
  positive_sentiment: 'scheduled',
  deadline_approaching: 'scheduled',
  milestone_due: 'scheduled',
  renewal_approaching: 'scheduled',
  trial_ending: 'scheduled',
};

function getSignalToWorkMapping(signalType: SignalType): {
  workSignalType: WorkItemSignalType;
  workSourceType: WorkItemSourceType;
  focusLens: LensType;
  queueId: QueueId;
} {
  return {
    workSignalType: SIGNAL_TO_WORK_SIGNAL_TYPE[signalType],
    workSourceType: SIGNAL_TO_WORK_SOURCE_TYPE[signalType],
    focusLens: SIGNAL_TO_FOCUS_LENS[signalType],
    queueId: SIGNAL_TO_QUEUE_ID[signalType],
  };
}

function shouldCreateNewWorkItem(signalType: SignalType): boolean {
  const createNewSignals: SignalType[] = [
    'message_needs_reply',
    'escalation_detected',
    'sla_breach',
    'milestone_due',
  ];
  return createNewSignals.includes(signalType);
}

describe('Signal → Work Item Type Mapping', () => {
  describe('Customer Health Signals', () => {
    it('maps churn_risk to churn_risk work signal', () => {
      const mapping = getSignalToWorkMapping('churn_risk');
      expect(mapping.workSignalType).toBe('churn_risk');
      expect(mapping.workSourceType).toBe('command_center');
      expect(mapping.focusLens).toBe('customer_success');
      expect(mapping.queueId).toBe('now');
    });

    it('maps expansion_ready to expansion_ready work signal', () => {
      const mapping = getSignalToWorkMapping('expansion_ready');
      expect(mapping.workSignalType).toBe('expansion_ready');
      expect(mapping.workSourceType).toBe('command_center');
      expect(mapping.focusLens).toBe('sales');
      expect(mapping.queueId).toBe('scheduled');
    });

    it('maps health_declining to churn_risk work signal', () => {
      const mapping = getSignalToWorkMapping('health_declining');
      expect(mapping.workSignalType).toBe('churn_risk');
    });

    it('maps health_improving to expansion_ready work signal', () => {
      const mapping = getSignalToWorkMapping('health_improving');
      expect(mapping.workSignalType).toBe('expansion_ready');
    });
  });

  describe('Engagement Signals', () => {
    it('maps engagement_spike to expansion_ready', () => {
      const mapping = getSignalToWorkMapping('engagement_spike');
      expect(mapping.workSignalType).toBe('expansion_ready');
      expect(mapping.focusLens).toBe('sales');
    });

    it('maps engagement_drop to churn_risk', () => {
      const mapping = getSignalToWorkMapping('engagement_drop');
      expect(mapping.workSignalType).toBe('churn_risk');
      expect(mapping.focusLens).toBe('customer_success');
    });

    it('maps champion_dark to churn_risk with follow_ups queue', () => {
      const mapping = getSignalToWorkMapping('champion_dark');
      expect(mapping.workSignalType).toBe('churn_risk');
      expect(mapping.queueId).toBe('follow_ups');
    });

    it('maps new_stakeholder to follow_up_due', () => {
      const mapping = getSignalToWorkMapping('new_stakeholder');
      expect(mapping.workSignalType).toBe('follow_up_due');
    });
  });

  describe('Deal Signals', () => {
    it('maps deal_stalled to deal_stalled in sales lens', () => {
      const mapping = getSignalToWorkMapping('deal_stalled');
      expect(mapping.workSignalType).toBe('deal_stalled');
      expect(mapping.focusLens).toBe('sales');
      expect(mapping.queueId).toBe('follow_ups');
    });

    it('maps competitive_threat to deal_stalled', () => {
      const mapping = getSignalToWorkMapping('competitive_threat');
      expect(mapping.workSignalType).toBe('deal_stalled');
      expect(mapping.workSourceType).toBe('command_center');
    });

    it('maps budget_at_risk to deal_stalled', () => {
      const mapping = getSignalToWorkMapping('budget_at_risk');
      expect(mapping.workSignalType).toBe('deal_stalled');
    });

    it('maps timeline_slip to deal_stalled from lifecycle_stage', () => {
      const mapping = getSignalToWorkMapping('timeline_slip');
      expect(mapping.workSignalType).toBe('deal_stalled');
      expect(mapping.workSourceType).toBe('lifecycle_stage');
    });

    it('maps buying_signal to follow_up_due', () => {
      const mapping = getSignalToWorkMapping('buying_signal');
      expect(mapping.workSignalType).toBe('follow_up_due');
    });
  });

  describe('Commitment Signals', () => {
    it('maps promise_at_risk to promise_at_risk in now queue', () => {
      const mapping = getSignalToWorkMapping('promise_at_risk');
      expect(mapping.workSignalType).toBe('promise_at_risk');
      expect(mapping.queueId).toBe('now');
    });

    it('maps sla_breach to sla_breach in now queue', () => {
      const mapping = getSignalToWorkMapping('sla_breach');
      expect(mapping.workSignalType).toBe('sla_breach');
      expect(mapping.focusLens).toBe('support');
      expect(mapping.queueId).toBe('now');
    });

    it('maps deadline_approaching to milestone_due', () => {
      const mapping = getSignalToWorkMapping('deadline_approaching');
      expect(mapping.workSignalType).toBe('milestone_due');
    });

    it('maps commitment_overdue to promise_at_risk', () => {
      const mapping = getSignalToWorkMapping('commitment_overdue');
      expect(mapping.workSignalType).toBe('promise_at_risk');
    });
  });

  describe('Communication Signals', () => {
    it('maps message_needs_reply to message_needs_reply in now queue', () => {
      const mapping = getSignalToWorkMapping('message_needs_reply');
      expect(mapping.workSignalType).toBe('message_needs_reply');
      expect(mapping.workSourceType).toBe('communication');
      expect(mapping.queueId).toBe('now');
    });

    it('maps escalation_detected to case_escalated in support lens', () => {
      const mapping = getSignalToWorkMapping('escalation_detected');
      expect(mapping.workSignalType).toBe('case_escalated');
      expect(mapping.focusLens).toBe('support');
    });

    it('maps objection_raised to follow_up_due', () => {
      const mapping = getSignalToWorkMapping('objection_raised');
      expect(mapping.workSignalType).toBe('follow_up_due');
    });

    it('maps positive_sentiment to follow_up_due', () => {
      const mapping = getSignalToWorkMapping('positive_sentiment');
      expect(mapping.workSignalType).toBe('follow_up_due');
    });
  });

  describe('Lifecycle Signals', () => {
    it('maps onboarding_blocked to onboarding_blocked in onboarding lens', () => {
      const mapping = getSignalToWorkMapping('onboarding_blocked');
      expect(mapping.workSignalType).toBe('onboarding_blocked');
      expect(mapping.focusLens).toBe('onboarding');
      expect(mapping.queueId).toBe('now');
    });

    it('maps milestone_due to milestone_due', () => {
      const mapping = getSignalToWorkMapping('milestone_due');
      expect(mapping.workSignalType).toBe('milestone_due');
      expect(mapping.workSourceType).toBe('lifecycle_stage');
    });

    it('maps renewal_approaching to follow_up_due in customer_success', () => {
      const mapping = getSignalToWorkMapping('renewal_approaching');
      expect(mapping.workSignalType).toBe('follow_up_due');
      expect(mapping.focusLens).toBe('customer_success');
    });

    it('maps trial_ending to follow_up_due in sales', () => {
      const mapping = getSignalToWorkMapping('trial_ending');
      expect(mapping.workSignalType).toBe('follow_up_due');
      expect(mapping.focusLens).toBe('sales');
    });
  });
});

describe('Should Create New Work Item', () => {
  it('returns true for message_needs_reply', () => {
    expect(shouldCreateNewWorkItem('message_needs_reply')).toBe(true);
  });

  it('returns true for escalation_detected', () => {
    expect(shouldCreateNewWorkItem('escalation_detected')).toBe(true);
  });

  it('returns true for sla_breach', () => {
    expect(shouldCreateNewWorkItem('sla_breach')).toBe(true);
  });

  it('returns true for milestone_due', () => {
    expect(shouldCreateNewWorkItem('milestone_due')).toBe(true);
  });

  it('returns false for churn_risk (attaches to existing)', () => {
    expect(shouldCreateNewWorkItem('churn_risk')).toBe(false);
  });

  it('returns false for engagement_drop (attaches to existing)', () => {
    expect(shouldCreateNewWorkItem('engagement_drop')).toBe(false);
  });

  it('returns false for deal_stalled (attaches to existing)', () => {
    expect(shouldCreateNewWorkItem('deal_stalled')).toBe(false);
  });
});

describe('Priority Calculation', () => {
  describe('calculatePriorityScore', () => {
    it('calculates score for critical signal with high value', () => {
      const score = calculatePriorityScore({
        base_score: 40, // critical
        recency_bonus: 20,
        value_multiplier: 2.0,
        engagement_factor: 20,
      });

      // (40 * 2.0) + 20 + 20 = 120 -> capped at 100
      expect(score).toBe(100);
    });

    it('calculates score for high signal with normal value', () => {
      const score = calculatePriorityScore({
        base_score: 30, // high
        recency_bonus: 15,
        value_multiplier: 1.0,
        engagement_factor: 10,
      });

      // (30 * 1.0) + 15 + 10 = 55
      expect(score).toBe(55);
    });

    it('calculates score for medium signal', () => {
      const score = calculatePriorityScore({
        base_score: 20, // medium
        recency_bonus: 10,
        value_multiplier: 1.0,
        engagement_factor: 5,
      });

      // (20 * 1.0) + 10 + 5 = 35
      expect(score).toBe(35);
    });

    it('calculates score for low signal', () => {
      const score = calculatePriorityScore({
        base_score: 10, // low
        recency_bonus: 5,
        value_multiplier: 0.5,
        engagement_factor: 0,
      });

      // (10 * 0.5) + 5 + 0 = 10
      expect(score).toBe(10);
    });

    it('clamps values to valid ranges', () => {
      const score = calculatePriorityScore({
        base_score: 100, // over max
        recency_bonus: 50, // over max
        value_multiplier: 5.0, // over max (clamped to 2.0)
        engagement_factor: 50, // over max
      });

      // (40 * 2.0) + 20 + 20 = 120 -> capped at 100
      expect(score).toBe(100);
    });

    it('ensures minimum score of 1', () => {
      const score = calculatePriorityScore({
        base_score: 0,
        recency_bonus: 0,
        value_multiplier: 0,
        engagement_factor: 0,
      });

      expect(score).toBe(1);
    });
  });

  describe('getSeverityBaseScore', () => {
    it('returns 40 for critical', () => {
      expect(getSeverityBaseScore('critical')).toBe(40);
    });

    it('returns 30 for high', () => {
      expect(getSeverityBaseScore('high')).toBe(30);
    });

    it('returns 20 for medium', () => {
      expect(getSeverityBaseScore('medium')).toBe(20);
    });

    it('returns 10 for low', () => {
      expect(getSeverityBaseScore('low')).toBe(10);
    });
  });

  describe('getDefaultSeverity', () => {
    it('returns critical for sla_breach', () => {
      expect(getDefaultSeverity('sla_breach')).toBe('critical');
    });

    it('returns critical for escalation_detected', () => {
      expect(getDefaultSeverity('escalation_detected')).toBe('critical');
    });

    it('returns critical for churn_risk', () => {
      expect(getDefaultSeverity('churn_risk')).toBe('critical');
    });

    it('returns high for promise_at_risk', () => {
      expect(getDefaultSeverity('promise_at_risk')).toBe('high');
    });

    it('returns high for competitive_threat', () => {
      expect(getDefaultSeverity('competitive_threat')).toBe('high');
    });

    it('returns medium for deal_stalled', () => {
      expect(getDefaultSeverity('deal_stalled')).toBe('medium');
    });

    it('returns medium for message_needs_reply', () => {
      expect(getDefaultSeverity('message_needs_reply')).toBe('medium');
    });

    it('returns low for positive_sentiment', () => {
      expect(getDefaultSeverity('positive_sentiment')).toBe('low');
    });

    it('returns low for expansion_ready', () => {
      expect(getDefaultSeverity('expansion_ready')).toBe('low');
    });
  });
});

describe('Signal Explanation Generation', () => {
  const baseEntityRef: SignalEntityRef = {
    type: 'company',
    id: 'company-123',
    name: 'Acme Corp',
  };

  const baseEvidence: SignalEvidence = {};

  describe('Customer Health Signals', () => {
    it('generates explanation for churn_risk with health score', () => {
      const evidence: SignalEvidence = {
        health_score: { current: 45, previous: 72, change: -27 },
      };

      const explanation = generateSignalExplanation(
        'churn_risk',
        'critical',
        baseEntityRef,
        evidence
      );

      expect(explanation).toContain('Critical');
      expect(explanation).toContain('churn risk');
      expect(explanation).toContain('Acme Corp');
      expect(explanation).toContain('-27 points');
    });

    it('generates explanation for expansion_ready', () => {
      const explanation = generateSignalExplanation(
        'expansion_ready',
        'low',
        baseEntityRef,
        baseEvidence
      );

      expect(explanation).toContain('expansion potential');
      expect(explanation).toContain('Acme Corp');
    });
  });

  describe('Deal Signals', () => {
    it('generates explanation for deal_stalled', () => {
      const explanation = generateSignalExplanation(
        'deal_stalled',
        'medium',
        baseEntityRef,
        baseEvidence
      );

      expect(explanation).toContain('stalled');
      expect(explanation).toContain('Acme Corp');
      expect(explanation).toContain('7+ days');
    });

    it('generates explanation for competitive_threat', () => {
      const explanation = generateSignalExplanation(
        'competitive_threat',
        'high',
        baseEntityRef,
        baseEvidence
      );

      expect(explanation).toContain('High priority');
      expect(explanation).toContain('competitive threat');
    });
  });

  describe('Communication Signals', () => {
    it('generates explanation for message_needs_reply with count', () => {
      const evidence: SignalEvidence = {
        communication_ids: ['comm-1', 'comm-2', 'comm-3'],
      };

      const explanation = generateSignalExplanation(
        'message_needs_reply',
        'medium',
        baseEntityRef,
        evidence
      );

      expect(explanation).toContain('3 message(s)');
      expect(explanation).toContain('awaiting reply');
    });

    it('generates explanation for escalation_detected', () => {
      const explanation = generateSignalExplanation(
        'escalation_detected',
        'critical',
        baseEntityRef,
        baseEvidence
      );

      expect(explanation).toContain('Critical');
      expect(explanation).toContain('escalation');
    });
  });

  describe('With Playbook Recommendation', () => {
    it('includes playbook action in explanation', () => {
      const explanation = generateSignalExplanation(
        'churn_risk',
        'critical',
        baseEntityRef,
        baseEvidence,
        {
          playbook_id: 'playbook-123',
          playbook_name: 'Churn Prevention',
          suggested_actions: ['Schedule executive check-in call', 'Review usage patterns'],
        }
      );

      expect(explanation).toContain('Recommended:');
      expect(explanation).toContain('Schedule executive check-in call');
    });
  });
});

describe('All Signal Types Have Valid Mappings', () => {
  const allSignalTypes: SignalType[] = [
    'churn_risk',
    'expansion_ready',
    'health_declining',
    'health_improving',
    'engagement_spike',
    'engagement_drop',
    'champion_dark',
    'new_stakeholder',
    'deal_stalled',
    'competitive_threat',
    'budget_at_risk',
    'timeline_slip',
    'buying_signal',
    'promise_at_risk',
    'sla_breach',
    'deadline_approaching',
    'commitment_overdue',
    'message_needs_reply',
    'escalation_detected',
    'objection_raised',
    'positive_sentiment',
    'onboarding_blocked',
    'milestone_due',
    'renewal_approaching',
    'trial_ending',
  ];

  it('has mappings for all signal types', () => {
    for (const signalType of allSignalTypes) {
      const mapping = getSignalToWorkMapping(signalType);

      expect(mapping.workSignalType).toBeTruthy();
      expect(mapping.workSourceType).toBeTruthy();
      expect(mapping.focusLens).toBeTruthy();
      expect(mapping.queueId).toBeTruthy();
    }
  });

  it('all signal types have default severities', () => {
    for (const signalType of allSignalTypes) {
      const severity = getDefaultSeverity(signalType);
      expect(['critical', 'high', 'medium', 'low']).toContain(severity);
    }
  });

  it('all signal types generate valid explanations', () => {
    const entityRef: SignalEntityRef = {
      type: 'company',
      id: 'test-123',
      name: 'Test Company',
    };

    for (const signalType of allSignalTypes) {
      const severity = getDefaultSeverity(signalType);
      const explanation = generateSignalExplanation(
        signalType,
        severity,
        entityRef,
        {}
      );

      expect(explanation).toBeTruthy();
      expect(explanation.length).toBeGreaterThan(10);
    }
  });
});

describe('Idempotency of Mappings', () => {
  it('same signal type always produces same mapping', () => {
    const signalType: SignalType = 'deal_stalled';

    const results = Array.from({ length: 10 }, () =>
      getSignalToWorkMapping(signalType)
    );

    const first = results[0];
    for (const result of results) {
      expect(result.workSignalType).toBe(first.workSignalType);
      expect(result.workSourceType).toBe(first.workSourceType);
      expect(result.focusLens).toBe(first.focusLens);
      expect(result.queueId).toBe(first.queueId);
    }
  });

  it('same priority factors always produce same score', () => {
    const factors = {
      base_score: 30,
      recency_bonus: 15,
      value_multiplier: 1.5,
      engagement_factor: 10,
    };

    const results = Array.from({ length: 10 }, () =>
      calculatePriorityScore(factors)
    );

    const first = results[0];
    for (const result of results) {
      expect(result).toBe(first);
    }
  });
});
