/**
 * Communication Hub Sync
 *
 * Synchronizes emails and transcripts to the communications table.
 * Use these functions when new emails/transcripts are created.
 */

// Legacy sync from email_messages table (deprecated - use directGraphSync)
export {
  syncEmailToCommunication,
  syncRecentEmailsToCommunications,
} from './syncEmail';

// Direct Microsoft Graph sync (recommended - single source of truth)
export {
  syncEmailsDirectToCommunications,
  syncRecentEmailsDirectToCommunications,
  type DirectSyncResult,
  type DirectSyncOptions,
} from './directGraphSync';

export {
  syncTranscriptToCommunication,
  syncRecentTranscriptsToCommunications,
} from './syncTranscript';
