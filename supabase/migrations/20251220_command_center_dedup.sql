-- Command Center v3.1b: Deduplication Constraint
-- Prevents duplicate items from the same source

-- Create unique partial index on (user_id, source, source_id) for pending items
-- This allows:
-- - Multiple items from same source with different source_id
-- - Completed/dismissed items to not conflict with new pending items
-- - Items without source_id (NULL) to be created freely

CREATE UNIQUE INDEX IF NOT EXISTS idx_cci_source_unique
  ON command_center_items(user_id, source, source_id)
  WHERE source_id IS NOT NULL AND status = 'pending';

-- Add risk_score column if it doesn't exist (was in score_factors but needs explicit column)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'command_center_items' AND column_name = 'risk_score'
  ) THEN
    ALTER TABLE command_center_items ADD COLUMN risk_score INTEGER DEFAULT 0;
  END IF;
END $$;
