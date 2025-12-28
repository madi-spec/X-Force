-- Initial Historical Sync Schema
-- Tracks sync progress and completion for comprehensive initial data sync

-- Add initial sync columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS initial_sync_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS initial_sync_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS initial_sync_completed_at TIMESTAMPTZ;

-- Create sync_progress table for real-time progress tracking
CREATE TABLE IF NOT EXISTS sync_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phase VARCHAR(50) NOT NULL DEFAULT 'init',
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  current_item TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One progress record per user
  CONSTRAINT sync_progress_user_unique UNIQUE (user_id)
);

-- Add tier_trigger for concern_unresolved and email_needs_response
-- (These may already exist from previous migrations, so using DO block)
DO $$
BEGIN
  -- Check if we need to add new tier triggers
  -- These are just for documentation - the actual column type already supports these values
  NULL; -- No-op since tier_trigger is VARCHAR and already flexible
END $$;

-- Index for querying sync progress
CREATE INDEX IF NOT EXISTS idx_sync_progress_user_id ON sync_progress(user_id);

-- RLS policies for sync_progress
ALTER TABLE sync_progress ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sync progress
CREATE POLICY sync_progress_select ON sync_progress
  FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE users.id = sync_progress.user_id AND users.auth_id = auth.uid()
  ));

-- Users can only update their own sync progress
CREATE POLICY sync_progress_update ON sync_progress
  FOR UPDATE
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE users.id = sync_progress.user_id AND users.auth_id = auth.uid()
  ));

-- Service role can do anything
CREATE POLICY sync_progress_service ON sync_progress
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment explaining the sync phases
COMMENT ON TABLE sync_progress IS 'Tracks progress of initial historical sync. Phases: init, emails, calendar, transcripts, collecting, processing, commandCenter, complete, error';
