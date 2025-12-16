-- ============================================
-- Activity Entity Matching Enhancement
-- Adds fields for AI-powered deal matching
-- ============================================

-- Add match status enum
DO $$ BEGIN
  CREATE TYPE activity_match_status AS ENUM (
    'pending',        -- Not yet processed for matching
    'matched',        -- Successfully matched to deal
    'excluded',       -- Marked as not relevant to deals
    'review_needed',  -- Needs human review
    'unmatched'       -- Could not be matched
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add matching fields to activities table
ALTER TABLE activities ADD COLUMN IF NOT EXISTS match_status activity_match_status DEFAULT 'pending';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS match_confidence DECIMAL(3,2);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS match_reasoning TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS exclude_reason TEXT;

-- Add index for filtering by match status
CREATE INDEX IF NOT EXISTS idx_activities_match_status ON activities(match_status);

-- Add index for finding unmatched PST activities
CREATE INDEX IF NOT EXISTS idx_activities_pst_pending ON activities(match_status)
  WHERE external_id LIKE 'pst_%' AND match_status = 'pending';

-- Comment on columns
COMMENT ON COLUMN activities.match_status IS 'AI matching status: pending, matched, excluded, review_needed, unmatched';
COMMENT ON COLUMN activities.match_confidence IS 'AI confidence score 0.00-1.00 for the match';
COMMENT ON COLUMN activities.match_reasoning IS 'AI explanation of why this match was made or why review is needed';
COMMENT ON COLUMN activities.matched_at IS 'When the activity was matched to a deal';
COMMENT ON COLUMN activities.exclude_reason IS 'Reason for exclusion (e.g., newsletter, automated notification)';
