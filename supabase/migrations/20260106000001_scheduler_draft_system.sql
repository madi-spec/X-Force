-- Scheduler Draft System Migration
-- Stores draft email content in database to prevent regeneration issues

-- Add draft columns to scheduling_requests
ALTER TABLE scheduling_requests
ADD COLUMN IF NOT EXISTS draft_email_subject TEXT,
ADD COLUMN IF NOT EXISTS draft_email_body TEXT,
ADD COLUMN IF NOT EXISTS draft_proposed_times JSONB,
ADD COLUMN IF NOT EXISTS draft_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS draft_edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS draft_status TEXT DEFAULT 'none';

-- Add comments for documentation
COMMENT ON COLUMN scheduling_requests.draft_email_subject IS 'The email subject shown to user in preview';
COMMENT ON COLUMN scheduling_requests.draft_email_body IS 'The email body shown to user in preview (may be edited)';
COMMENT ON COLUMN scheduling_requests.draft_proposed_times IS 'JSON array of proposed times with timezone info';
COMMENT ON COLUMN scheduling_requests.draft_generated_at IS 'When the draft was first generated';
COMMENT ON COLUMN scheduling_requests.draft_edited_at IS 'When the user last edited the draft';
COMMENT ON COLUMN scheduling_requests.draft_status IS 'none | pending_review | approved | sent | expired';

-- Add index for querying pending drafts
CREATE INDEX IF NOT EXISTS idx_scheduling_requests_draft_status
ON scheduling_requests(draft_status)
WHERE draft_status IS NOT NULL AND draft_status != 'none';

-- Add constraint for valid draft statuses (use DO block to handle existing constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_draft_status'
  ) THEN
    ALTER TABLE scheduling_requests
    ADD CONSTRAINT valid_draft_status
    CHECK (draft_status IN ('none', 'pending_review', 'approved', 'sent', 'expired'));
  END IF;
END $$;
