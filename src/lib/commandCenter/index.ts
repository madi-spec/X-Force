/**
 * Command Center v3.1 "Momentum Engine"
 *
 * AI co-pilot that plans your entire day and tells you exactly
 * what to do with every available hour.
 */

// Daily Planning
export {
  getRepTimeProfile,
  calculateDailyCapacity,
  generateDailyPlan,
  getDailyPlan,
  refreshDailyPlan,
  getCurrentBlockIndex,
  getNextAvailableBlock,
} from './dailyPlanner';

// Momentum Scoring
export {
  calculateMomentumScore,
  scoreItems,
  getBasePriority,
  getTimePressure,
  getValueScore,
  getEngagementScore,
  getRiskScore,
} from './momentumScoring';

// Action Durations
export {
  ACTION_DURATIONS,
  getTypicalDuration,
  getDuration,
  estimateTotalDuration,
  canFitInTime,
  itemsThatFit,
} from './actionDurations';

// Item Generation
export {
  syncAllSources,
  syncEmailDrafts,
  syncMeetingPrep,
  syncMeetingFollowUps,
  syncStaleDeals,
  syncAISignals,
  createCommandCenterItem,
  updateItemScore,
  refreshAllScores,
  findDealForCompany,
  generateWhyNow,
} from './itemGenerator';

// Context Enrichment
export {
  gatherContext,
  enrichItem,
  enrichAndSaveItem,
  regenerateEmailDraft,
} from './contextEnrichment';

// Tier Detection (Priority Tiers System)
// NOTE: Tier detection now uses AI analysis + COMMUNICATION_TYPE_TIERS mapping
// classifyItem is the main API - it uses tier_trigger from AI analysis
export {
  classifyItem,
  classifyAllItems,
  sortTier1,
  sortTier2,
  sortTier3,
  sortTier4,
  COMMUNICATION_TYPE_TIERS,
  getTierForTrigger,
} from './tierDetection';

// Already Handled Detection
export {
  detectAlreadyHandled,
  batchDetectAlreadyHandled,
} from './alreadyHandledDetection';

// Action Reconciliation (syncs with Relationship Intelligence)
export {
  reconcileCompanyActions,
  syncActionCompletion,
  runBatchReconciliation,
} from './actionReconciliation';

// Re-export types for convenience
export type {
  ActionType,
  ItemStatus,
  ItemSource,
  TimeBlockType,
  CommandCenterItem,
  ScoreFactors,
  MomentumScore,
  TimeBlock,
  PlannedAction,
  DailyPlan,
  DailyCapacity,
  RepTimeProfile,
  GetDailyPlanResponse,
  UpdateItemRequest,
  CreateItemRequest,
  CommandCenterState,
  ActionTypeConfig,
  // Rich context types
  AvailableAction,
  SourceLink,
  PrimaryContact,
  EmailDraft,
  ScheduleSuggestions,
  MeetingAttendee,
  MeetingPrepContent,
  PrepMaterial,
  MeetingWithPrep,
  EnrichedCommandCenterItem,
  // Priority Tiers types
  PriorityTier,
  TierTrigger,
  TierSlaStatus,
  TierConfig,
} from '@/types/commandCenter';

// Re-export tier configs
export { TIER_CONFIGS } from '@/types/commandCenter';
