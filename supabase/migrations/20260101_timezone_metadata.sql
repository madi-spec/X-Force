-- ============================================
-- Timezone Metadata for Bulletproof Scheduling
-- ============================================
-- This migration adds timezone metadata columns to store both UTC and local
-- representations of scheduled times, enabling accurate debugging and display.
--
-- The core principle: "Store UTC, but keep timezone metadata"
-- - selected_time remains TIMESTAMPTZ (stores UTC automatically)
-- - New columns store the local representation and source timezone
-- - This enables debugging "2pm becomes 6am" bugs by comparing values

-- Add timezone metadata to scheduling_requests
ALTER TABLE scheduling_requests
ADD COLUMN IF NOT EXISTS prospect_timezone TEXT,
ADD COLUMN IF NOT EXISTS selected_time_local TEXT,
ADD COLUMN IF NOT EXISTS selected_time_timezone TEXT;

-- Add comment explaining the columns
COMMENT ON COLUMN scheduling_requests.prospect_timezone IS
  'IANA timezone of the prospect (e.g., America/New_York). Used for interpreting their time references.';

COMMENT ON COLUMN scheduling_requests.selected_time_local IS
  'Local datetime string when meeting was confirmed (e.g., 2025-01-06T14:00:00). For debugging/display only.';

COMMENT ON COLUMN scheduling_requests.selected_time_timezone IS
  'Timezone the selected_time_local is expressed in. Should match prospect_timezone.';

-- Add timezone metadata to scheduling_actions for audit trail
ALTER TABLE scheduling_actions
ADD COLUMN IF NOT EXISTS timezone_context JSONB;

COMMENT ON COLUMN scheduling_actions.timezone_context IS
  'Timezone context at time of action. Stores {userTimezone, prospectTimezone, utc, local} for debugging.';

-- Create index for timezone lookups
CREATE INDEX IF NOT EXISTS idx_scheduling_requests_prospect_timezone
  ON scheduling_requests(prospect_timezone)
  WHERE prospect_timezone IS NOT NULL;

-- ============================================
-- Migration for existing data
-- ============================================
-- Set default prospect_timezone for existing requests that don't have one
UPDATE scheduling_requests
SET prospect_timezone = COALESCE(timezone, 'America/New_York')
WHERE prospect_timezone IS NULL
  AND timezone IS NOT NULL;

-- ============================================
-- Validation function
-- ============================================
-- Function to validate timezone values
CREATE OR REPLACE FUNCTION validate_timezone(tz TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if timezone is valid by trying to use it
  PERFORM now() AT TIME ZONE tz;
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraint to ensure valid timezone (commented out to allow migration to proceed)
-- In production, uncomment after ensuring all data has valid timezones
-- ALTER TABLE scheduling_requests
--   ADD CONSTRAINT chk_valid_prospect_timezone
--   CHECK (prospect_timezone IS NULL OR validate_timezone(prospect_timezone));
