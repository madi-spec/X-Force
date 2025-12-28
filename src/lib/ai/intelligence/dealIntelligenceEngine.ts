/**
 * Deal Intelligence Engine
 *
 * Computes deal state using deterministic code (not LLM):
 * - Fast (milliseconds, not seconds)
 * - Predictable (same inputs = same outputs)
 * - Debuggable (can trace every decision)
 * - Trustworthy (no hallucinated reasoning)
 */

import { calculateMomentum, MomentumResult } from './momentumCalculator';
import { calculateConfidence, ConfidenceResult } from './confidenceCalculator';
import { calculateEconomics, EconomicsResult } from './economicsCalculator';
import { checkUncertainty, UncertaintyResult } from './uncertaintyChecker';

// ============================================
// TYPES
// ============================================

export interface DealData {
  id: string;
  name: string;
  stage: string;
  amount: number | null;
  estimated_value: number | null;
  close_date: string | null;
  stage_changed_at: string | null;
  created_at: string;
  products: string[] | null;
  company: {
    id: string;
    name: string;
    employee_count: number | null;
    location_count: number | null;
    ownership_type: string | null;
    pct_top_100: boolean;
  } | null;
  contacts: Array<{
    id: string;
    name: string;
    title: string | null;
    is_decision_maker: boolean;
    is_champion: boolean;
  }>;
  activities: Array<{
    id: string;
    type: string;
    direction: string | null;
    date: string;
    subject: string | null;
  }>;
}

export interface DealIntelligence {
  deal_id: string;

  // Stage & Time
  stage: string;
  days_in_stage: number;
  total_days: number;

  // Momentum
  momentum: 'accelerating' | 'stable' | 'stalling' | 'dead';
  momentum_score: number; // -100 to +100
  momentum_signals: MomentumSignal[];

  // Confidence Factors (MEDDIC-aligned, 0-100 each)
  confidence_engagement: number;
  confidence_champion: number;
  confidence_authority: number;
  confidence_need: number;
  confidence_timeline: number;

  // Win Probability with confidence bands
  win_probability: number;
  win_probability_low: number;
  win_probability_high: number;
  win_probability_trend: 'up' | 'down' | 'stable';
  probability_factors: string[];

  // Uncertainty state
  is_uncertain: boolean;
  uncertainty_reason: string | null;
  uncertainty_suggested_action: string | null;

  // Economics
  estimated_acv: number;
  expected_value: number;
  investment_level: 'high' | 'medium' | 'low' | 'minimal';
  max_human_hours: number;
  human_hours_spent: number;
  cost_of_delay_per_week: number;

  // Risk
  risk_factors: RiskFactor[];
  stall_reasons: string[];

  // Next actions
  next_actions: NextAction[];

  computed_at: string;
}

export interface MomentumSignal {
  signal: string;
  impact: 'positive' | 'negative';
  score_delta: number;
  details?: string;
}

export interface RiskFactor {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  mitigation?: string;
}

export interface NextAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
  owner?: string;
}

// ============================================
// MAIN ENGINE
// ============================================

