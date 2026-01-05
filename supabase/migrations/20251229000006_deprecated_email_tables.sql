-- =============================================================================
-- Deprecation Notices for Consolidated Email Tables
-- =============================================================================
-- These tables are marked as DEPRECATED as part of the consolidation effort.
-- Email sync now goes directly to the 'communications' table via:
--   - syncEmailsDirectToCommunications() from lib/communicationHub
--   - /api/cron/sync-microsoft
--
-- DO NOT use these tables for new development. They will be dropped in a future
-- migration after verification that no data is lost.
--
-- Replacement:
--   email_conversations → communications (thread_id groups conversations)
--   email_messages      → communications (external_id links to source)
--   outlook_folders     → No longer needed (sync goes to communications directly)
--
-- See: docs/CONSOLIDATION_PLAN.md for full migration details
-- =============================================================================

-- Mark email_conversations as deprecated
COMMENT ON TABLE email_conversations IS
  '@deprecated - Use communications table instead. See CONSOLIDATION_PLAN.md';

-- Mark email_messages as deprecated
COMMENT ON TABLE email_messages IS
  '@deprecated - Use communications table instead. See CONSOLIDATION_PLAN.md';

-- Mark outlook_folders as deprecated (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'outlook_folders') THEN
    EXECUTE 'COMMENT ON TABLE outlook_folders IS ''@deprecated - No longer needed. Email sync goes directly to communications table. See CONSOLIDATION_PLAN.md''';
  END IF;
END $$;

-- Add note to activities table about email deprecation
COMMENT ON TABLE activities IS
  'Activity log for meetings, calls, and other events. Note: Email activities are deprecated - emails now go to communications table.';
