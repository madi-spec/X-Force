/**
 * AI Scheduler Module
 *
 * Exports all scheduling-related functionality.
 */

// Types
export * from './types';

// Core modules (new architecture)
export * from './core/constants';
export * from './core/TimeParser';

// Processors (two-step analysis)
export * from './processors/IntentDetector';
export * from './processors/Escalation';

// Events (Work Integration)
export * from './events';

// Tagged Timestamps - Bulletproof timezone handling
export type { TaggedTimestamp, AIExtractedTime } from './taggedTimestamp';
export {
  createTaggedTimestamp,
  createTaggedFromUtc,
  createTaggedFromDate,
  formatTaggedForDisplay,
  formatTaggedForEmail,
  formatTaggedForGraphAPI,
  taggedTimestampsEqual,
  isTaggedInFuture,
  isTaggedInPast,
  addMinutesToTagged,
  getTaggedLocalHour,
  getTaggedLocalDayOfWeek,
  getTaggedLocalDate,
  parseAndTagTimestamp,
  logTaggedTimestamp,
  isValidTimezone,
} from './taggedTimestamp';

// Timestamp Validation
export type { ValidationResult, ValidationContext } from './timestampValidator';
export {
  validateProposedTime,
  validateProposedTimes,
  logTimestampConversion,
  detectMistreatedBareTimestamp,
  suggestCorrectInterpretation,
  isSlotStillValid,
  formatValidationError,
} from './timestampValidator';

// Services
export { SchedulingService, schedulingService, adminSchedulingService } from './schedulingService';

// Email Generation
export type { EmailType, ParsedSchedulingResponse } from './emailGeneration';
export {
  generateSchedulingEmail,
  generateEmailVariants,
  formatTimeSlotsForEmail,
  generateProposedTimes,
  parseSchedulingResponse,
  parseSchedulingResponseLegacy,
  generateMeetingPrepBrief,
} from './emailGeneration';

// Response Processing (Phase 2)
export {
  findMatchingSchedulingRequest,
  processSchedulingResponse,
  processSchedulingEmails,
  type IncomingEmail,
  type ProcessingResult,
  type ResponseAnalysis,
} from './responseProcessor';

// Calendar Integration
export type { TaggedAvailabilitySlot, MultiAttendeeAvailabilityResult, TaggedMultiAttendeeAvailabilityResult } from './calendarIntegration';
export {
  createMeetingCalendarEvent,
  createMeetingCalendarEventWithTagged,
  updateMeetingCalendarEvent,
  cancelMeetingCalendarEvent,
  getAvailableTimeSlots,
  getRealAvailableSlots,
  getTaggedAvailableSlots,
  getMultiAttendeeAvailability,
  getTaggedMultiAttendeeAvailability,
  verifyTaggedTimestamp,
  formatSlotsForPrompt,
  isUSHoliday,
} from './calendarIntegration';

// Confirmation Workflow (Phase 2)
export {
  executeConfirmationWorkflow,
  sendMeetingReminder,
  type ConfirmationInput,
  type ConfirmationResult,
} from './confirmationWorkflow';

// Automation Processor (Phase 2)
export {
  processSchedulingAutomation,
  handleNoShowRecovery,
  type ProcessingStats,
} from './automationProcessor';

// Channel Strategy (Phase 3)
export {
  initializeChannelProgression,
  shouldEscalateChannel,
  escalateChannel,
  recordChannelAttempt,
  shouldDeEscalateDuration,
  deEscalateDuration,
  sendSchedulingSmsToContact,
  DEFAULT_CHANNEL_PROGRESSION,
  MEETING_TYPE_PROGRESSIONS,
  DE_ESCALATION_RULES,
} from './channelStrategy';

// Persona Engine (Phase 3)
export {
  detectPersona,
  detectPersonaWithAI,
  getToneConfig,
  getToneForContext,
  generateTonePromptAdditions,
  adjustEmailForPersona,
  savePersonaToRequest,
  getOrDetectPersona,
  type ToneConfig,
  PERSONA_TONE_MAP,
} from './personaEngine';

// Meeting Strategy (Phase 3)
export {
  getMeetingStrategy,
  getAdjustedDuration,
  getRecommendedTone,
  getFollowUpInterval,
  isSmsAllowed,
  getChannelProgression,
  getDeEscalationTrigger,
  getStrategyRecommendation,
  MEETING_STRATEGIES,
  type SchedulingContext,
  type StrategyRecommendation,
} from './meetingStrategy';

// Scheduling Intelligence (Phase 4)
export {
  computeSchedulingIntelligence,
  type SchedulingSignal,
  type SchedulingSignalType,
  type SchedulingIntelligence,
  type SchedulingRisk,
  type SchedulingRecommendation,
  type DealSchedulingSignal,
} from './schedulingIntelligence';

// Reputation Guardrails (Phase 4)
export {
  checkCanContact,
  checkCompanyCanContact,
  recordContactEvent,
  blockContact,
  unblockContact,
  getContactFrequencyState,
  getFrequencyReport,
  DEFAULT_LIMITS,
  PERSONA_LIMITS,
  type ContactFrequencyLimits,
  type ContactFrequencyState,
  type GuardrailCheckResult,
  type ContactEvent,
} from './reputationGuardrails';

// Attendee Optimization (Phase 4)
export {
  analyzeAttendees,
  saveSuggestions,
  applySuggestion,
  rejectSuggestion,
  analyzeAllPendingRequests,
  MEETING_ATTENDEE_CONFIG,
  type SuggestionType,
  type AttendeeSuggestion,
  type AttendeeAnalysis,
} from './attendeeOptimization';