export function computeDealIntelligence(deal: DealData): DealIntelligence {
  const now = new Date();

  // Calculate days in stage and total days
  const stageChangedAt = deal.stage_changed_at ? new Date(deal.stage_changed_at) : new Date(deal.created_at);
  const createdAt = new Date(deal.created_at);
  const daysInStage = Math.floor((now.getTime() - stageChangedAt.getTime()) / (1000 * 60 * 60 * 24));
  const totalDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate momentum
  const momentumResult = calculateMomentum(deal, daysInStage);

  // Calculate confidence factors
  const confidenceResult = calculateConfidence(deal);

  // Calculate economics
  const economicsResult = calculateEconomics(deal, confidenceResult);

  // Check for uncertainty
  const uncertaintyResult = checkUncertainty(deal, momentumResult, confidenceResult);

  // Calculate win probability
  const winProbability = calculateWinProbability(deal.stage, confidenceResult, momentumResult);

  // Identify risk factors
  const riskFactors = identifyRiskFactors(deal, momentumResult, confidenceResult);

  // Determine next actions
  const nextActions = determineNextActions(deal, momentumResult, confidenceResult, riskFactors);

  // Determine stall reasons
  const stallReasons = momentumResult.momentum === 'stalling' || momentumResult.momentum === 'dead'
    ? identifyStallReasons(deal, momentumResult)
    : [];

  return {
    deal_id: deal.id,

    // Stage & Time
    stage: deal.stage,
    days_in_stage: daysInStage,
    total_days: totalDays,

    // Momentum
    momentum: momentumResult.momentum,
    momentum_score: momentumResult.score,
    momentum_signals: momentumResult.signals,

    // Confidence
    confidence_engagement: confidenceResult.engagement,
    confidence_champion: confidenceResult.champion,
    confidence_authority: confidenceResult.authority,
    confidence_need: confidenceResult.need,
    confidence_timeline: confidenceResult.timeline,

    // Win Probability
    win_probability: winProbability.probability,
    win_probability_low: winProbability.low,
    win_probability_high: winProbability.high,
    win_probability_trend: winProbability.trend,
    probability_factors: winProbability.factors,

    // Uncertainty
    is_uncertain: uncertaintyResult.isUncertain,
    uncertainty_reason: uncertaintyResult.reason,
    uncertainty_suggested_action: uncertaintyResult.suggestedAction,

    // Economics
    estimated_acv: economicsResult.estimatedAcv,
    expected_value: economicsResult.expectedValue,
    investment_level: economicsResult.investmentLevel,
    max_human_hours: economicsResult.maxHumanHours,
    human_hours_spent: 0, // TODO: Calculate from activities
    cost_of_delay_per_week: economicsResult.costOfDelayPerWeek,

    // Risk & Actions
    risk_factors: riskFactors,
    stall_reasons: stallReasons,
    next_actions: nextActions,

    computed_at: now.toISOString(),
  };
}

// ============================================
// WIN PROBABILITY CALCULATION
// ============================================

interface WinProbabilityResult {
  probability: number;
  low: number;
  high: number;
  trend: 'up' | 'down' | 'stable';
  factors: string[];
}

function calculateWinProbability(
  stage: string,
  confidence: ConfidenceResult,
  momentum: MomentumResult
): WinProbabilityResult {
  // Base probability by stage
  const baseProbabilities: Record<string, number> = {
    'prospecting': 10,
    'qualifying': 20,
    'discovery': 30,
    'demo': 40,
    'data_review': 50,
    'trial': 60,
    'negotiation': 75,
    'closed_won': 100,
    'closed_lost': 0,
  };

  let probability = baseProbabilities[stage] || 25;
  const factors: string[] = [];

  // Adjust based on confidence factors
  const avgConfidence = (
    confidence.engagement +
    confidence.champion +
    confidence.authority +
    confidence.need +
    confidence.timeline
  ) / 5;

  // High confidence increases probability
  if (avgConfidence >= 70) {
    probability += 15;
    factors.push('Strong confidence across factors');
  } else if (avgConfidence >= 50) {
    probability += 5;
    factors.push('Moderate confidence');
  } else if (avgConfidence < 30) {
    probability -= 10;
    factors.push('Low confidence - needs validation');
  }

  // Momentum adjustment
  if (momentum.momentum === 'accelerating') {
    probability += 10;
    factors.push('Deal accelerating');
  } else if (momentum.momentum === 'stalling') {
    probability -= 15;
    factors.push('Deal stalling');
  } else if (momentum.momentum === 'dead') {
    probability -= 30;
    factors.push('Deal appears dead');
  }

  // No champion is a major risk
  if (confidence.champion < 30) {
    probability -= 10;
    factors.push('No identified champion');
  }

  // No decision maker access is risky
  if (confidence.authority < 30) {
    probability -= 10;
    factors.push('No decision maker access');
  }

  // Clamp probability
  probability = Math.max(5, Math.min(95, probability));

  // Calculate confidence bands (wider when uncertain)
  const uncertainty = 100 - avgConfidence;
  const bandWidth = Math.floor(uncertainty / 4);
  const low = Math.max(5, probability - bandWidth);
  const high = Math.min(95, probability + bandWidth);

  // Determine trend based on momentum
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (momentum.score > 20) trend = 'up';
  else if (momentum.score < -20) trend = 'down';

  return { probability, low, high, trend, factors };
}

// ============================================
// RISK IDENTIFICATION
// ============================================

