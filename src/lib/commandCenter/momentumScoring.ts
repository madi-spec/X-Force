/**
 * Momentum Scoring Engine v3.2
 *
 * Formula: MS = B + T + V + E + R - O (capped at 100, min 1)
 *
 * B = Base Priority (0-35 pts) - Action type importance
 * T = Time Pressure (-10 to 25 pts) - Deadline urgency
 * V = Value Score (0-20 pts) - Deal value weighted by probability
 * E = Engagement Signals (0-20 pts) - Recent buyer activity
 * R = Risk Score (0-30 pts) - Deal risk signals
 * O = Orphan Penalty (0-40 pts) - DEDUCT for missing context
 *
 * KEY INSIGHT: Items without company/deal context are near-worthless.
 * A $0 orphan task should NEVER compete with real pipeline work.
 */

import { ActionType, CommandCenterItem, MomentumScore, ScoreFactors } from '@/types/commandCenter';

// ============================================
// BASE PRIORITY SCORES (B: 0-35 pts)
// ============================================

const BASE_PRIORITIES: Record<string, number> = {
  // Highest priority - commitments and buying signals
  commitment_made: 35,       // We said we'd do something
  buying_signal: 32,         // Prospect showing intent
  executive_engaged: 30,     // C-level involvement

  // High priority - follow-ups
  meeting_follow_up: 28,     // After customer meeting
  proposal_follow_up: 28,    // Proposal sent, awaiting response
  sla_breach: 25,            // Response SLA at risk
  competitor_mentioned: 25,  // Competitive situation

  // Medium priority - proactive
  meeting_prep: 22,          // Upcoming meeting
  email_respond: 20,         // Reply needed
  call_with_prep: 18,        // Scheduled outreach
  call: 18,

  // Lower priority - optional
  email_send_draft: 15,      // AI draft ready
  email_compose: 15,
  linkedin_touch: 12,
  research_account: 10,
  task_simple: 10,
  task_complex: 12,
  internal_sync: 8,
};

/**
 * Get base priority for an action type
 */
export function getBasePriority(actionType: ActionType, context?: { signal_type?: string }): {
  value: number;
  explanation: string;
} {
  // Check for special signal-based priorities
  if (context?.signal_type) {
    const signalPriority = BASE_PRIORITIES[context.signal_type];
    if (signalPriority) {
      return {
        value: signalPriority,
        explanation: `${formatSignalType(context.signal_type)} → +${signalPriority}`,
      };
    }
  }

  const priority = BASE_PRIORITIES[actionType] || 10;
  return {
    value: priority,
    explanation: `${formatActionType(actionType)} → +${priority}`,
  };
}

// ============================================
// TIME PRESSURE (T: -10 to 25 pts)
// ============================================

/**
 * Calculate time pressure score based on due date
 *
 * KEY INSIGHT: Very old overdue items are probably stale/irrelevant.
 * Fresh urgency deserves points. Ancient tasks deserve cleanup.
 *
 * - Due soon: 2-20 pts (genuine urgency)
 * - Recently overdue (0-7 days): 15-20 pts (needs attention)
 * - Moderately overdue (7-30 days): 5-15 pts (fading urgency)
 * - Very stale (30+ days): 0 to -10 pts (probably irrelevant)
 */
