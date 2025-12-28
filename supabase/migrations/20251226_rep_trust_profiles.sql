-- ============================================
-- REP TRUST PROFILES TABLE
-- Phase 4: Learning System
-- ============================================

-- Clean up any existing partial state
DROP TRIGGER IF EXISTS update_trust_profile_updated_at ON rep_trust_profiles;
DROP TRIGGER IF EXISTS update_trigger_accuracy_updated_at ON trigger_accuracy;

DROP POLICY IF EXISTS "Users can view own trust profile" ON rep_trust_profiles;
DROP POLICY IF EXISTS "Service role can manage trust profiles" ON rep_trust_profiles;
DROP POLICY IF EXISTS "Managers can view all trust profiles" ON rep_trust_profiles;
DROP POLICY IF EXISTS "Service role can manage trigger accuracy" ON trigger_accuracy;
DROP POLICY IF EXISTS "Managers can view trigger accuracy" ON trigger_accuracy;

DROP TABLE IF EXISTS rep_trust_profiles CASCADE;
DROP TABLE IF EXISTS trigger_accuracy CASCADE;

-- Rep Trust Profiles
CREATE TABLE rep_trust_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,

  -- Moment interaction counts
  moments_received INTEGER DEFAULT 0,
  moments_completed INTEGER DEFAULT 0,
  moments_dismissed INTEGER DEFAULT 0,
  moments_ignored INTEGER DEFAULT 0,

  -- Outcome tracking
  completions_successful INTEGER DEFAULT 0,
  completions_unsuccessful INTEGER DEFAULT 0,

  -- Override tracking
  overrides_total INTEGER DEFAULT 0,
  overrides_correct INTEGER DEFAULT 0,

  -- Response time
  avg_response_time_hours NUMERIC,

  -- Trust score (0-100)
  trust_score INTEGER DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trust_user ON rep_trust_profiles(user_id);
CREATE INDEX idx_trust_score ON rep_trust_profiles(trust_score DESC);

-- Enable RLS
ALTER TABLE rep_trust_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own trust profile" ON rep_trust_profiles
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Managers can view all trust profiles" ON rep_trust_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Service role can manage trust profiles" ON rep_trust_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- TRIGGER ACCURACY TABLE
-- Track AI trigger calibration
-- ============================================

CREATE TABLE trigger_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT UNIQUE NOT NULL,

  -- Counts
  total_fired INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  total_successful INTEGER DEFAULT 0,
  total_dismissed INTEGER DEFAULT 0,

  -- Confidence tracking
  avg_confidence_successful NUMERIC DEFAULT 0,
  avg_confidence_unsuccessful NUMERIC DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_trigger_type ON trigger_accuracy(trigger_type);

-- Enable RLS
ALTER TABLE trigger_accuracy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view trigger accuracy" ON trigger_accuracy
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Service role can manage trigger accuracy" ON trigger_accuracy
  FOR ALL USING (auth.role() = 'service_role');

-- Triggers for updated_at
CREATE TRIGGER update_trust_profile_updated_at
  BEFORE UPDATE ON rep_trust_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trigger_accuracy_updated_at
  BEFORE UPDATE ON trigger_accuracy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