function identifyRiskFactors(
  deal: DealData,
  momentum: MomentumResult,
  confidence: ConfidenceResult
): RiskFactor[] {
  const risks: RiskFactor[] = [];

  // Stalling momentum
  if (momentum.momentum === 'stalling') {
    risks.push({
      type: 'momentum',
      severity: 'medium',
      description: 'Deal momentum has slowed significantly',
      mitigation: 'Schedule discovery call to re-engage',
    });
  } else if (momentum.momentum === 'dead') {
    risks.push({
      type: 'momentum',
      severity: 'high',
      description: 'Deal appears to have stalled completely',
      mitigation: 'Executive outreach or consider moving to lost',
    });
  }

  // No champion
  if (confidence.champion < 30) {
    risks.push({
      type: 'champion',
      severity: 'high',
      description: 'No internal champion identified',
      mitigation: 'Find and develop an internal advocate',
    });
  }

  // No decision maker access
  if (confidence.authority < 30) {
    risks.push({
      type: 'authority',
      severity: 'high',
      description: 'No access to decision maker',
      mitigation: 'Ask champion for introduction to economic buyer',
    });
  }

  // Timeline uncertainty
  if (confidence.timeline < 30) {
    risks.push({
      type: 'timeline',
      severity: 'medium',
      description: 'No clear timeline or urgency',
      mitigation: 'Identify compelling event or create urgency',
    });
  }

  // Low engagement
  if (confidence.engagement < 30) {
    risks.push({
      type: 'engagement',
      severity: 'medium',
      description: 'Prospect not actively engaged',
      mitigation: 'Change approach or communication channel',
    });
  }

  // Deal value not confirmed
  if (!deal.amount && !deal.estimated_value) {
    risks.push({
      type: 'value',
      severity: 'low',
      description: 'Deal value not established',
      mitigation: 'Confirm budget and scope in next conversation',
    });
  }

  return risks;
}

// ============================================
// STALL REASON IDENTIFICATION
// ============================================

function identifyStallReasons(deal: DealData, momentum: MomentumResult): string[] {
  const reasons: string[] = [];

  // Check momentum signals for negative indicators
  for (const signal of momentum.signals) {
    if (signal.impact === 'negative' && signal.score_delta <= -15) {
      reasons.push(signal.signal);
    }
  }

  // Add generic reasons if no specific ones found
  if (reasons.length === 0) {
    reasons.push('No recent engagement from prospect');
  }

  return reasons;
}

// ============================================
// NEXT ACTION DETERMINATION
// ============================================

function determineNextActions(
  deal: DealData,
  momentum: MomentumResult,
  confidence: ConfidenceResult,
  risks: RiskFactor[]
): NextAction[] {
  const actions: NextAction[] = [];

  // Address high-severity risks first
  const highRisks = risks.filter(r => r.severity === 'high');
  for (const risk of highRisks.slice(0, 2)) {
    if (risk.mitigation) {
      actions.push({
        action: risk.mitigation,
        priority: 'high',
        rationale: risk.description,
      });
    }
  }

  // Stage-specific actions
  switch (deal.stage) {
    case 'prospecting':
      if (!actions.some(a => a.priority === 'high')) {
        actions.push({
          action: 'Schedule discovery call',
          priority: 'high',
          rationale: 'Move deal forward from prospecting',
        });
      }
      break;

    case 'qualifying':
      if (confidence.need < 50) {
        actions.push({
          action: 'Validate business need and pain points',
          priority: 'high',
          rationale: 'Need not yet confirmed',
        });
      }
      break;

    case 'discovery':
      if (confidence.authority < 50) {
        actions.push({
          action: 'Identify and engage economic buyer',
          priority: 'high',
          rationale: 'Decision maker access needed before demo',
        });
      }
      break;

    case 'demo':
      actions.push({
        action: 'Send personalized follow-up with key value points',
        priority: 'medium',
        rationale: 'Reinforce demo takeaways',
      });
      break;

    case 'trial':
      actions.push({
        action: 'Schedule mid-trial check-in',
        priority: 'medium',
        rationale: 'Ensure trial success and gather feedback',
      });
      break;

    case 'negotiation':
      actions.push({
        action: 'Prepare final proposal with mutual action plan',
        priority: 'high',
        rationale: 'Close deal momentum',
      });
      break;
  }

  // If momentum is stalling, add re-engagement action
  if (momentum.momentum === 'stalling' && !actions.some(a => a.action.includes('call'))) {
    actions.push({
      action: 'Place a direct call to primary contact',
      priority: 'high',
      rationale: 'Re-engage stalling deal',
    });
  }

  return actions.slice(0, 3); // Limit to 3 actions
}