// Scheduling Leverage Moments (Phase 5)
export {
  checkSchedulingLeverageMoments,
  saveSchedulingLeverageMoment,
  checkAllSchedulingLeverageMoments,
  SCHEDULING_LEVERAGE_TRIGGERS,
  type SchedulingLeverageTrigger,
  type SchedulingLeverageConfig,
  type SchedulingLeverageMoment,
  type GeneratedBrief,
} from './schedulingLeverage';

// No-Show Recovery (Phase 5)
export {
  detectNoShows,
  processNoShow,
  processAllNoShows,
  markMeetingCompleted,
  markMeetingRescheduled,
  getNoShowFollowUpTemplate,
  type NoShowEvent,
  type RecoveryStrategy,
  type NoShowRecoveryResult,
} from './noShowRecovery';

// Scheduling Stop Rules (Phase 5)
export {
  checkSchedulingStopRules,
  getToneAdjustment,
  getRecommendedAction,
  SCHEDULING_STOP_RULES,
  type SchedulingStopCheck,
  type SuggestedAction,
  type SchedulingStopContext,
  type ToneAdjustment,
} from './schedulingStopRules';

// Social Proof (Phase 6)
export {
  getSocialProofForCompany,
  selectSocialProof,
  selectSocialProofForScheduling,
  recordSocialProofUsage,
  updateSocialProofOutcome,
  formatSocialProofForEmail,
  getSocialProofPerformance,
  type SocialProofItem,
  type SocialProofRelevance,
  type CompanyProfile,
  type SocialProofSelection,
} from './socialProof';

// Seasonality (Phase 6)
export {
  getSeasonalContext,
  getSchedulingAdjustments,
  shouldBeMorePatient,
  getOptimalSchedulingWindow,
  recordSeasonalOutcome,
  getSeasonalityReport,
  type SeasonalityPattern,
  type SeasonalContext,
  type SeasonalRecommendations,
} from './seasonality';

// Champion Involvement (Phase 6)
export {
  shouldInvolveChampion,
  recordChampionInvolvement,
  updateChampionOutcome,
  getChampionEffectivenessReport,
  type Champion,
  type ChampionInvolvement,
  type ChampionInvolvementType,
  type ChampionStrategy,
} from './championInvolvement';

// Postmortems (Phase 6)
export {
  createSchedulingPostmortem,
  getCompanySchedulingLearnings,
  getMeetingTypeLearnings,
  getSchedulingPerformanceReport,
  type SchedulingPostmortem,
  type PostmortemAnalysis,
} from './postmortem';

// Analytics (Phase 7)
export {
  getSchedulingFunnel,
  getChannelMetrics,
  getTimeSlotMetrics,
  getMeetingTypeMetrics,
  getRepMetrics,
  getSocialProofMetrics,
  getSeasonalMetrics,
  getAnalyticsSummary,
  type DateRange,
  type SchedulingFunnelMetrics,
  type ChannelMetrics,
  type TimeSlotMetrics,
  type MeetingTypeMetrics,
  type RepMetrics,
  type SocialProofMetrics,
  type SeasonalMetrics,
  type SchedulingAnalyticsSummary,
} from './analytics';

// Settings & Configuration (Phase 8)
export {
  getSchedulerSettings,
  updateSchedulerSettings,
  resetUserSettings,
  getEmailTemplates,
  getEmailTemplate,
  getEmailTemplateBySlug,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  getSeasonalityOverrides,
  getActiveSeasonality,
  createSeasonalityOverride,
  updateSeasonalityOverride,
  deleteSeasonalityOverride,
  getSocialProofLibrary,
  createSocialProofEntry,
  updateSocialProofEntry,
  deleteSocialProofEntry,
  type ChannelSettings,
  type GuardrailSettings,
  type MeetingDefaults,
  type EmailSettings,
  type AvailabilitySettings,
  type AutomationSettings,
  type SchedulerSettings,
  type EmailTemplate,
  type SeasonalityOverride,
  type SocialProofEntry,
} from './settingsService';

// Webhooks (Phase 9)
export {
  getWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  generateSecretKey,
  dispatchWebhookEvent,
  dispatchMeetingScheduled,
  dispatchRequestCreated,
  dispatchStatusChanged,
  testWebhook,
  getWebhookDeliveries,
  retryFailedDeliveries,
  verifyHmacSignature,
  type WebhookEventType,
  type WebhookConfig,
  type WebhookDelivery,
  type WebhookEventPayload,
} from './webhookService';

// API Keys (Phase 9)
export {
  getApiKeys,
  getApiKey,
  createApiKey,
  updateApiKey,
  revokeApiKey,
  deleteApiKey,
  validateApiKey,
  getApiKeyByHash,
  recordApiKeyUsage,
  getApiKeyUsage,
  getApiKeyStats,
  extractApiKey,
  validateRequest,
  type ApiKeyPermissions,
  type ApiKey,
  type ApiKeyWithSecret,
  type ApiKeyUsage,
  type RateLimitCheck,
  type CreateApiKeyInput,
} from './apiKeyService';

// Draft System (Robust Preview → Send Flow)
export {
  generateDraft,
  getDraft,
  updateDraft,
  getDraftForSending,
  markDraftSent,
  expireDraft,
  regenerateDraft,
  clearDraft,
} from './draftService';

// Draft Types
export type {
  DraftStatus,
  DraftProposedTime,
  SchedulingDraft,
  SchedulingRequestWithDraft,
} from './types';

export { DRAFT_STATUS } from './types';

// Jobs (Focused Cron Architecture)
export * from './jobs';

// Monitoring (Health Checks)
export * from './monitoring';
