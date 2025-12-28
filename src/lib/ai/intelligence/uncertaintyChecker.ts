/**
 * Uncertainty Checker
 *
 * The system knows when it doesn't know.
 * Flags deals where we lack sufficient data to make reliable predictions.
 */

import { DealData, MomentumSignal } from './dealIntelligenceEngine';
import { ConfidenceResult } from './confidenceCalculator';

interface MomentumResult {
  momentum: 'accelerating' | 'stable' | 'stalling' | 'dead';
  score: number;
  signals: MomentumSignal[];
}

export interface UncertaintyResult {
  isUncertain: boolean;
  reason: string | null;
  suggestedAction: string | null;
}

export function checkUncertainty(
  deal: DealData,
  momentum: MomentumResult,
  confidence: ConfidenceResult
): UncertaintyResult {
  // Check various uncertainty conditions
  const uncertaintyChecks = [
    checkDataScarcity(deal),
    checkConflictingSignals(momentum),
    checkStaleInformation(deal),
    checkConfidenceGaps(confidence),
    checkNewDeal(deal),
  ];

  // Return first uncertainty found
  for (const check of uncertaintyChecks) {
    if (check.isUncertain) {
      return check;
    }
  }

  return {
    isUncertain: false,
    reason: null,
    suggestedAction: null,
  };
}

// ============================================
// DATA SCARCITY CHECK
// Do we have enough information?
// ============================================

function checkDataScarcity(deal: DealData): UncertaintyResult {
  // No contacts
  if (deal.contacts.length === 0) {
    return {
      isUncertain: true,
      reason: 'No contacts associated with this deal',
      suggestedAction: 'Add at least one contact to enable accurate predictions',
    };
  }

  // Very few activities
  if (deal.activities.length < 2) {
    return {
      isUncertain: true,
      reason: 'Limited activity history',
      suggestedAction: 'Log more activities to improve prediction accuracy',
    };
  }

  // No company information
  if (!deal.company) {
    return {
      isUncertain: true,
      reason: 'No company associated with deal',
      suggestedAction: 'Link this deal to a company',
    };
  }

  return { isUncertain: false, reason: null, suggestedAction: null };
}

// ============================================
// CONFLICTING SIGNALS CHECK
// Are momentum signals contradictory?
// ============================================

function checkConflictingSignals(momentum: MomentumResult): UncertaintyResult {
  const positiveSignals = momentum.signals.filter(s => s.impact === 'positive');
  const negativeSignals = momentum.signals.filter(s => s.impact === 'negative');

  // Strong signals in both directions
  const strongPositive = positiveSignals.filter(s => s.score_delta >= 20);
  const strongNegative = negativeSignals.filter(s => s.score_delta <= -20);

  if (strongPositive.length >= 2 && strongNegative.length >= 2) {
    return {
      isUncertain: true,
      reason: 'Conflicting signals - both positive and negative indicators present',
      suggestedAction: 'Have a direct conversation with the prospect to clarify status',
    };
  }

  return { isUncertain: false, reason: null, suggestedAction: null };
}

// ============================================
// STALE INFORMATION CHECK
// Is our information too old?
// ============================================

function checkStaleInformation(deal: DealData): UncertaintyResult {
  if (deal.activities.length === 0) {
    return { isUncertain: false, reason: null, suggestedAction: null }; // Handled by data scarcity
  }

  const now = new Date();
  const lastActivity = deal.activities.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];

  const daysSinceActivity = (now.getTime() - new Date(lastActivity.date).getTime()) / (1000 * 60 * 60 * 24);

  // Very stale - 30+ days without activity
  if (daysSinceActivity > 30) {
    return {
      isUncertain: true,
      reason: `No activity in ${Math.floor(daysSinceActivity)} days - status unknown`,
      suggestedAction: 'Reach out to prospect to determine current status',
    };
  }

  return { isUncertain: false, reason: null, suggestedAction: null };
}

// ============================================
// CONFIDENCE GAPS CHECK
// Are any critical confidence factors too low?
// ============================================

function checkConfidenceGaps(confidence: ConfidenceResult): UncertaintyResult {
  // All factors below 30 = high uncertainty
  const factors = [
    { name: 'Engagement', value: confidence.engagement },
    { name: 'Champion', value: confidence.champion },
    { name: 'Authority', value: confidence.authority },
    { name: 'Need', value: confidence.need },
    { name: 'Timeline', value: confidence.timeline },
  ];

  const lowFactors = factors.filter(f => f.value < 30);

  if (lowFactors.length >= 3) {
    const factorNames = lowFactors.map(f => f.name).join(', ');
    return {
      isUncertain: true,
      reason: `Low confidence across multiple factors: ${factorNames}`,
      suggestedAction: 'Conduct discovery to validate deal fundamentals',
    };
  }

  // Specific critical gaps
  if (confidence.authority < 20 && confidence.champion < 20) {
    return {
      isUncertain: true,
      reason: 'No access to decision maker or internal champion',
      suggestedAction: 'Identify and engage the economic buyer or find internal advocate',
    };
  }

  return { isUncertain: false, reason: null, suggestedAction: null };
}

// ============================================
// NEW DEAL CHECK
// Is this deal too new to predict?
// ============================================

function checkNewDeal(deal: DealData): UncertaintyResult {
  const now = new Date();
  const createdAt = new Date(deal.created_at);
  const daysOld = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  // Very new deal with few activities
  if (daysOld < 3 && deal.activities.length < 2) {
    return {
      isUncertain: true,
      reason: 'Deal is new - insufficient history for accurate prediction',
      suggestedAction: 'Continue engagement to build prediction confidence',
    };
  }

  return { isUncertain: false, reason: null, suggestedAction: null };
}