export function getTimePressure(dueAt: string | null | undefined): {
  value: number;
  explanation: string;
} {
  if (!dueAt) {
    return { value: 0, explanation: '' };
  }

  const now = new Date();
  const due = new Date(dueAt);
  const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Overdue
  if (hoursUntilDue < 0) {
    const overdueHours = Math.abs(hoursUntilDue);
    const overdueDays = overdueHours / 24;

    // Very stale (30+ days): Penalize - these are likely irrelevant
    if (overdueDays >= 30) {
      const penalty = Math.min(10, Math.round((overdueDays - 30) / 30));
      return {
        value: -penalty,
        explanation: `Stale (${Math.round(overdueDays)}d old) → -${penalty}`,
      };
    }

    // Moderately overdue (7-30 days): Decreasing urgency
    if (overdueDays >= 7) {
      const value = Math.max(5, 15 - Math.round((overdueDays - 7) * 0.5));
      return {
        value,
        explanation: `Overdue ${Math.round(overdueDays)}d → +${value}`,
      };
    }

    // Recently overdue (0-7 days): Genuine urgency
    const value = Math.min(20, 15 + Math.round(overdueDays));
    return {
      value,
      explanation: `Overdue ${Math.round(overdueDays)}d → +${value}`,
    };
  }

  // Due very soon (next 2 hours)
  if (hoursUntilDue <= 2) {
    const value = 20;
    return {
      value,
      explanation: `Due in ${formatHours(hoursUntilDue)} → +${value}`,
    };
  }

  // Due within work day (2-8 hours)
  if (hoursUntilDue <= 8) {
    const value = Math.round(18 - (hoursUntilDue - 2) * 2);
    return {
      value,
      explanation: `Due in ${formatHours(hoursUntilDue)} → +${value}`,
    };
  }

  // Due today (8-24 hours)
  if (hoursUntilDue <= 24) {
    const value = Math.max(2, Math.round(10 - (hoursUntilDue - 8) * 0.5));
    return {
      value,
      explanation: `Due today → +${value}`,
    };
  }

  // Due this week (1-7 days)
  if (hoursUntilDue <= 168) {
    const daysUntil = Math.ceil(hoursUntilDue / 24);
    const value = Math.max(0, 5 - daysUntil);
    if (value > 0) {
      return {
        value,
        explanation: `Due in ${daysUntil} days → +${value}`,
      };
    }
  }

  return { value: 0, explanation: '' };
}

// ============================================
// VALUE SCORE (V: 0-20 pts)
// ============================================

/**
 * Calculate value score based on deal value and probability
 *
 * Uses weighted value (deal_value * probability) compared to average deal size
 * Average deal size for X-RAI is ~$30K ACV
 */
export function getValueScore(
  dealValue: number | null | undefined,
  probability: number | null | undefined,
  avgDealSize: number = 30000
): {
  value: number;
  explanation: string;
} {
  if (!dealValue || dealValue <= 0) {
    return { value: 0, explanation: '' };
  }

  const prob = probability ?? 0.5;
  const weightedValue = dealValue * prob;

  // Scale: 0-20 points based on multiple of average deal size
  // $30K @ 50% = $15K weighted = ~8 pts (average)
  // $100K @ 80% = $80K weighted = ~18 pts (high)
  // $150K @ 50% = $75K weighted = ~17 pts
  const ratio = weightedValue / avgDealSize;
  const value = Math.min(20, Math.round(ratio * 10));

  const formattedValue = formatCurrency(weightedValue);
  return {
    value,
    explanation: `${formattedValue} weighted value → +${value}`,
  };
}

// ============================================
// ENGAGEMENT SIGNALS (E: 0-20 pts)
// ============================================

interface EngagementSignals {
  proposal_viewed?: { at: string; count?: number };
  email_opened?: { at: string; count?: number };
  link_clicked?: { at: string; url?: string };
  forwarded_internally?: { at: string };
  replied_quickly?: boolean;
  meeting_accepted?: { at: string };
}

/**
 * Calculate engagement score based on recent buyer activity
 */
export function getEngagementScore(signals?: EngagementSignals | null): {
  value: number;
  explanation: string;
  signals: string[];
} {
  if (!signals) {
    return { value: 0, explanation: 'No recent signals', signals: [] };
  }

  let score = 0;
  const parts: string[] = [];
  const signalList: string[] = [];

  // Proposal viewed (high signal)
  if (signals.proposal_viewed) {
    const minutesAgo = getMinutesAgo(signals.proposal_viewed.at);
    if (minutesAgo <= 60) {
      const pts = minutesAgo <= 15 ? 12 : minutesAgo <= 30 ? 10 : 8;
      score += pts;
      parts.push(`Proposal viewed ${minutesAgo}m ago → +${pts}`);
      signalList.push('proposal_viewed');
    }
  }

  // Forwarded internally (very high signal)
  if (signals.forwarded_internally) {
    const hoursAgo = getHoursAgo(signals.forwarded_internally.at);
    if (hoursAgo <= 48) {
      score += 10;
      parts.push('Forwarded internally → +10');
      signalList.push('forwarded_internally');
    }
  }

  // Email opened multiple times
  if (signals.email_opened && (signals.email_opened.count || 1) >= 3) {
    score += 5;
    parts.push(`Email opened ${signals.email_opened.count}x → +5`);
    signalList.push('email_opened');
  }

  // Link clicked
  if (signals.link_clicked) {
    const minutesAgo = getMinutesAgo(signals.link_clicked.at);
    if (minutesAgo <= 120) {
      score += 4;
      parts.push('Link clicked → +4');
      signalList.push('link_clicked');
    }
  }

  // Fast responder pattern
  if (signals.replied_quickly) {
    score += 3;
    parts.push('Fast responder → +3');
    signalList.push('replied_quickly');
  }

  // Meeting accepted
  if (signals.meeting_accepted) {
    const hoursAgo = getHoursAgo(signals.meeting_accepted.at);
    if (hoursAgo <= 24) {
      score += 5;
      parts.push('Meeting accepted → +5');
      signalList.push('meeting_accepted');
    }
  }

  // Cap at 20
  score = Math.min(20, score);

  return {
    value: score,
    explanation: parts.join(', ') || 'No recent signals',
    signals: signalList,
  };
}

