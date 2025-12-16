/**
 * Intelligence Module Exports
 */

// Types
export * from './types';

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

// Base collector for extensions
export { BaseCollector } from './collectors/base';
