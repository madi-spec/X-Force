-- ============================================
-- DEAL POSTMORTEMS TABLE
-- Phase 4: Learning System
-- ============================================

-- Clean up any existing partial state
DROP TRIGGER IF EXISTS update_postmortem_updated_at ON deal_postmortems;
DROP TRIGGER IF EXISTS update_patterns_updated_at ON pattern_learnings;

DROP POLICY IF EXISTS "Users can view postmortems for their deals" ON deal_postmortems;
DROP POLICY IF EXISTS "Users can create postmortems for their deals" ON deal_postmortems;
DROP POLICY IF EXISTS "Users can update their own postmortems" ON deal_postmortems;
DROP POLICY IF EXISTS "Service role can manage all postmortems" ON deal_postmortems;
DROP POLICY IF EXISTS "All authenticated users can view patterns" ON pattern_learnings;
DROP POLICY IF EXISTS "Service role can manage patterns" ON pattern_learnings;

DROP INDEX IF EXISTS idx_postmortem_deal;
DROP INDEX IF EXISTS idx_postmortem_outcome;
DROP INDEX IF EXISTS idx_postmortem_created;
DROP INDEX IF EXISTS idx_patterns_type;
DROP INDEX IF EXISTS idx_patterns_success;

DROP TABLE IF EXISTS deal_postmortems CASCADE;
DROP TABLE IF EXISTS pattern_learnings CASCADE;

-- Win/Loss Postmortems
CREATE TABLE deal_postmortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE UNIQUE,

  -- Outcome
  outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost')),
  primary_reason TEXT NOT NULL,

  -- What worked / didn't work
  what_worked TEXT[] DEFAULT '{}',
  what_didnt_work TEXT[] DEFAULT '{}',

  -- Competitor info (for losses)
  competitor_info JSONB, -- { name, why_they_won, price_difference, feature_gaps }

  -- Learnings
  key_learnings TEXT[] DEFAULT '{}',
  recommended_changes TEXT[] DEFAULT '{}',

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_postmortem_deal ON deal_postmortems(deal_id);
CREATE INDEX IF NOT EXISTS idx_postmortem_outcome ON deal_postmortems(outcome);
CREATE INDEX IF NOT EXISTS idx_postmortem_created ON deal_postmortems(created_at DESC);

-- Enable RLS
ALTER TABLE deal_postmortems ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view postmortems for their deals" ON deal_postmortems
  FOR SELECT USING (
    deal_id IN (
      SELECT id FROM deals WHERE owner_id = (
        SELECT id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create postmortems for their deals" ON deal_postmortems
  FOR INSERT WITH CHECK (
    deal_id IN (
      SELECT id FROM deals WHERE owner_id = (
        SELECT id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own postmortems" ON deal_postmortems
  FOR UPDATE USING (
    created_by = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Service role can manage all postmortems" ON deal_postmortems
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- PATTERN LEARNINGS TABLE
-- Aggregated patterns from successful/unsuccessful approaches
-- ============================================

CREATE TABLE pattern_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Pattern classification
  pattern_type TEXT NOT NULL, -- 'approach', 'objection_response', 'timing', 'pricing', 'competitor'
  pattern_name TEXT NOT NULL,
  pattern_description TEXT,

  -- Statistics
  times_successful INTEGER DEFAULT 0,
  times_unsuccessful INTEGER DEFAULT 0,
  success_rate NUMERIC,

  -- Context
  applicable_segments TEXT[] DEFAULT '{}', -- ['smb', 'mid_market', 'enterprise']
  applicable_stages TEXT[] DEFAULT '{}', -- ['discovery', 'demo', 'negotiation']
  applicable_deal_types TEXT[] DEFAULT '{}',

  -- Examples
  example_deals UUID[] DEFAULT '{}',
  example_quotes JSONB DEFAULT '[]',

  -- Confidence
  confidence INTEGER DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  sample_size INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patterns_type ON pattern_learnings(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_success ON pattern_learnings(success_rate DESC);

-- Enable RLS
ALTER TABLE pattern_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view patterns" ON pattern_learnings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage patterns" ON pattern_learnings
  FOR ALL USING (auth.role() = 'service_role');

-- Triggers for updated_at
CREATE TRIGGER update_postmortem_updated_at
  BEFORE UPDATE ON deal_postmortems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patterns_updated_at
  BEFORE UPDATE ON pattern_learnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
