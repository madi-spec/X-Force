/**
 * Communication Hub Sync
 *
 * Synchronizes emails and transcripts to the communications table.
 * Use these functions when new emails/transcripts are created.
 */

export {
  syncEmailToCommunication,
  syncRecentEmailsToCommunications,
} from './syncEmail';

export {
  syncTranscriptToCommunication,
  syncRecentTranscriptsToCommunications,
} from './syncTranscript';
