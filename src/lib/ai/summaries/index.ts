/**
 * Summaries Engine
 * AI-powered entity summaries for X-FORCE
 */

// Types
export * from './types';

// Individual generators
export {
  generateDealSummary,
  getDealSummary,
  isDealSummaryStale,
} from './dealSummary';

export {
  generateCompanySummary,
  getCompanySummary,
  isCompanySummaryStale,
} from './companySummary';

export {
  generateContactSummary,
  getContactSummary,
  isContactSummaryStale,
} from './contactSummary';

// Main service
export {
  generateSummary,
  getSummary,
  isSummaryStale,
  getOrGenerateSummary,
  generateDealSummariesBatch,
  refreshStaleDealSummaries,
  generateCompanyRelatedSummaries,
  markDealSummariesStale,
  markCompanySummariesStale,
  markContactSummariesStale,
  markRelatedSummariesStale,
  getSummaryStats,
  cleanupOrphanedSummaries,
} from './summaryService';
