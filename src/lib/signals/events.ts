/**
 * Signal Events for Command Center → Work Pipeline
 *
 * Event-sourced signals with evidence references for audit trail.
 * All signals must be rule/playbook/analysis driven - NO keyword matching.
 *
 * Key insight: Signals are the intelligence layer that explains "why" something
 * needs attention. They carry evidence and recommendations, and can create or
 * attach to Work items.
 */

import { LifecycleEvent } from '@/types/eventSourcing';

// ============================================================================
// SIGNAL TYPES
// ============================================================================

/**
 * Signal types that can trigger Work items.
 * Each maps to a specific playbook and explanation template.
 */
export type SignalType =
  // Customer Health Signals
  | 'churn_risk'
  | 'expansion_ready'
  | 'health_declining'
  | 'health_improving'
  // Engagement Signals
  | 'engagement_spike'
  | 'engagement_drop'
  | 'champion_dark'
  | 'new_stakeholder'
  // Deal Signals
  | 'deal_stalled'
  | 'competitive_threat'
  | 'budget_at_risk'
  | 'timeline_slip'
  | 'buying_signal'
  // Commitment Signals
  | 'promise_at_risk'
  | 'sla_breach'
  | 'deadline_approaching'
  | 'commitment_overdue'
  // Communication Signals
  | 'message_needs_reply'
  | 'escalation_detected'
  | 'objection_raised'
  | 'positive_sentiment'
  // Lifecycle Signals
  | 'onboarding_blocked'
  | 'milestone_due'
  | 'renewal_approaching'
  | 'trial_ending';

export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low';

export type SignalStatus = 'active' | 'acknowledged' | 'resolved' | 'expired';

/**
 * Entity reference for signal source.
 * Identifies what entity the signal is about.
 */
export interface SignalEntityRef {
  type: 'company' | 'deal' | 'contact' | 'case' | 'communication';
  id: string;
  name: string;
}

/**
 * Evidence references that support the signal.
 * Provides audit trail and context for "why" the signal was generated.
 */
export interface SignalEvidence {
  // Communication-based evidence
  communication_ids?: string[];
  email_subjects?: string[];
  // Meeting-based evidence
  meeting_ids?: string[];
  transcript_ids?: string[];
  // Lifecycle evidence
  milestone_ids?: string[];
  case_ids?: string[];
  // Metric evidence
  usage_metrics?: {
    metric_name: string;
    current_value: number;
    threshold_value: number;
    trend: 'up' | 'down' | 'flat';
  }[];
  // Health score evidence
  health_score?: {
    current: number;
    previous: number;
    change: number;
  };
  // Timeline evidence
  timeline?: {
    event_type: string;
    occurred_at: string;
    description: string;
  }[];
  // Custom evidence
  custom?: Record<string, unknown>;
}

/**
 * Playbook recommendation for handling the signal.
 */
export interface PlaybookRecommendation {
  playbook_id: string;
  playbook_name: string;
  suggested_actions: string[];
  talk_tracks?: string[];
  time_to_act_minutes?: number;
}

// ============================================================================
// SIGNAL EVENTS
// ============================================================================

/**
 * SignalDetected - A new signal has been identified by the intelligence layer
 */
export interface SignalDetectedEvent extends LifecycleEvent<'SignalDetected'> {
  event_data: {
    signal_id: string;
    signal_type: SignalType;
    severity: SignalSeverity;

    // What entity is this signal about
    entity_ref: SignalEntityRef;

    // Evidence that triggered this signal (audit trail)
    evidence: SignalEvidence;

    // Human-readable explanation (no black box)
    explanation: string;

    // Recommended playbook for handling
    playbook?: PlaybookRecommendation;

    // Priority calculation inputs (transparent scoring)
    priority_factors: {
      base_score: number;       // From signal type severity
      recency_bonus: number;    // How recent the evidence is
      value_multiplier: number; // Deal/account value impact
      engagement_factor: number; // Recent engagement level
    };

    // Calculated priority score (1-100)
    priority_score: number;

    // When the signal should expire if not acted on
    expires_at?: string;

    // Source that detected this signal
    detection_source: 'playbook' | 'rule_engine' | 'ai_analysis' | 'threshold_breach';
    detection_rule_id?: string;
  };
}

/**
 * SignalAcknowledged - User has seen/acknowledged the signal
 */
export interface SignalAcknowledgedEvent extends LifecycleEvent<'SignalAcknowledged'> {
  event_data: {
    signal_id: string;
    acknowledged_by_user_id: string;
    notes?: string;
  };
}

/**
 * SignalResolved - Signal has been addressed
 */
