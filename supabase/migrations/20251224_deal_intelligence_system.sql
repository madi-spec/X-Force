-- X-FORCE Phase 1: Deal Intelligence System
-- Creates tables for deal intelligence, AI infrastructure, and learning system

-- ============================================
-- DEAL INTELLIGENCE TABLE
-- Computed deal state (replaces simple health scores)
-- ============================================

CREATE TABLE IF NOT EXISTS deal_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE UNIQUE,

  -- Stage & Time
  stage TEXT NOT NULL,
  days_in_stage INTEGER DEFAULT 0,
  total_days INTEGER DEFAULT 0,

  -- Momentum
  momentum TEXT CHECK (momentum IN ('accelerating', 'stable', 'stalling', 'dead')),
  momentum_score INTEGER DEFAULT 0, -- -100 to +100
  momentum_signals JSONB DEFAULT '[]',

  -- Confidence Factors (MEDDIC-aligned, 0-100 each)
  confidence_engagement INTEGER DEFAULT 0,
  confidence_champion INTEGER DEFAULT 0,
  confidence_authority INTEGER DEFAULT 0,
  confidence_need INTEGER DEFAULT 0,
  confidence_timeline INTEGER DEFAULT 0,

  -- Win Probability with confidence bands
  win_probability INTEGER DEFAULT 25,
  win_probability_low INTEGER,
  win_probability_high INTEGER,
  win_probability_trend TEXT CHECK (win_probability_trend IN ('up', 'down', 'stable')),
  probability_factors JSONB DEFAULT '[]', -- What's driving uncertainty

  -- Uncertainty state
  is_uncertain BOOLEAN DEFAULT false,
  uncertainty_reason TEXT,
  uncertainty_suggested_action TEXT,

  -- Economics
  estimated_acv NUMERIC,
  expected_value NUMERIC,
  investment_level TEXT CHECK (investment_level IN ('high', 'medium', 'low', 'minimal')),
  max_human_hours NUMERIC,
  human_hours_spent NUMERIC DEFAULT 0,
  cost_of_delay_per_week NUMERIC,

  -- Risk
  risk_factors JSONB DEFAULT '[]',
  stall_reasons JSONB DEFAULT '[]',

  -- Next actions
  next_actions JSONB DEFAULT '[]',

  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for deal_intelligence
