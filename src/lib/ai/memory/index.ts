/**
 * Account Memory Module
 *
 * Provides institutional knowledge about accounts for AI personalization.
 */

export {
  getAccountMemory,
  formatMemoryForPrompt,
  formatMemoryForStructuredPrompt,
  getCommunicationGuidance,
  enhanceTalkingPoints,
  getAvoidList,
  type AccountMemoryContext,
} from './memoryInjection';

export {
  captureMeetingLearnings,
  capturePostmortemLearnings,
  applyMemorySuggestions,
  type MemorySuggestion,
  type MemoryCaptureResult,
} from './memoryCapture';