// ============================================
// RISK SIGNALS (R: 0-30 pts)
// ============================================

interface RiskSignals {
  stale_days?: number;           // Days since last activity
  stuck_stage_days?: number;     // Days in current stage
  competitor_mentioned?: boolean;
  champion_going_dark?: boolean;
  health_score_drop?: number;    // % drop in last 7 days
  ghosting_risk?: boolean;
  multi_thread_missing?: boolean;
}

/**
 * Calculate risk score based on deal risk signals
 * Higher risk = more urgent to take action
 */
export function getRiskScore(signals?: RiskSignals | null): {
  value: number;
  explanation: string;
  signals: string[];
} {
  if (!signals) {
    return { value: 0, explanation: '', signals: [] };
  }

  let score = 0;
  const parts: string[] = [];
  const signalList: string[] = [];

  // Stale deal (no activity) - up to 12 pts
  if (signals.stale_days && signals.stale_days > 5) {
    const pts = Math.min(12, Math.round(signals.stale_days * 0.8));
    score += pts;
    parts.push(`No activity for ${signals.stale_days}d → +${pts}`);
    signalList.push('stale_deal');
  }

  // Stuck in stage - up to 10 pts
  if (signals.stuck_stage_days && signals.stuck_stage_days > 14) {
    const pts = Math.min(10, Math.round((signals.stuck_stage_days - 14) * 0.5));
    if (pts > 0) {
      score += pts;
      parts.push(`Stuck in stage ${signals.stuck_stage_days}d → +${pts}`);
      signalList.push('stuck_stage');
    }
  }

  // Competitor mentioned - 8 pts
  if (signals.competitor_mentioned) {
    score += 8;
    parts.push('Competitor mentioned → +8');
    signalList.push('competitor_mentioned');
  }

  // Champion going dark - 10 pts
  if (signals.champion_going_dark) {
    score += 10;
    parts.push('Champion going dark → +10');
    signalList.push('champion_going_dark');
  }

  // Health score drop - up to 8 pts
  if (signals.health_score_drop && signals.health_score_drop > 10) {
    const pts = Math.min(8, Math.round(signals.health_score_drop * 0.4));
    score += pts;
    parts.push(`Health dropped ${signals.health_score_drop}% → +${pts}`);
    signalList.push('health_score_drop');
  }

  // Ghosting risk - 6 pts
  if (signals.ghosting_risk) {
    score += 6;
    parts.push('Ghosting risk → +6');
    signalList.push('ghosting_risk');
  }

  // Multi-thread missing - 5 pts
  if (signals.multi_thread_missing) {
    score += 5;
    parts.push('Single-threaded → +5');
    signalList.push('multi_thread_missing');
  }

  // Cap at 30
  score = Math.min(30, score);

  return {
    value: score,
    explanation: parts.join(', ') || '',
    signals: signalList,
  };
}

// ============================================
// ORPHAN PENALTY (O: 0-40 pts DEDUCTED)
// ============================================

/**
 * Calculate penalty for orphan items (missing context)
 *
 * KEY INSIGHT: Reps should work PIPELINE, not cold outreach.
 * Items without deals are not pipeline work - they're prospecting
 * that should happen in dedicated prospecting blocks, not mixed
 * with active deal work.
 *
 * Penalty tiers:
 * - No deal AND no company: -50 pts (garbage tier - dismiss or link)
 * - No deal but has company: -30 pts (not pipeline - this is prospecting)
 * - Has deal but no value: -10 pts (pipeline but unknown value)
 */
