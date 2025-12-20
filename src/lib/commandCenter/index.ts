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
} from '@/types/commandCenter';
