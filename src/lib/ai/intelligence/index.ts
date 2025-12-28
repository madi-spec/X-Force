/**
 * Deal Intelligence Module
 *
 * Exports all intelligence computation functionality
 */

export {
  computeDealIntelligence,
  type DealData,
  type DealIntelligence,
  type MomentumSignal,
  type RiskFactor,
  type NextAction,
} from './dealIntelligenceEngine';

export {
  calculateMomentum,
  type MomentumResult,
} from './momentumCalculator';

export {
  calculateConfidence,
  type ConfidenceResult,
} from './confidenceCalculator';

export {
  calculateEconomics,
  getInvestmentRecommendations,
  type EconomicsResult,
} from './economicsCalculator';

export {
  checkUncertainty,
  type UncertaintyResult,
} from './uncertaintyChecker';

// Scheduling Integration (Phase 4)
export {
  getDealSchedulingContext,
  applySchedulingAdjustments,
  getBatchDealSchedulingContext,
  interpretSchedulingSignals,
  getSchedulingHealthSummary,
  type SchedulingConfidenceAdjustment,
  type DealSchedulingContext,
} from './schedulingIntegration';
