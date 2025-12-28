/**
 * Economics Calculator
 *
 * Every decision is ACV-aware:
 * - Expected Value = ACV × Win Probability
 * - Max Human Hours = Expected Value / Rep Hourly Rate
 * - Investment Level determines automation vs human action
 */

import { DealData } from './dealIntelligenceEngine';
import { ConfidenceResult } from './confidenceCalculator';

export interface EconomicsResult {
  estimatedAcv: number;
  expectedValue: number;
  investmentLevel: 'high' | 'medium' | 'low' | 'minimal';
  maxHumanHours: number;
  costOfDelayPerWeek: number;
}

// Configuration
const BASE_ACV = 15000; // Default ACV for pest control
const REP_HOURLY_VALUE = 150; // What a rep's time is worth
const COST_OF_DELAY_RATE = 0.02; // 2% of ACV per week of delay

export function calculateEconomics(
  deal: DealData,
  confidence: ConfidenceResult
): EconomicsResult {
  // Calculate estimated ACV
  const estimatedAcv = calculateEstimatedAcv(deal);

  // Calculate win probability from confidence factors
  const avgConfidence = (
    confidence.engagement +
    confidence.champion +
    confidence.authority +
    confidence.need +
    confidence.timeline
  ) / 500; // Convert to 0-1 scale

  // Stage-based probability
  const stageProbabilities: Record<string, number> = {
    'prospecting': 0.10,
    'qualifying': 0.20,
    'discovery': 0.30,
    'demo': 0.45,
    'data_review': 0.55,
    'trial': 0.65,
    'negotiation': 0.80,
    'closed_won': 1.0,
    'closed_lost': 0,
  };

  const baseProbability = stageProbabilities[deal.stage] || 0.25;

  // Adjust probability based on confidence
  const adjustedProbability = baseProbability * (0.5 + avgConfidence);
  const winProbability = Math.min(0.95, Math.max(0.05, adjustedProbability));

  // Calculate expected value
  const expectedValue = estimatedAcv * winProbability;

  // Calculate max human hours
  const maxHumanHours = Math.round(expectedValue / REP_HOURLY_VALUE);

  // Determine investment level
  const investmentLevel = determineInvestmentLevel(expectedValue);

  // Cost of delay per week
  const costOfDelayPerWeek = estimatedAcv * COST_OF_DELAY_RATE;

  return {
    estimatedAcv,
    expectedValue: Math.round(expectedValue),
    investmentLevel,
    maxHumanHours,
    costOfDelayPerWeek: Math.round(costOfDelayPerWeek),
  };
}

// ============================================
// ACV ESTIMATION
// ============================================

function calculateEstimatedAcv(deal: DealData): number {
  // If amount is set, use it
  if (deal.amount && deal.amount > 0) {
    return deal.amount;
  }

  // If estimated_value is set, use it
  if (deal.estimated_value && deal.estimated_value > 0) {
    return deal.estimated_value;
  }

  // Otherwise, estimate based on company characteristics
  let acv = BASE_ACV;
  let multiplier = 1.0;

  const company = deal.company;
  if (company) {
    // Employee count multipliers
    if (company.employee_count) {
      if (company.employee_count > 100) {
        multiplier += 0.6;
      } else if (company.employee_count > 50) {
        multiplier += 0.3;
      } else if (company.employee_count > 20) {
        multiplier += 0.15;
      }
    }

    // Location count multipliers
    if (company.location_count) {
      if (company.location_count > 10) {
        multiplier += 0.5;
      } else if (company.location_count > 5) {
        multiplier += 0.3;
      } else if (company.location_count > 2) {
        multiplier += 0.15;
      }
    }

    // Ownership type multipliers
    switch (company.ownership_type) {
      case 'pe_backed':
        multiplier += 0.5; // PE companies often have bigger budgets
        break;
      case 'franchise':
        multiplier -= 0.2; // Franchises often have fixed budgets
        break;
      case 'family':
        // Neutral - varies widely
        break;
    }

    // PCT Top 100
    if (company.pct_top_100) {
      multiplier += 0.3; // Top companies = bigger deals
    }
  }

  // Product-based adjustments
  if (deal.products && deal.products.length > 0) {
    // More products = higher ACV
    multiplier += (deal.products.length - 1) * 0.1;
  }

  // Cap multiplier at 3x
  multiplier = Math.min(3.0, multiplier);

  return Math.round(acv * multiplier);
}

// ============================================
// INVESTMENT LEVEL DETERMINATION
// ============================================

function determineInvestmentLevel(
  expectedValue: number
): 'high' | 'medium' | 'low' | 'minimal' {
  // Investment levels based on expected value
  // Higher expected value = more human time warranted

  if (expectedValue >= 20000) {
    return 'high'; // Worth significant human investment
  } else if (expectedValue >= 10000) {
    return 'medium'; // Worth moderate human investment
  } else if (expectedValue >= 5000) {
    return 'low'; // Automation preferred, minimal human time
  } else {
    return 'minimal'; // Fully automated, human only for exceptions
  }
}

// ============================================
// HELPER: Get Investment Recommendations
// ============================================

export function getInvestmentRecommendations(
  investmentLevel: 'high' | 'medium' | 'low' | 'minimal'
): {
  maxCallsPerWeek: number;
  maxEmailsPerWeek: number;
  personalizeLevel: 'full' | 'partial' | 'template';
  humanEscalation: 'always' | 'flagged' | 'never';
} {
  switch (investmentLevel) {
    case 'high':
      return {
        maxCallsPerWeek: 3,
        maxEmailsPerWeek: 5,
        personalizeLevel: 'full',
        humanEscalation: 'always',
      };
    case 'medium':
      return {
        maxCallsPerWeek: 2,
        maxEmailsPerWeek: 3,
        personalizeLevel: 'full',
        humanEscalation: 'flagged',
      };
    case 'low':
      return {
        maxCallsPerWeek: 1,
        maxEmailsPerWeek: 2,
        personalizeLevel: 'partial',
        humanEscalation: 'flagged',
      };
    case 'minimal':
      return {
        maxCallsPerWeek: 0,
        maxEmailsPerWeek: 1,
        personalizeLevel: 'template',
        humanEscalation: 'never',
      };
  }
}
