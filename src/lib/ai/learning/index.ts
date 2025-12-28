/**
 * Learning Module
 *
 * Systems for learning from outcomes and improving over time.
 */

export {
  getRepTrustProfile,
  recordMomentReceived,
  recordMomentCompleted,
  recordMomentDismissed,
  recordMomentOutcome,
  recordMomentIgnored,
  getTrustRecommendations,
  getTrustLeaderboard,
  getCalibrationStats,
  recordTriggerFired,
  recordTriggerDismissed,
  type RepTrustProfile,
  type TrustUpdateResult,
} from './repTrustService';

export {
  aggregatePostmortemPatterns,
  getWinningPatterns,
  getLosingPatterns,
  getRelevantPatterns,
  getPatternRecommendations,
  type PatternLearning,
  type PatternInsight,
} from './patternLearning';
