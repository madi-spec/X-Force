-- ============================================
-- HUMAN LEVERAGE MOMENTS TABLE
-- Phase 2: Human Leverage MVP
-- ============================================

-- First ensure ai_jobs table exists (may already exist)
CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  input JSONB,
  output JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create human_leverage_moments table
CREATE TABLE IF NOT EXISTS human_leverage_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Classification
  type TEXT NOT NULL,
  urgency TEXT CHECK (urgency IN ('immediate', 'today', 'this_week', 'before_next_milestone')),
  required_role TEXT CHECK (required_role IN ('rep', 'sales_manager', 'exec', 'founder')),

  -- Confidence with bands
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  confidence_low INTEGER,
  confidence_high INTEGER,
  confidence_label TEXT,
  confidence_factors JSONB DEFAULT '[]',

  -- Trust basis
  trust_basis JSONB NOT NULL,

  -- The Brief
  situation TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  what_ai_did TEXT NOT NULL,
  what_human_must_do TEXT NOT NULL,
  why_human TEXT NOT NULL,
  talking_points JSONB DEFAULT '[]',
  data_points JSONB DEFAULT '[]',
  avoid JSONB DEFAULT '[]',
  success_criteria TEXT,
  if_unsuccessful TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed', 'dismissed')),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  dismissed_reason TEXT,

  -- Outcome
  outcome TEXT CHECK (outcome IN ('successful', 'unsuccessful', 'unknown')),
  outcome_notes TEXT,

  -- Generation
  generated_by_job_id UUID REFERENCES ai_jobs(id),
  trigger_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hlm_company ON human_leverage_moments(company_id);
CREATE INDEX IF NOT EXISTS idx_hlm_deal ON human_leverage_moments(deal_id);
CREATE INDEX IF NOT EXISTS idx_hlm_status ON human_leverage_moments(status);
CREATE INDEX IF NOT EXISTS idx_hlm_urgency ON human_leverage_moments(urgency);
CREATE INDEX IF NOT EXISTS idx_hlm_type ON human_leverage_moments(type);
CREATE INDEX IF NOT EXISTS idx_hlm_created ON human_leverage_moments(created_at DESC);

-- Rep trust profiles for learning
CREATE TABLE IF NOT EXISTS rep_trust_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  moments_received INTEGER DEFAULT 0,
  moments_completed INTEGER DEFAULT 0,
  moments_dismissed INTEGER DEFAULT 0,
  moments_ignored INTEGER DEFAULT 0,

  avg_response_time_hours NUMERIC,
  successful_outcomes INTEGER DEFAULT 0,
  unsuccessful_outcomes INTEGER DEFAULT 0,

  trust_score INTEGER DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE human_leverage_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_trust_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for leverage moments
CREATE POLICY "Users can view moments for their deals" ON human_leverage_moments
  FOR SELECT USING (
    deal_id IN (
      SELECT id FROM deals WHERE owner_id = (
        SELECT id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role can manage all moments" ON human_leverage_moments
  FOR ALL USING (auth.role() = 'service_role');

-- RLS for rep trust profiles
CREATE POLICY "Users can view own trust profile" ON rep_trust_profiles
  FOR SELECT USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Service role can manage trust profiles" ON rep_trust_profiles
  FOR ALL USING (auth.role() = 'service_role');