export interface SignalResolvedEvent extends LifecycleEvent<'SignalResolved'> {
  event_data: {
    signal_id: string;
    resolution_type: 'addressed' | 'false_positive' | 'expired' | 'superseded';
    resolution_notes?: string;
    resolved_by_user_id?: string;
    resolved_by_work_item_id?: string;
    // If superseded, what signal replaced this one
    superseded_by_signal_id?: string;
  };
}

/**
 * SignalEscalated - Signal severity was increased
 */
export interface SignalEscalatedEvent extends LifecycleEvent<'SignalEscalated'> {
  event_data: {
    signal_id: string;
    previous_severity: SignalSeverity;
    new_severity: SignalSeverity;
    escalation_reason: string;
    new_evidence?: SignalEvidence;
  };
}

/**
 * SignalWorkItemCreated - Signal caused creation of a new Work item
 */
export interface SignalWorkItemCreatedEvent extends LifecycleEvent<'SignalWorkItemCreated'> {
  event_data: {
    signal_id: string;
    work_item_id: string;
    why_here: string; // Human-readable explanation for the work item
  };
}

/**
 * SignalWorkItemAttached - Signal was attached to existing Work item
 */
export interface SignalWorkItemAttachedEvent extends LifecycleEvent<'SignalWorkItemAttached'> {
  event_data: {
    signal_id: string;
    work_item_id: string;
    priority_delta: number; // How much this signal changes priority
    updated_why_here?: string; // Updated explanation if needed
  };
}

// Union of all signal events
export type SignalEvent =
  | SignalDetectedEvent
  | SignalAcknowledgedEvent
  | SignalResolvedEvent
  | SignalEscalatedEvent
  | SignalWorkItemCreatedEvent
  | SignalWorkItemAttachedEvent;

// ============================================================================
// THRESHOLD CONFIG EVENTS
// ============================================================================

/**
 * ThresholdConfigUpdated - Admin adjusted detection thresholds
 * Stored as events for audit trail
 */
export interface ThresholdConfigUpdatedEvent extends LifecycleEvent<'ThresholdConfigUpdated'> {
  event_data: {
    config_id: string;
    signal_type: SignalType;
    previous_threshold: ThresholdConfig;
    new_threshold: ThresholdConfig;
    updated_by_user_id: string;
    reason?: string;
  };
}

