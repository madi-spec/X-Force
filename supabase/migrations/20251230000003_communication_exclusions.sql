-- Add excluded_at field to communications table
-- Allows users to hide communications they don't want to see

ALTER TABLE communications
ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS excluded_by UUID REFERENCES auth.users(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS exclusion_reason TEXT DEFAULT NULL;

-- Add index for filtering excluded communications
CREATE INDEX IF NOT EXISTS idx_communications_excluded_at ON communications(excluded_at) WHERE excluded_at IS NULL;

-- Add comment
COMMENT ON COLUMN communications.excluded_at IS 'When the communication was excluded/hidden from view';
COMMENT ON COLUMN communications.excluded_by IS 'User who excluded this communication';
COMMENT ON COLUMN communications.exclusion_reason IS 'Optional reason for exclusion';
