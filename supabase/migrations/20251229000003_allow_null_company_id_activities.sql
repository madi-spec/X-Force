-- Allow null company_id in activities table
-- This enables email sync to import emails from unknown senders/domains
-- that don't match any existing company record.

-- Remove the NOT NULL constraint from company_id
ALTER TABLE activities
ALTER COLUMN company_id DROP NOT NULL;

-- Add an index to help find unlinked activities that need company assignment
CREATE INDEX IF NOT EXISTS idx_activities_null_company
ON activities(user_id, occurred_at DESC)
WHERE company_id IS NULL;

-- Comment explaining the change
COMMENT ON COLUMN activities.company_id IS 'Company associated with this activity. NULL for unlinked activities (e.g., emails from unknown senders).';