export interface ThresholdConfig {
  // Trigger thresholds
  trigger_threshold: number;
  // Time windows
  lookback_hours: number;
  cooldown_hours: number; // Don't re-trigger within this window
  // Severity mapping
  severity_thresholds: {
    critical: number;
    high: number;
    medium: number;
    // Anything below medium threshold is 'low'
  };
  // Priority calculation weights
  priority_weights: {
    base_weight: number;
    recency_weight: number;
    value_weight: number;
    engagement_weight: number;
  };
  // Whether this signal type is enabled
  enabled: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate priority score from factors.
 * Formula is transparent and explainable.
 */
export function calculatePriorityScore(factors: {
  base_score: number;
  recency_bonus: number;
  value_multiplier: number;
  engagement_factor: number;
}): number {
  // Base score (0-40) from signal severity
  const base = Math.min(40, Math.max(0, factors.base_score));

  // Recency bonus (0-20) - more recent = higher priority
  const recency = Math.min(20, Math.max(0, factors.recency_bonus));

  // Value multiplier (0.5-2.0) applied to base
  const valueAdjustedBase = base * Math.min(2.0, Math.max(0.5, factors.value_multiplier));

  // Engagement factor (0-20) - higher engagement = higher priority
  const engagement = Math.min(20, Math.max(0, factors.engagement_factor));

  // Total score capped at 100
  const total = Math.round(valueAdjustedBase + recency + engagement);
  return Math.min(100, Math.max(1, total));
}

/**
 * Generate explanation from signal and evidence.
 * Returns human-readable "why this is here" text.
 */
export function generateSignalExplanation(
  signalType: SignalType,
  severity: SignalSeverity,
  entityRef: SignalEntityRef,
  evidence: SignalEvidence,
  playbook?: PlaybookRecommendation
): string {
  const severityLabel = {
    critical: 'Critical',
    high: 'High priority',
    medium: 'Moderate',
    low: 'Low priority',
  }[severity];

  const explanations: Record<SignalType, (e: SignalEvidence, entity: SignalEntityRef) => string> = {
    churn_risk: (e, entity) => {
      const healthDrop = e.health_score
        ? ` Health score dropped ${e.health_score.change} points.`
        : '';
      return `${severityLabel} churn risk detected for ${entity.name}.${healthDrop}`;
    },
    expansion_ready: (e, entity) => {
      return `${entity.name} shows strong expansion potential based on engagement patterns.`;
    },
    health_declining: (e, entity) => {
      const healthInfo = e.health_score
        ? ` Score: ${e.health_score.current} (was ${e.health_score.previous}).`
        : '';
      return `${entity.name}'s health is declining.${healthInfo}`;
    },
    health_improving: (e, entity) => {
      return `${entity.name}'s health is improving - consider expansion conversation.`;
    },
    engagement_spike: (e, entity) => {
      return `Unusual engagement activity from ${entity.name} - potential buying signal.`;
    },
    engagement_drop: (e, entity) => {
      return `${entity.name} engagement has dropped significantly - needs re-engagement.`;
    },
    champion_dark: (e, entity) => {
      return `Your champion at ${entity.name} has gone quiet - relationship at risk.`;
    },
    new_stakeholder: (e, entity) => {
      return `New stakeholder identified at ${entity.name} - consider introduction.`;
    },
    deal_stalled: (e, entity) => {
      return `Deal with ${entity.name} has stalled - no activity in 7+ days.`;
    },
    competitive_threat: (e, entity) => {
      return `${severityLabel} competitive threat detected for ${entity.name} deal.`;
    },
    budget_at_risk: (e, entity) => {
      return `Budget concerns raised by ${entity.name} - needs attention.`;
    },
    timeline_slip: (e, entity) => {
      return `Timeline for ${entity.name} deal is slipping - reassess expectations.`;
    },
    buying_signal: (e, entity) => {
      return `Strong buying signal from ${entity.name} - time to advance.`;
    },
    promise_at_risk: (e, entity) => {
      const commitmentCount = e.timeline?.length || 0;
      return `${commitmentCount} commitment(s) to ${entity.name} at risk of being missed.`;
    },
    sla_breach: (e, entity) => {
      return `${severityLabel} SLA breach for ${entity.name} - immediate action required.`;
    },
    deadline_approaching: (e, entity) => {
      return `Important deadline approaching for ${entity.name}.`;
    },
    commitment_overdue: (e, entity) => {
      return `Commitment to ${entity.name} is overdue - follow up immediately.`;
    },
    message_needs_reply: (e, entity) => {
      const emailCount = e.communication_ids?.length || 1;
      return `${emailCount} message(s) from ${entity.name} awaiting reply.`;
    },
    escalation_detected: (e, entity) => {
      return `${severityLabel} escalation detected from ${entity.name}.`;
    },
    objection_raised: (e, entity) => {
      return `Objection raised by ${entity.name} - needs addressing.`;
    },
    positive_sentiment: (e, entity) => {
      return `Positive sentiment from ${entity.name} - good opportunity to advance.`;
    },
    onboarding_blocked: (e, entity) => {
      return `${entity.name} onboarding is blocked - intervention needed.`;
    },
    milestone_due: (e, entity) => {
      return `Upcoming milestone for ${entity.name} needs attention.`;
    },
    renewal_approaching: (e, entity) => {
      return `Renewal for ${entity.name} is approaching - start conversation.`;
    },
    trial_ending: (e, entity) => {
      return `Trial for ${entity.name} is ending soon - conversion opportunity.`;
    },
  };

  const baseExplanation = explanations[signalType](evidence, entityRef);

  // Add playbook recommendation if available
  if (playbook?.suggested_actions?.length) {
    return `${baseExplanation} Recommended: ${playbook.suggested_actions[0]}`;
  }

  return baseExplanation;
}

/**
 * Map signal type to default severity.
 */
export function getDefaultSeverity(signalType: SignalType): SignalSeverity {
  const criticalSignals: SignalType[] = ['sla_breach', 'escalation_detected', 'churn_risk'];
  const highSignals: SignalType[] = [
    'promise_at_risk', 'competitive_threat', 'commitment_overdue',
    'champion_dark', 'onboarding_blocked', 'budget_at_risk'
  ];
  const mediumSignals: SignalType[] = [
    'deal_stalled', 'engagement_drop', 'timeline_slip', 'message_needs_reply',
    'deadline_approaching', 'trial_ending', 'renewal_approaching', 'objection_raised'
  ];

  if (criticalSignals.includes(signalType)) return 'critical';
  if (highSignals.includes(signalType)) return 'high';
  if (mediumSignals.includes(signalType)) return 'medium';
  return 'low';
}

/**
 * Get base priority score for a severity level.
 */
export function getSeverityBaseScore(severity: SignalSeverity): number {
  return {
    critical: 40,
    high: 30,
    medium: 20,
    low: 10,
  }[severity];
}
