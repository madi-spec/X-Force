-- Pipeline Tracking Columns
-- Adds columns to track which records have been processed by Command Center pipelines

-- ============================================
-- MEETING TRANSCRIPTIONS
-- ============================================
-- Track if we've created CC items from this transcript's analysis

ALTER TABLE meeting_transcriptions
ADD COLUMN IF NOT EXISTS cc_items_created BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cc_processed_at TIMESTAMPTZ;

COMMENT ON COLUMN meeting_transcriptions.cc_items_created IS 'Whether command center items have been created from this transcripts analysis';
COMMENT ON COLUMN meeting_transcriptions.cc_processed_at IS 'When the transcript was processed for command center items';

CREATE INDEX IF NOT EXISTS idx_transcriptions_cc_pending
ON meeting_transcriptions(user_id, analysis_generated_at DESC)
WHERE cc_items_created = FALSE AND analysis IS NOT NULL;

-- ============================================
-- EMAIL MESSAGES
-- ============================================
-- Track if we've scanned this message for Tier 1 triggers

ALTER TABLE email_messages
ADD COLUMN IF NOT EXISTS processed_for_cc BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cc_processed_at TIMESTAMPTZ;

COMMENT ON COLUMN email_messages.processed_for_cc IS 'Whether this message has been scanned for command center tier detection';
COMMENT ON COLUMN email_messages.cc_processed_at IS 'When the message was processed for command center';

CREATE INDEX IF NOT EXISTS idx_messages_cc_pending
ON email_messages(user_id, received_at DESC)
WHERE processed_for_cc = FALSE AND is_sent_by_user = FALSE;

-- ============================================
-- MEETING PREP
-- ============================================
-- Track follow-up status and external attendees

ALTER TABLE meeting_prep
ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS has_external_attendees BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN meeting_prep.follow_up_sent IS 'Whether a follow-up email has been sent after this meeting';
COMMENT ON COLUMN meeting_prep.follow_up_sent_at IS 'When the follow-up was sent';
COMMENT ON COLUMN meeting_prep.has_external_attendees IS 'Whether this meeting has external (non-company) attendees';

CREATE INDEX IF NOT EXISTS idx_meeting_prep_follow_up_pending
ON meeting_prep(user_id, end_time DESC)
WHERE follow_up_sent = FALSE AND has_external_attendees = TRUE;

-- ============================================
-- COMMAND CENTER ITEMS
-- ============================================
-- Add transcription_id for linking transcript-based items

ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS transcription_id UUID REFERENCES meeting_transcriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cci_transcription
ON command_center_items(transcription_id)
WHERE transcription_id IS NOT NULL;

-- ============================================
-- DEALS - Additional Pipeline Fields
-- ============================================
-- These support tier detection pipelines

ALTER TABLE deals
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

COMMENT ON COLUMN deals.last_activity_at IS 'Timestamp of most recent activity on this deal';

-- Update last_activity_at based on existing data
UPDATE deals d
SET last_activity_at = GREATEST(
  d.updated_at,
  COALESCE((SELECT MAX(created_at) FROM activities WHERE deal_id = d.id), d.created_at),
  COALESCE((SELECT MAX(last_message_at) FROM email_conversations WHERE deal_id = d.id), d.created_at)
)
WHERE last_activity_at IS NULL;

-- Index for stale deal detection
CREATE INDEX IF NOT EXISTS idx_deals_last_activity
ON deals(last_activity_at DESC)
WHERE stage NOT IN ('closed_won', 'closed_lost');

-- ============================================
-- HELPER FUNCTION: Detect External Attendees
-- ============================================

CREATE OR REPLACE FUNCTION detect_external_attendees(
  attendees JSONB,
  user_email TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  attendee JSONB;
  email TEXT;
  user_domain TEXT;
BEGIN
  -- Extract user's domain
  user_domain := SPLIT_PART(user_email, '@', 2);

  -- Check each attendee
  FOR attendee IN SELECT * FROM jsonb_array_elements(attendees)
  LOOP
    email := attendee->>'email';
    IF email IS NOT NULL AND SPLIT_PART(email, '@', 2) != user_domain THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

