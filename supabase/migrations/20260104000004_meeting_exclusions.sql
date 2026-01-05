-- Meeting Exclusions
-- Add ability to exclude meetings from the hub view (internal calls, spam invites, etc.)
-- Mirrors the communication_exclusions pattern

-- Add exclusion fields to activities table
ALTER TABLE activities ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS excluded_by UUID REFERENCES auth.users(id);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS exclusion_reason TEXT;

-- Index for efficient filtering of non-excluded activities
CREATE INDEX IF NOT EXISTS idx_activities_excluded_at
  ON activities(excluded_at) WHERE excluded_at IS NULL;

-- Index for looking up excluded activities (for "Show Excluded" toggle)
CREATE INDEX IF NOT EXISTS idx_activities_excluded_not_null
  ON activities(excluded_at) WHERE excluded_at IS NOT NULL;

-- Combined index for meeting queries with exclusion filter
CREATE INDEX IF NOT EXISTS idx_activities_meeting_exclusion
  ON activities(user_id, type, occurred_at, excluded_at)
  WHERE type = 'meeting';

COMMENT ON COLUMN activities.excluded_at IS 'Timestamp when the activity was excluded from views';
COMMENT ON COLUMN activities.excluded_by IS 'User who excluded this activity';
COMMENT ON COLUMN activities.exclusion_reason IS 'Optional reason for exclusion (e.g., "Internal meeting", "Spam invite")';
