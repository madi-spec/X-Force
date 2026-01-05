-- ============================================
-- Account Intelligence Enhancements
-- Add new columns for recommendations, connection points, objection prep, etc.
-- ============================================

-- Add new JSONB columns for enhanced AI synthesis output
ALTER TABLE account_intelligence
  ADD COLUMN IF NOT EXISTS recommendations JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS connection_points JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS objection_prep JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signals_timeline JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS competitive_intel JSONB DEFAULT '{}'::jsonb;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_account_intelligence_recommendations
  ON account_intelligence USING gin (recommendations);

CREATE INDEX IF NOT EXISTS idx_account_intelligence_signals
  ON account_intelligence USING gin (signals_timeline);

-- Add comment for documentation
COMMENT ON COLUMN account_intelligence.recommendations IS 'Top 5 prioritized actionable recommendations for sales engagement';
COMMENT ON COLUMN account_intelligence.connection_points IS 'Shared interests, mutual connections, and common ground for rapport building';
COMMENT ON COLUMN account_intelligence.objection_prep IS 'Anticipated objections with prepared responses and evidence';
COMMENT ON COLUMN account_intelligence.signals_timeline IS 'Chronological list of significant company events and activities';
COMMENT ON COLUMN account_intelligence.competitive_intel IS 'Current providers, switching signals, and competitor mentions';
