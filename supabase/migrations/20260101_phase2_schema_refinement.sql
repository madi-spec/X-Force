-- Phase 2: Relationship Intelligence Schema Refinement
-- Adds missing columns for full context-first architecture

-- ============================================
-- ADD MISSING COLUMNS TO RELATIONSHIP_INTELLIGENCE
-- ============================================

-- AI-generated summary (separate from nested context)
ALTER TABLE relationship_intelligence
ADD COLUMN IF NOT EXISTS context_summary TEXT;

ALTER TABLE relationship_intelligence
ADD COLUMN IF NOT EXISTS context_summary_updated_at TIMESTAMPTZ;

-- Denormalized fields for faster queries
ALTER TABLE relationship_intelligence
ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

ALTER TABLE relationship_intelligence
ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0;

ALTER TABLE relationship_intelligence
ADD COLUMN IF NOT EXISTS health_score INTEGER;

-- Link to specific deal (for deal-level context)
ALTER TABLE relationship_intelligence
ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;

-- User ownership (which rep owns this relationship)
ALTER TABLE relationship_intelligence
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Salesperson additions (for Phase 4)
ALTER TABLE relationship_intelligence
ADD COLUMN IF NOT EXISTS salesperson_notes JSONB DEFAULT '[]';

ALTER TABLE relationship_intelligence
ADD COLUMN IF NOT EXISTS salesperson_corrections JSONB DEFAULT '[]';

-- ============================================
-- ADD PERFORMANCE INDEXES
-- ============================================

-- Index for deal-level queries
CREATE INDEX IF NOT EXISTS idx_ri_deal_id
ON relationship_intelligence(deal_id)
WHERE deal_id IS NOT NULL;

-- Index for user-level queries
CREATE INDEX IF NOT EXISTS idx_ri_user_id
ON relationship_intelligence(user_id)
WHERE user_id IS NOT NULL;

-- Index for recent interactions (for command center)
CREATE INDEX IF NOT EXISTS idx_ri_last_interaction
ON relationship_intelligence(last_interaction_at DESC NULLS LAST);

-- Index for health score (for prioritization)
CREATE INDEX IF NOT EXISTS idx_ri_health_score
ON relationship_intelligence(health_score DESC NULLS LAST);

-- Composite index for company + updated_at (common query pattern)
CREATE INDEX IF NOT EXISTS idx_ri_company_updated
ON relationship_intelligence(company_id, updated_at DESC);

-- Composite index for contact + updated_at
CREATE INDEX IF NOT EXISTS idx_ri_contact_updated
ON relationship_intelligence(contact_id, updated_at DESC);

-- GIN index for JSONB context queries
CREATE INDEX IF NOT EXISTS idx_ri_context_gin
ON relationship_intelligence USING GIN (context);

-- GIN index for signals queries (buying_signals, concerns, objections)
CREATE INDEX IF NOT EXISTS idx_ri_signals_gin
ON relationship_intelligence USING GIN (signals);

-- ============================================
-- UPDATE TRIGGER TO MAINTAIN DENORMALIZED FIELDS
-- ============================================

CREATE OR REPLACE FUNCTION update_ri_denormalized_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Update interaction_count from interactions array
  NEW.interaction_count := jsonb_array_length(COALESCE(NEW.interactions, '[]'::jsonb));

  -- Update last_interaction_at from most recent interaction
  SELECT MAX((elem->>'date')::timestamptz)
  INTO NEW.last_interaction_at
  FROM jsonb_array_elements(COALESCE(NEW.interactions, '[]'::jsonb)) AS elem;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ri_maintain_denormalized ON relationship_intelligence;
CREATE TRIGGER ri_maintain_denormalized
  BEFORE INSERT OR UPDATE OF interactions ON relationship_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_ri_denormalized_fields();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN relationship_intelligence.context_summary IS 'AI-generated one-paragraph summary of the relationship state';
COMMENT ON COLUMN relationship_intelligence.context_summary_updated_at IS 'When the context summary was last regenerated';
COMMENT ON COLUMN relationship_intelligence.last_interaction_at IS 'Denormalized: timestamp of most recent interaction';
COMMENT ON COLUMN relationship_intelligence.interaction_count IS 'Denormalized: count of interactions in the interactions array';
COMMENT ON COLUMN relationship_intelligence.health_score IS 'Computed relationship health score (0-100)';
COMMENT ON COLUMN relationship_intelligence.deal_id IS 'Optional link to specific deal for deal-level context';
COMMENT ON COLUMN relationship_intelligence.user_id IS 'Rep who owns this relationship';
COMMENT ON COLUMN relationship_intelligence.salesperson_notes IS 'Manual notes added by salesperson [{id, note, type, addedAt, addedBy}]';
COMMENT ON COLUMN relationship_intelligence.salesperson_corrections IS 'Corrections to AI-generated content [{id, field, original, corrected, reason, correctedAt}]';
