-- Add workflow steps support to command center items
-- This allows a single card to have multiple checklist items instead of
-- creating separate cards for each action from one interaction

-- Add workflow_steps column to store checklist items
-- Structure: [{ id, title, owner, urgency, completed, completed_at }]
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS workflow_steps JSONB DEFAULT NULL;

-- Add source tracking to prevent duplicates
-- source_hash = hash of (source_type + source_id + contact_id + communication_type)
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS source_hash VARCHAR(64);

-- Add email_id for direct reference to source email
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS email_id UUID REFERENCES email_messages(id) ON DELETE SET NULL;

-- Index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_command_center_source_hash
ON command_center_items(source_hash)
WHERE source_hash IS NOT NULL;

-- Index for finding items by email
CREATE INDEX IF NOT EXISTS idx_command_center_email_id
ON command_center_items(email_id)
WHERE email_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN command_center_items.workflow_steps IS
'Array of workflow steps/checklist items. Each step has: id, title, owner, urgency, completed, completed_at';

COMMENT ON COLUMN command_center_items.source_hash IS
'Hash for duplicate detection: hash(source_type + source_id + contact_id + communication_type)';
