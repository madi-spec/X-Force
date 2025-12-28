/**
 * Confidence Calculator
 *
 * Calculates MEDDIC-aligned confidence factors:
 * - Engagement: Are they responding?
 * - Champion: Do we have an internal advocate?
 * - Authority: Are we talking to the decision maker?
 * - Need: Is the pain confirmed?
 * - Timeline: Is there urgency?
 */

import { DealData } from './dealIntelligenceEngine';

export interface ConfidenceResult {
  engagement: number;  // 0-100
  champion: number;    // 0-100
  authority: number;   // 0-100
  need: number;        // 0-100
  timeline: number;    // 0-100
}

export function calculateConfidence(deal: DealData): ConfidenceResult {
  return {
    engagement: calculateEngagement(deal),
    champion: calculateChampion(deal),
    authority: calculateAuthority(deal),
    need: calculateNeed(deal),
    timeline: calculateTimeline(deal),
  };
}

// ============================================
// ENGAGEMENT CONFIDENCE
// Are they responding? Active in the process?
// ============================================

function calculateEngagement(deal: DealData): number {
  let score = 50; // Start neutral
  const now = new Date();

  // Recent activity is good
  const recentActivities = deal.activities.filter(a => {
    const daysSince = (now.getTime() - new Date(a.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 14;
  });

  const inboundCount = recentActivities.filter(a => a.direction === 'inbound').length;
  const outboundCount = recentActivities.filter(a => a.direction === 'outbound').length;

  // High inbound = high engagement
  if (inboundCount >= 5) score += 35;
  else if (inboundCount >= 3) score += 25;
  else if (inboundCount >= 1) score += 15;
  else score -= 20; // No inbound is concerning

  // Response ratio
  if (outboundCount > 0 && inboundCount > 0) {
    const ratio = inboundCount / outboundCount;
    if (ratio >= 0.5) score += 15; // Good response rate
    else if (ratio < 0.25) score -= 15; // Poor response rate
  }

  // Meeting activity
  const meetings = recentActivities.filter(a => a.type === 'meeting').length;
  if (meetings >= 2) score += 20;
  else if (meetings >= 1) score += 10;

  // Time since last contact
  if (deal.activities.length > 0) {
    const lastActivity = deal.activities.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    const daysSince = (now.getTime() - new Date(lastActivity.date).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince > 14) score -= 25;
    else if (daysSince > 7) score -= 10;
    else if (daysSince <= 3) score += 10;
  } else {
    score -= 30; // No activities at all
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================
// CHAMPION CONFIDENCE
// Do we have someone internally advocating for us?
// ============================================

function calculateChampion(deal: DealData): number {
  let score = 20; // Start low - champion must be earned

  // Look for champion-flagged contacts
  const champions = deal.contacts.filter(c => c.is_champion);

  if (champions.length > 0) {
    score += 50; // We have an identified champion

    // Champion with decision-making power is even better
    if (champions.some(c => c.is_decision_maker)) {
      score += 20;
    }
  }

  // Multiple contacts is a good sign even without explicit champion
  if (deal.contacts.length >= 3) {
    score += 15;
  } else if (deal.contacts.length >= 2) {
    score += 10;
  }

  // Stage-based inference
  // If we're past discovery without a champion, that's concerning
  const advancedStages = ['demo', 'data_review', 'trial', 'negotiation'];
  if (advancedStages.includes(deal.stage) && champions.length === 0) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================
// AUTHORITY CONFIDENCE
// Are we talking to someone who can say yes?
// ============================================

function calculateAuthority(deal: DealData): number {
  let score = 30; // Start moderate

  // Look for decision makers
  const decisionMakers = deal.contacts.filter(c => c.is_decision_maker);

  if (decisionMakers.length > 0) {
    score += 40; // We have decision maker access

    // Multiple decision makers (buying committee)
    if (decisionMakers.length >= 2) {
      score += 15;
    }
  }

  // Title-based inference for contacts without flags
  const executiveTitles = ['owner', 'ceo', 'president', 'founder', 'partner', 'vp', 'director'];
  const hasExecutive = deal.contacts.some(c =>
    c.title && executiveTitles.some(t => c.title?.toLowerCase().includes(t))
  );

  if (hasExecutive && decisionMakers.length === 0) {
    score += 25; // Likely have authority access even if not flagged
  }

  // Stage-based expectations
  // In negotiation without decision maker = risky
  if (deal.stage === 'negotiation' && decisionMakers.length === 0 && !hasExecutive) {
    score -= 20;
  }

  // Company ownership type hints
  if (deal.company?.ownership_type === 'owner_led' || deal.company?.ownership_type === 'family') {
    // Owner-led companies - if we have owner, we have authority
    const hasOwner = deal.contacts.some(c =>
      c.title?.toLowerCase().includes('owner') || c.title?.toLowerCase().includes('founder')
    );
    if (hasOwner) score += 15;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================
// NEED CONFIDENCE
// Is there a real problem we're solving?
// ============================================

function calculateNeed(deal: DealData): number {
  let score = 40; // Start moderate

  // Stage progression indicates validated need
  const needValidatedStages = ['demo', 'data_review', 'trial', 'negotiation'];
  const needPartialStages = ['discovery'];

  if (needValidatedStages.includes(deal.stage)) {
    score += 35; // Past discovery = need should be validated
  } else if (needPartialStages.includes(deal.stage)) {
    score += 15; // In discovery = exploring need
  }

  // Deal amount set indicates discussed value
  if (deal.amount || deal.estimated_value) {
    score += 15;
  }

  // Multiple meetings suggest real engagement with problem
  const meetings = deal.activities.filter(a => a.type === 'meeting').length;
  if (meetings >= 3) score += 15;
  else if (meetings >= 2) score += 10;

  // Products identified suggests specific solution discussed
  if (deal.products && deal.products.length > 0) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================
// TIMELINE CONFIDENCE
// Is there urgency? A compelling event?
// ============================================

function calculateTimeline(deal: DealData): number {
  let score = 30; // Start lower - timeline is often unclear
  const now = new Date();

  // Close date set
  if (deal.close_date) {
    const closeDate = new Date(deal.close_date);
    const daysToClose = (closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysToClose <= 30) {
      score += 35; // Closing soon = clear timeline
    } else if (daysToClose <= 60) {
      score += 25;
    } else if (daysToClose <= 90) {
      score += 15;
    }

    // Close date in the past is concerning
    if (daysToClose < 0) {
      score -= 20; // Missed close date
    }
  }

  // Stage indicates progress
  const lateStages = ['trial', 'negotiation'];
  if (lateStages.includes(deal.stage)) {
    score += 20; // Late stage = timeline likely discussed
  }

  // Recent activity suggests active process
  const now7Days = deal.activities.filter(a => {
    const daysSince = (now.getTime() - new Date(a.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  }).length;

  if (now7Days >= 3) score += 15;
  else if (now7Days >= 1) score += 5;
  else score -= 10; // No recent activity = timeline slipping

  return Math.max(0, Math.min(100, score));
}
