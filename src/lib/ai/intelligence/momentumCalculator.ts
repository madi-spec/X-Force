/**
 * Momentum Calculator
 *
 * Calculates deal momentum based on activity patterns.
 * Score ranges from -100 to +100.
 */

import { DealData, MomentumSignal } from './dealIntelligenceEngine';

export interface MomentumResult {
  momentum: 'accelerating' | 'stable' | 'stalling' | 'dead';
  score: number;
  signals: MomentumSignal[];
}

export function calculateMomentum(deal: DealData, daysInStage: number): MomentumResult {
  let score = 0;
  const signals: MomentumSignal[] = [];
  const now = new Date();

  // Get activities from last 14 days
  const recentActivities = deal.activities.filter(a => {
    const activityDate = new Date(a.date);
    const daysSince = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 14;
  });

  // Get activities from last 7 days
  const thisWeekActivities = deal.activities.filter(a => {
    const activityDate = new Date(a.date);
    const daysSince = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  });

  // ============================================
  // POSITIVE SIGNALS
  // ============================================

  // Inbound activity this week
  const inboundThisWeek = thisWeekActivities.filter(a => a.direction === 'inbound').length;
  if (inboundThisWeek >= 3) {
    score += 30;
    signals.push({
      signal: 'High inbound engagement this week',
      impact: 'positive',
      score_delta: 30,
      details: `${inboundThisWeek} inbound activities`,
    });
  } else if (inboundThisWeek >= 1) {
    score += 15;
    signals.push({
      signal: 'Inbound engagement this week',
      impact: 'positive',
      score_delta: 15,
      details: `${inboundThisWeek} inbound activities`,
    });
  }

  // Meeting scheduled or held recently
  const meetings = recentActivities.filter(a => a.type === 'meeting');
  if (meetings.length > 0) {
    score += 25;
    signals.push({
      signal: 'Recent meeting activity',
      impact: 'positive',
      score_delta: 25,
      details: `${meetings.length} meetings in last 14 days`,
    });
  }

  // Multiple stakeholders engaged
  const uniqueContactsEngaged = new Set(
    recentActivities
      .filter(a => a.subject) // Has some engagement
      .map(a => a.subject?.toLowerCase() || '')
  ).size;

  if (uniqueContactsEngaged >= 3) {
    score += 20;
    signals.push({
      signal: 'Multiple stakeholders engaged',
      impact: 'positive',
      score_delta: 20,
      details: `${uniqueContactsEngaged} unique touchpoints`,
    });
  }

  // Call completed this week
  const callsThisWeek = thisWeekActivities.filter(a => a.type === 'call').length;
  if (callsThisWeek > 0) {
    score += 15;
    signals.push({
      signal: 'Call activity this week',
      impact: 'positive',
      score_delta: 15,
      details: `${callsThisWeek} calls`,
    });
  }

  // Recent stage advancement (if in stage less than 7 days)
  if (daysInStage <= 7 && deal.stage !== 'prospecting') {
    score += 15;
    signals.push({
      signal: 'Recently advanced stage',
      impact: 'positive',
      score_delta: 15,
      details: `In ${deal.stage} for ${daysInStage} days`,
    });
  }

  // ============================================
  // NEGATIVE SIGNALS
  // ============================================

  // No inbound activity in 14 days
  const lastInbound = deal.activities
    .filter(a => a.direction === 'inbound')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  let daysSinceLastInbound = Infinity;
  if (lastInbound) {
    daysSinceLastInbound = (now.getTime() - new Date(lastInbound.date).getTime()) / (1000 * 60 * 60 * 24);
  }

  if (daysSinceLastInbound >= 21) {
    score -= 40;
    signals.push({
      signal: 'No inbound activity in 21+ days',
      impact: 'negative',
      score_delta: -40,
      details: `${Math.floor(daysSinceLastInbound)} days since last inbound`,
    });
  } else if (daysSinceLastInbound >= 14) {
    score -= 30;
    signals.push({
      signal: 'No inbound activity in 14+ days',
      impact: 'negative',
      score_delta: -30,
      details: `${Math.floor(daysSinceLastInbound)} days since last inbound`,
    });
  } else if (daysSinceLastInbound >= 7) {
    score -= 15;
    signals.push({
      signal: 'No inbound activity in 7+ days',
      impact: 'negative',
      score_delta: -15,
      details: `${Math.floor(daysSinceLastInbound)} days since last inbound`,
    });
  }

  // Stuck in stage too long
  const maxDaysPerStage: Record<string, number> = {
    'prospecting': 14,
    'qualifying': 21,
    'discovery': 21,
    'demo': 14,
    'data_review': 21,
    'trial': 30,
    'negotiation': 30,
  };

  const maxDays = maxDaysPerStage[deal.stage] || 21;
  if (daysInStage > maxDays * 2) {
    score -= 30;
    signals.push({
      signal: `Stuck in ${deal.stage} too long`,
      impact: 'negative',
      score_delta: -30,
      details: `${daysInStage} days (expected <${maxDays})`,
    });
  } else if (daysInStage > maxDays) {
    score -= 15;
    signals.push({
      signal: `Slow progress in ${deal.stage}`,
      impact: 'negative',
      score_delta: -15,
      details: `${daysInStage} days (expected <${maxDays})`,
    });
  }

  // Multiple outbound with no response
  const outboundThisWeek = thisWeekActivities.filter(a => a.direction === 'outbound').length;
  if (outboundThisWeek >= 3 && inboundThisWeek === 0) {
    score -= 20;
    signals.push({
      signal: 'Multiple outreach attempts without response',
      impact: 'negative',
      score_delta: -20,
      details: `${outboundThisWeek} outbound, 0 inbound this week`,
    });
  }

  // No activity at all in 7 days
  if (recentActivities.length === 0) {
    score -= 25;
    signals.push({
      signal: 'No activity in 14+ days',
      impact: 'negative',
      score_delta: -25,
    });
  } else if (thisWeekActivities.length === 0) {
    score -= 10;
    signals.push({
      signal: 'No activity this week',
      impact: 'negative',
      score_delta: -10,
    });
  }

  // ============================================
  // CLASSIFY MOMENTUM
  // ============================================

  // Clamp score to -100 to +100
  score = Math.max(-100, Math.min(100, score));

  let momentum: 'accelerating' | 'stable' | 'stalling' | 'dead';
  if (score >= 30) {
    momentum = 'accelerating';
  } else if (score >= 0) {
    momentum = 'stable';
  } else if (score >= -30) {
    momentum = 'stalling';
  } else {
    momentum = 'dead';
  }

  return { momentum, score, signals };
}
