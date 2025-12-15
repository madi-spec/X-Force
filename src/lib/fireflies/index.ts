/**
 * Fireflies.ai Integration
 *
 * This module provides integration with Fireflies.ai for automatic
 * meeting transcription syncing and AI analysis.
 */

export { FirefliesClient } from './client';
export type {
  FirefliesTranscript,
  FirefliesTranscriptListItem,
  FirefliesUser,
  FirefliesSentence,
} from './client';

export {
  syncFirefliesTranscripts,
  connectFireflies,
  disconnectFireflies,
  getFirefliesConnectionStatus,
  updateFirefliesSettings,
} from './sync';
export type { SyncResult, FirefliesConnection } from './sync';
