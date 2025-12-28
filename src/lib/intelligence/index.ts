/**
 * Intelligence Module Exports
 */

// Types
export * from './types';

// ============================================
// NEW: Context-First Architecture (Phase 1)
// ============================================
// These are the preferred APIs for entity matching and communication processing

// Entity Matcher (Phase 1A) - AI-powered entity matching
export {
  intelligentEntityMatch,
  extractRawIdentifiers,
  findCandidateCompanies,
  findCandidateContacts,
  type CommunicationInput,
  type EntityMatchResult,
} from './entityMatcher';

// Context-First Pipeline (Phase 1B) - Full processing pipeline
export {
  processIncomingCommunication,
  buildFullRelationshipContext,
  analyzeWithFullContext,
  updateRelationshipIntelligence,
  determineActionsWithContext,
  type RelationshipContext,
  type PlaybookAnalysis,
  type ProcessingResult,
} from './contextFirstPipeline';

// Orchestrator (main entry point)
export {
  collectIntelligence,
  getCollectionProgress,
  getIntelligence,
  isIntelligenceStale,
} from './orchestrator';

// Synthesis
export {
  synthesizeIntelligence,
  saveIntelligence,
} from './synthesis/intelligenceSynthesis';

// Collectors (for direct use if needed)
export { websiteCollector } from './collectors/websiteCollector';
export { facebookCollector } from './collectors/facebookCollector';
export { googleReviewsCollector } from './collectors/googleReviewsCollector';
export { apolloCompanyCollector } from './collectors/apolloCompanyCollector';
export { apolloPeopleCollector } from './collectors/apolloPeopleCollector';
export { industryCollector } from './collectors/industryCollector';
export { marketingActivityCollector } from './collectors/marketingActivityCollector';
export { employeeMediaCollector } from './collectors/employeeMediaCollector';

// Enrichment services
export { enrichCompanyFromIntelligence, autoDetectCompanyDomain } from './enrichment/companyEnrichment';
export { enrichExistingContacts, enrichContact, enrichContactFromEmail } from './enrichment/contactEnrichment';

// Base collector for extensions
export { BaseCollector } from './collectors/base';
