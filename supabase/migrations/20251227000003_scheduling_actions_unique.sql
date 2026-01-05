-- Add unique constraint on scheduling_actions to prevent duplicate processing
-- This enables INSERT-based atomic locking for webhook deduplication

-- First, clean up any existing duplicates (keep the first one)
DELETE FROM scheduling_actions a
USING scheduling_actions b
WHERE a.id > b.id
  AND a.scheduling_request_id = b.scheduling_request_id
  AND a.email_id = b.email_id
  AND a.email_id IS NOT NULL;

-- Add unique constraint on (scheduling_request_id, email_id) where email_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS scheduling_actions_request_email_unique
ON scheduling_actions (scheduling_request_id, email_id)
WHERE email_id IS NOT NULL;
