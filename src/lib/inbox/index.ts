/**
 * Inbox Module
 *
 * Bidirectional email inbox with conversation-centric approach
 */

// Core Service
export {
  setupOutlookFolders,
  getOutlookFolders,
  performInitialSync,
  getConversations,
  getConversation,
  getActionQueueCounts,
  type ConversationStatus,
  type LinkMethod,
  type SlaStatus,
  type EmailConversation,
  type EmailMessage,
  type SyncResult,
} from './inboxService';

// Actions
export {
  archiveConversation,
  unarchiveConversation,
  snoozeConversation,
  unsnoozeConversation,
  linkConversation,
  unlinkConversation,
  ignoreConversation,
  updatePriority,
  undoAction,
  bulkArchive,
  bulkSnooze,
  bulkLink,
  type ActionResult,
  type SnoozeOptions,
  type LinkOptions,
} from './actionsService';

// SLA & Velocity
export {
  setResponseSla,
  clearSla,
  checkSlaStatuses,
  getOverdueConversations,
  getWarningConversations,
  wakeupSnoozedConversations,
  updateContactPattern,
  getContactPattern,
  type SlaRule,
  type SlaCheckResult,
} from './slaService';

// AI Analysis
export {
  analyzeConversation,
  generateDraftResponse,
  getPendingDrafts,
  updateDraftStatus,
  queueConversationAnalysis,
  type EmailSignals,
  type ThreadAnalysis,
  type DraftResponse,
} from './aiAnalysis';

// Scheduling Bridge
export {
  detectSchedulingIntent,
  createSchedulingFromConversation,
  linkConversationToScheduling,
  getSchedulingSuggestions,
  processMessageForScheduling,
} from './schedulingBridge';