CREATE INDEX IF NOT EXISTS idx_deal_intelligence_deal ON deal_intelligence(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_intelligence_momentum ON deal_intelligence(momentum);
CREATE INDEX IF NOT EXISTS idx_deal_intelligence_investment ON deal_intelligence(investment_level);

-- Comments
COMMENT ON TABLE deal_intelligence IS 'Computed deal state with momentum, confidence, and economics';
COMMENT ON COLUMN deal_intelligence.momentum IS 'accelerating | stable | stalling | dead';
COMMENT ON COLUMN deal_intelligence.momentum_score IS 'Score from -100 to +100';
COMMENT ON COLUMN deal_intelligence.investment_level IS 'high | medium | low | minimal - based on expected value';

-- ============================================
-- AI ROLES TABLE
-- Categories of AI agents
-- ============================================

CREATE TABLE IF NOT EXISTS ai_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  persona TEXT, -- Personality/approach for this role
  icon TEXT,
  category TEXT CHECK (category IN ('research', 'sales', 'admin', 'analysis')),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default roles
INSERT INTO ai_roles (name, slug, description, persona, icon, category, display_order) VALUES
  ('Research Analyst', 'research-analyst', 'Deep company and contact research', 'Thorough, data-driven researcher who finds comprehensive intelligence', 'Search', 'research', 1),
  ('Sales Assistant', 'sales-assistant', 'Meeting analysis, email handling, CRM updates', 'Efficient assistant focused on keeping sales reps informed', 'Bot', 'admin', 2),
  ('Deal Analyst', 'deal-analyst', 'Opportunity/threat analysis, postmortems', 'Strategic analyst who identifies risks and opportunities', 'TrendingUp', 'analysis', 3),
  ('Sales Strategist', 'sales-strategist', 'Account strategy, meeting prep, leverage briefs', 'Senior strategist who crafts winning approaches', 'Target', 'sales', 4),
  ('SDR', 'sdr', 'Cold outreach, follow-ups', 'Persistent and personalized outreach specialist', 'Mail', 'sales', 5)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- AI JOBS TABLE
-- Editable prompts for AI agents
-- ============================================

CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES ai_roles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,

  -- The prompt (editable in app)
  prompt_template TEXT NOT NULL,
  system_prompt TEXT,

  -- Output configuration
  response_schema JSONB,
  response_format TEXT DEFAULT 'json' CHECK (response_format IN ('json', 'markdown', 'text')),

  -- Execution configuration
  model TEXT DEFAULT 'claude-sonnet-4-20250514',
  max_tokens INTEGER DEFAULT 4000,
  temperature NUMERIC DEFAULT 0,

  -- Variables
  available_variables TEXT[], -- What can be injected
  required_variables TEXT[], -- What must be present
  computed_context_required TEXT[], -- ['dealIntelligence', 'economicContext', 'accountMemory', 'triggerData', 'trustBasis']

  -- Triggers
  trigger_type TEXT DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'auto', 'scheduled', 'computed_trigger')),
  trigger_config JSONB, -- { event: 'transcript.created' } or { cron: '0 8 * * *' }

  -- Context sources
  context_sources TEXT[], -- ['company', 'contacts', 'deal', 'activities', 'research', 'transcript']

  -- UI placement
  button_label TEXT,
  icon TEXT,
  show_in_company_card BOOLEAN DEFAULT false,
  show_in_contact_card BOOLEAN DEFAULT false,
  show_in_deal_card BOOLEAN DEFAULT false,
  show_in_inbox BOOLEAN DEFAULT false,

  -- Classification
  job_category TEXT DEFAULT 'general' CHECK (job_category IN ('general', 'leverage_brief', 'memory_update', 'deal_analysis', 'transcript', 'email')),

  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(role_id, slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_jobs_role ON ai_jobs(role_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_trigger ON ai_jobs(trigger_type);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_category ON ai_jobs(job_category);

-- ============================================
-- AI JOB RUNS TABLE
-- Execution history
-- ============================================

CREATE TABLE IF NOT EXISTS ai_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ai_jobs(id),

  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  deal_id UUID REFERENCES deals(id),

  input_context JSONB,
  output JSONB,
  output_raw TEXT,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,

  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  tokens_used INTEGER,

  triggered_by UUID REFERENCES users(id),
  trigger_type TEXT,
  trigger_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_job_runs_job ON ai_job_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_job_runs_company ON ai_job_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_job_runs_deal ON ai_job_runs(deal_id);
CREATE INDEX IF NOT EXISTS idx_ai_job_runs_status ON ai_job_runs(status);

-- ============================================
-- COMPUTED TRIGGER JOBS TABLE
-- Map computed triggers to jobs
-- ============================================

CREATE TABLE IF NOT EXISTS computed_trigger_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL, -- 'relationship_repair', 'exec_intro', 'competitive_threat'
  job_id UUID REFERENCES ai_jobs(id) ON DELETE CASCADE,
  min_confidence INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ACCOUNT MEMORY TABLE
-- What we've learned about each account
-- ============================================

CREATE TABLE IF NOT EXISTS account_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,

  -- What works
  resonates JSONB DEFAULT '[]', -- ["growth story", "tech modernization", "competitor displacement"]
  effective_angles JSONB DEFAULT '[]',

  -- What doesn't work
  avoided JSONB DEFAULT '[]', -- ["cost savings framing", "cold ROI numbers"]
  failed_approaches JSONB DEFAULT '[]',

  -- Communication preferences
  preferred_channel TEXT CHECK (preferred_channel IN ('phone', 'email', 'linkedin', 'video')),
  response_pattern TEXT CHECK (response_pattern IN ('quick', 'deliberate', 'sporadic')),
  formality_level TEXT CHECK (formality_level IN ('formal', 'casual', 'mixed')),
  best_time_to_reach TEXT,

  -- Decision style
  decision_style TEXT CHECK (decision_style IN ('owner_led', 'consensus', 'committee', 'financial')),
  typical_timeline TEXT,
  key_concerns TEXT[],

  -- Objections & what worked
  objections_encountered JSONB DEFAULT '[]', -- [{ objection, response_that_worked, date, resolved }]

  -- Rapport builders
  rapport_builders TEXT[], -- ["golf", "kids same school", "UNC fan", "ex-military"]
  personal_notes JSONB DEFAULT '[]',

  -- From outcomes
  last_win_theme TEXT,
  last_loss_reason TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_memory_company ON account_memory(company_id);

-- ============================================
-- ACCOUNT MEMORY UPDATES TABLE
-- Audit trail for memory updates
-- ============================================

CREATE TABLE IF NOT EXISTS account_memory_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_memory_id UUID REFERENCES account_memory(id) ON DELETE CASCADE,

  field_updated TEXT,
  old_value JSONB,
  new_value JSONB,

  source TEXT CHECK (source IN ('meeting_analysis', 'email_analysis', 'manual', 'postmortem')),
  source_id UUID,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- HUMAN LEVERAGE MOMENTS TABLE
-- The killer feature
-- ============================================

CREATE TABLE IF NOT EXISTS human_leverage_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Classification
  type TEXT NOT NULL, -- 'relationship_repair', 'exec_intro', 'competitive_threat', 'pricing_exception'
  urgency TEXT CHECK (urgency IN ('immediate', 'today', 'this_week', 'before_next_milestone')),
  required_role TEXT CHECK (required_role IN ('rep', 'sales_manager', 'exec', 'founder')),

  -- Confidence with bands
  confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
  confidence_low INTEGER,
  confidence_high INTEGER,
  confidence_label TEXT, -- "Most likely 72% (ranges 55-88%)"
  confidence_factors JSONB DEFAULT '[]',

  -- Trust basis (why rep should listen)
  trust_basis JSONB NOT NULL, -- { historical_accuracy, similar_outcomes, signal_sources, data_points }

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

  -- Outcome (for learning)
  outcome TEXT CHECK (outcome IN ('successful', 'unsuccessful', 'unknown')),
  outcome_notes TEXT,

  -- Generation
  generated_by_job_id UUID REFERENCES ai_jobs(id),
  trigger_data JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_hlm_company ON human_leverage_moments(company_id);
CREATE INDEX IF NOT EXISTS idx_hlm_deal ON human_leverage_moments(deal_id);
CREATE INDEX IF NOT EXISTS idx_hlm_status ON human_leverage_moments(status);
CREATE INDEX IF NOT EXISTS idx_hlm_urgency ON human_leverage_moments(urgency);
CREATE INDEX IF NOT EXISTS idx_hlm_type ON human_leverage_moments(type);

-- ============================================
-- REP TRUST PROFILES TABLE
-- Hidden from reps, used to weight feedback
-- ============================================

CREATE TABLE IF NOT EXISTS rep_trust_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  -- Behavior metrics (rolling 90 days)
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

  -- Computed scores (0-100)
  engagement_score INTEGER,
  accuracy_score INTEGER,
  follow_through_score INTEGER,

  -- Trust weight (0.5 to 1.5)
  trust_weight NUMERIC DEFAULT 1.0,

  -- Exclude from learning if behavior is poor
  is_learning_excluded BOOLEAN DEFAULT false,

  last_computed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_trust_user ON rep_trust_profiles(user_id);

-- ============================================
-- TRIGGER ACCURACY TABLE
-- For calibration
-- ============================================

CREATE TABLE IF NOT EXISTS trigger_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL UNIQUE,

  total_fired INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  total_successful INTEGER DEFAULT 0,
  total_dismissed INTEGER DEFAULT 0,

  accuracy_rate NUMERIC,
  completion_rate NUMERIC,

  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed trigger types
INSERT INTO trigger_accuracy (trigger_type) VALUES
  ('relationship_repair'),
  ('exec_intro'),
  ('competitive_threat'),
  ('pricing_exception')
ON CONFLICT (trigger_type) DO NOTHING;

-- ============================================
-- DEAL POSTMORTEMS TABLE
-- Win/loss analysis
-- ============================================

CREATE TABLE IF NOT EXISTS deal_postmortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE UNIQUE,

  summary TEXT,
  what_worked JSONB,
  what_didnt_work JSONB,
  turning_points JSONB,
  prediction_accuracy JSONB, -- { predicted, actual, assessment }

  full_analysis JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PATTERN LEARNINGS TABLE
-- What works by segment
-- ============================================

CREATE TABLE IF NOT EXISTS pattern_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  deal_id UUID REFERENCES deals(id),
  company_id UUID REFERENCES companies(id),

  ownership_type TEXT,
  company_size_bucket TEXT CHECK (company_size_bucket IN ('small', 'medium', 'large')),
  deal_size_bucket TEXT CHECK (deal_size_bucket IN ('small', 'medium', 'large', 'enterprise')),
  outcome TEXT CHECK (outcome IN ('won', 'lost')),

  learning TEXT,
  what_worked JSONB,
  what_didnt_work JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pattern_learnings_ownership ON pattern_learnings(ownership_type);
CREATE INDEX IF NOT EXISTS idx_pattern_learnings_outcome ON pattern_learnings(outcome);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to new tables
DROP TRIGGER IF EXISTS update_deal_intelligence_updated_at ON deal_intelligence;
CREATE TRIGGER update_deal_intelligence_updated_at
  BEFORE UPDATE ON deal_intelligence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_roles_updated_at ON ai_roles;
CREATE TRIGGER update_ai_roles_updated_at
  BEFORE UPDATE ON ai_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_jobs_updated_at ON ai_jobs;
CREATE TRIGGER update_ai_jobs_updated_at
  BEFORE UPDATE ON ai_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_account_memory_updated_at ON account_memory;
CREATE TRIGGER update_account_memory_updated_at
  BEFORE UPDATE ON account_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rep_trust_profiles_updated_at ON rep_trust_profiles;
CREATE TRIGGER update_rep_trust_profiles_updated_at
  BEFORE UPDATE ON rep_trust_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
