/**
 * Communication Hub
 *
 * Unified communication system that replaces fragmented pipelines.
 *
 * Core principle:
 * - Communications = FACTS (immutable events)
 * - Analysis = OPINIONS (versioned, replaceable)
 * - Prioritization = JUDGMENT (CC engine decides tier)
 */

export {
  emailToCommunication,
  syncEmailToCommunications,
  syncAllEmailsToCommunications,
} from './adapters/emailAdapter';

export {
  transcriptToCommunication,
  syncTranscriptToCommunications,
  syncAllTranscriptsToCommunications,
} from './adapters/transcriptAdapter';

// Analysis (Phase 2)
export {
  analyzeCommunication,
  analyzeAllPending,
} from './analysis/analyzeCommunication';

export {
  filterByConfidence,
  categorizeByConfidence,
  getConfidenceLabel,
  canTriggerAction,
} from './analysis/confidenceGating';

export {
  buildAnalysisPrompt,
  ANALYSIS_PROMPT_VERSION,
  PRODUCTS,
  COMMUNICATION_TYPES,
} from './analysis/prompts/v1';

// Live sync
export {
  syncEmailToCommunication,
  syncRecentEmailsToCommunications,
  syncTranscriptToCommunication,
  syncRecentTranscriptsToCommunications,
} from './sync';