export function getOrphanPenalty(
  dealId: string | null | undefined,
  companyId: string | null | undefined,
  dealValue: number | null | undefined
): {
  value: number;
  explanation: string;
} {
  // Complete orphan - no company, no deal
  if (!dealId && !companyId) {
    return {
      value: -50,
      explanation: 'No company or deal → -50 (dismiss or link)',
    };
  }

  // Has company but no deal - NOT PIPELINE WORK
  if (!dealId && companyId) {
    return {
      value: -30,
      explanation: 'No deal (not pipeline work) → -30',
    };
  }

  // Has deal but no value - $0 deals are fake pipeline
  if (dealId && (!dealValue || dealValue <= 0)) {
    return {
      value: -25,
      explanation: '$0 deal (add value or close it) → -25',
    };
  }

  // Fully enriched - no penalty
  return { value: 0, explanation: '' };
}

// ============================================
// MAIN SCORING FUNCTION
// ============================================

export interface ScoringContext {
  signal_type?: string;
  engagement_signals?: EngagementSignals;
  risk_signals?: RiskSignals;
  avg_deal_size?: number;
}

/**
 * Calculate full momentum score for an item
 * Formula: MS = B + T + V + E + R + O (capped at 100, min 1)
 * where O is NEGATIVE for orphan items
 */
export function calculateMomentumScore(
  item: Pick<CommandCenterItem, 'action_type' | 'due_at' | 'deal_value' | 'deal_probability' | 'deal_id' | 'company_id'>,
  context?: ScoringContext
): MomentumScore {
  // Calculate each component
  const base = getBasePriority(item.action_type, context);
  const time = getTimePressure(item.due_at);
  const value = getValueScore(item.deal_value, item.deal_probability, context?.avg_deal_size);
  const engagement = getEngagementScore(context?.engagement_signals);
  const risk = getRiskScore(context?.risk_signals);
  const orphan = getOrphanPenalty(item.deal_id, item.company_id, item.deal_value);

  // Sum with orphan penalty (negative), cap at 100, min at 1
  const rawScore = base.value + time.value + value.value + engagement.value + risk.value + orphan.value;
  const score = Math.max(1, Math.min(100, rawScore));

  // Build explanation array
  const explanation: string[] = [];
  if (base.value > 0) explanation.push(base.explanation);
  if (time.value !== 0) explanation.push(time.explanation);
  if (value.value > 0) explanation.push(value.explanation);
  if (engagement.value > 0 && engagement.signals.length > 0) {
    explanation.push(engagement.explanation);
  }
  if (risk.value > 0 && risk.signals.length > 0) {
    explanation.push(risk.explanation);
  }
  // Always show orphan penalty if applicable - this explains why score is low
  if (orphan.value < 0) {
    explanation.push(orphan.explanation);
  }

  // Build factors object
  const factors: ScoreFactors = {
    base: { value: base.value, explanation: base.explanation },
    time: { value: time.value, explanation: time.explanation },
    value: { value: value.value, explanation: value.explanation },
    engagement: {
      value: engagement.value,
      explanation: engagement.explanation,
      signals: engagement.signals,
    },
    risk: {
      value: risk.value,
      explanation: risk.explanation,
      signals: risk.signals,
    },
    orphan: {
      value: orphan.value,
      explanation: orphan.explanation,
    },
  };

  return {
    score,
    factors,
    explanation,
  };
}

/**
 * Batch score multiple items
 */
export function scoreItems(
  items: Array<Pick<CommandCenterItem, 'id' | 'action_type' | 'due_at' | 'deal_value' | 'deal_probability' | 'deal_id' | 'company_id'>>,
  context?: ScoringContext
): Array<{ id: string; score: MomentumScore }> {
  return items.map((item) => ({
    id: item.id,
    score: calculateMomentumScore(item, context),
  }));
}

// ============================================
// HELPERS
// ============================================

function formatActionType(actionType: string): string {
  return actionType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSignalType(signalType: string): string {
  return signalType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  if (hours < 24) {
    return `${Math.round(hours)} hrs`;
  }
  return `${Math.round(hours / 24)} days`;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }
  return `$${value}`;
}

function getMinutesAgo(isoDate: string): number {
  const then = new Date(isoDate);
  const now = new Date();
  return Math.round((now.getTime() - then.getTime()) / (1000 * 60));
}

function getHoursAgo(isoDate: string): number {
  const then = new Date(isoDate);
  const now = new Date();
  return Math.round((now.getTime() - then.getTime()) / (1000 * 60 * 60));
}
