-- Fireflies.ai Integration Schema
-- Stores API keys and sync state for Fireflies meeting transcription sync

-- Fireflies connections table
CREATE TABLE fireflies_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Credentials (API key stored as plain text)
  api_key TEXT NOT NULL,

  -- Settings
  auto_analyze BOOLEAN NOT NULL DEFAULT true,
  auto_create_drafts BOOLEAN NOT NULL DEFAULT true,
  auto_create_tasks BOOLEAN NOT NULL DEFAULT true,

  -- Sync tracking
  last_sync_at TIMESTAMPTZ,
  last_sync_status VARCHAR(20), -- 'success', 'error', 'in_progress'
  last_sync_error TEXT,
  transcripts_synced INTEGER NOT NULL DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One connection per user
  UNIQUE(user_id)
);

-- Indexes for fireflies_connections
CREATE INDEX idx_fireflies_connections_user_id ON fireflies_connections(user_id);
CREATE INDEX idx_fireflies_connections_is_active ON fireflies_connections(is_active);

-- Updated_at trigger for fireflies_connections
CREATE OR REPLACE FUNCTION update_fireflies_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fireflies_connections_updated_at
  BEFORE UPDATE ON fireflies_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_fireflies_connections_updated_at();

-- RLS policies for fireflies_connections
ALTER TABLE fireflies_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own connection
CREATE POLICY fireflies_connections_select ON fireflies_connections
  FOR SELECT USING (user_id = get_current_user_id() OR is_admin());

-- Users can only insert their own connection
CREATE POLICY fireflies_connections_insert ON fireflies_connections
  FOR INSERT WITH CHECK (user_id = get_current_user_id());

-- Users can only update their own connection
CREATE POLICY fireflies_connections_update ON fireflies_connections
  FOR UPDATE USING (user_id = get_current_user_id());

-- Users can only delete their own connection
CREATE POLICY fireflies_connections_delete ON fireflies_connections
  FOR DELETE USING (user_id = get_current_user_id());

-- =============================================================================
-- Extend meeting_transcriptions table for external sources
-- =============================================================================

-- Add source field to track where transcription came from
ALTER TABLE meeting_transcriptions
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';

-- Add external_id for deduplication of synced transcripts
ALTER TABLE meeting_transcriptions
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);

-- Add external_metadata for source-specific data (e.g., Fireflies sentences, keywords)
ALTER TABLE meeting_transcriptions
  ADD COLUMN IF NOT EXISTS external_metadata JSONB;

-- Add match_confidence for auto-matched transcripts
ALTER TABLE meeting_transcriptions
  ADD COLUMN IF NOT EXISTS match_confidence DECIMAL(3,2);

-- Unique index on external_id to prevent duplicate syncs
CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_transcriptions_external_id
  ON meeting_transcriptions(external_id)
  WHERE external_id IS NOT NULL;

-- Index on source for filtering
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_source
  ON meeting_transcriptions(source);

-- Comment on new columns
COMMENT ON COLUMN meeting_transcriptions.source IS 'Source of transcription: manual, fireflies, zoom, teams, etc.';
COMMENT ON COLUMN meeting_transcriptions.external_id IS 'External system ID for deduplication (e.g., Fireflies transcript ID)';
COMMENT ON COLUMN meeting_transcriptions.external_metadata IS 'Source-specific metadata (e.g., Fireflies sentences with timestamps)';
COMMENT ON COLUMN meeting_transcriptions.match_confidence IS 'Confidence score (0-1) for auto-matched transcripts to deals';
