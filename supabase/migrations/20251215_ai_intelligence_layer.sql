-- X-FORCE AI Intelligence Layer
-- Migration: AI Core Tables
--
-- Tables:
-- 1. ai_summaries - Central AI summaries for all entities
-- 2. ai_action_queue - Things AI wants to do or suggest
-- 3. ai_signals - AI-detected signals and alerts
-- 4. ai_email_drafts - AI-generated email drafts
-- 5. ai_insights_log - For learning and audit
-- 6. deal_health_history - Health scores tracked over time

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE ai_summary_type AS ENUM (
  'deal_overview',
  'deal_status',
  'company_overview',
  'contact_overview',
  'relationship_summary',
  'engagement_summary'
);

CREATE TYPE ai_action_type AS ENUM (
  'send_email',
  'move_stage',
  'create_task',
  'schedule_meeting',
  'alert',
  'update_value',
  'add_contact',
  'send_content',
  'log_activity'
);

CREATE TYPE ai_action_status AS ENUM (
  'pending',
  'approved',
  'executed',
  'rejected',
  'expired'
);

CREATE TYPE ai_action_priority AS ENUM (
  'critical',
  'high',
  'medium',
  'low'
);

CREATE TYPE ai_signal_type AS ENUM (
  'risk',
  'opportunity',
  'buying_signal',
  'stale',
  'competitor',
  'sentiment_negative',
  'sentiment_positive',
  'engagement_spike',
  'engagement_drop',
  'stage_stuck',
  'action_needed'
);

CREATE TYPE ai_signal_severity AS ENUM (
  'critical',
  'warning',
  'info',
  'positive'
);

CREATE TYPE ai_signal_status AS ENUM (
  'active',
  'acknowledged',
  'resolved',
  'dismissed'
);

CREATE TYPE ai_email_draft_type AS ENUM (
  'follow_up',
  'response',
  'introduction',
  'proposal',
  'check_in',
  're_engagement',
  'meeting_request',
  'thank_you',
  'custom'
);

CREATE TYPE ai_email_draft_status AS ENUM (
  'draft',
  'approved',
  'sent',
  'rejected'
);

CREATE TYPE health_trend AS ENUM (
  'improving',
  'stable',
  'declining'
);

-- ============================================
-- AI SUMMARIES TABLE
-- ============================================

CREATE TABLE ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity references (only one should be set)
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

  -- Summary data
  summary_type ai_summary_type NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}',
  summary_text TEXT,

  -- Key insights extracted
  key_points TEXT[],
  risks TEXT[],
  opportunities TEXT[],

  -- Freshness tracking
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  context_hash VARCHAR(64), -- Hash of input data to detect staleness
  stale BOOLEAN DEFAULT FALSE,

  -- AI metadata
  model_used VARCHAR(100),
  tokens_used INTEGER,
  confidence DECIMAL(3,2), -- 0.00 to 1.00

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT ai_summaries_single_entity CHECK (
    (deal_id IS NOT NULL)::int +
    (company_id IS NOT NULL)::int +
    (contact_id IS NOT NULL)::int = 1
  )
);

-- Indexes
CREATE INDEX idx_ai_summaries_deal ON ai_summaries(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_ai_summaries_company ON ai_summaries(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_ai_summaries_contact ON ai_summaries(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_ai_summaries_type ON ai_summaries(summary_type);
CREATE INDEX idx_ai_summaries_stale ON ai_summaries(stale) WHERE stale = TRUE;

-- ============================================
-- AI ACTION QUEUE TABLE
-- ============================================

CREATE TABLE ai_action_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity references
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id), -- Who should see/act on this

  -- Action details
  action_type ai_action_type NOT NULL,
  action_data JSONB NOT NULL DEFAULT '{}', -- All data needed to execute
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Classification
  priority ai_action_priority NOT NULL DEFAULT 'medium',
  auto_execute BOOLEAN DEFAULT FALSE, -- Can AI do this without approval?
  requires_approval BOOLEAN DEFAULT TRUE,

  -- Status
  status ai_action_status NOT NULL DEFAULT 'pending',

  -- AI reasoning
  reasoning TEXT, -- Why AI suggests this
  confidence DECIMAL(3,2), -- 0.00 to 1.00
  trigger_source VARCHAR(100), -- What triggered this (email, time, activity)

  -- Execution tracking
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  execution_result JSONB,
  rejected_reason TEXT,

  -- Expiration
  expires_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_actions_status ON ai_action_queue(status) WHERE status = 'pending';
CREATE INDEX idx_ai_actions_user ON ai_action_queue(user_id);
CREATE INDEX idx_ai_actions_deal ON ai_action_queue(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_ai_actions_priority ON ai_action_queue(priority);
CREATE INDEX idx_ai_actions_expires ON ai_action_queue(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- AI SIGNALS TABLE
-- ============================================

CREATE TABLE ai_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity references
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id), -- Who should see this

  -- Signal details
  signal_type ai_signal_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Severity/importance
  severity ai_signal_severity NOT NULL DEFAULT 'info',
  score INTEGER CHECK (score >= 0 AND score <= 100), -- Signal strength

  -- Evidence
  evidence JSONB DEFAULT '{}', -- What triggered this signal
  source VARCHAR(100), -- 'email', 'meeting', 'activity', 'time_based', 'health_check'

  -- Status
  status ai_signal_status NOT NULL DEFAULT 'active',
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  dismissed_reason TEXT,

  -- Auto-resolution
  auto_resolve_condition JSONB, -- Conditions that would auto-resolve this

  -- Suggested action
  suggested_action TEXT,
  action_queue_id UUID REFERENCES ai_action_queue(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_signals_active ON ai_signals(status) WHERE status = 'active';
CREATE INDEX idx_ai_signals_deal ON ai_signals(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_ai_signals_user ON ai_signals(user_id);
CREATE INDEX idx_ai_signals_type ON ai_signals(signal_type);
CREATE INDEX idx_ai_signals_severity ON ai_signals(severity);

-- ============================================
-- AI EMAIL DRAFTS TABLE
-- ============================================

CREATE TABLE ai_email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) NOT NULL, -- Who this draft is for

  -- Reply context
  in_reply_to_message_id VARCHAR(255), -- Email message ID if this is a reply
  thread_id VARCHAR(255),

  -- Email content
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  body_plain TEXT,

  -- AI metadata
  draft_type ai_email_draft_type NOT NULL,
  generation_prompt TEXT, -- What prompted this draft
  reasoning TEXT, -- Why AI wrote this
  confidence DECIMAL(3,2),

  -- Suggestions
  suggested_send_time TIMESTAMP WITH TIME ZONE,
  suggested_attachments TEXT[],
  tone VARCHAR(50), -- 'formal', 'friendly', 'urgent'

  -- Status
  status ai_email_draft_status NOT NULL DEFAULT 'draft',
  edited_by_user BOOLEAN DEFAULT FALSE,
  user_edits JSONB, -- Track what user changed

  -- Execution
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_message_id VARCHAR(255), -- ID of sent email

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_drafts_status ON ai_email_drafts(status) WHERE status = 'draft';
CREATE INDEX idx_ai_drafts_user ON ai_email_drafts(user_id);
CREATE INDEX idx_ai_drafts_deal ON ai_email_drafts(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_ai_drafts_type ON ai_email_drafts(draft_type);

-- ============================================
-- AI INSIGHTS LOG TABLE (for learning/audit)
-- ============================================

CREATE TABLE ai_insights_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id),

  -- Insight details
  insight_type VARCHAR(100) NOT NULL,
  insight_data JSONB NOT NULL DEFAULT '{}',

  -- For predictions - tracking accuracy
  prediction JSONB, -- What AI predicted
  actual_outcome JSONB, -- What actually happened
  was_accurate BOOLEAN,
  accuracy_notes TEXT,

  -- Usage tracking
  model_used VARCHAR(100),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_insights_type ON ai_insights_log(insight_type);
CREATE INDEX idx_ai_insights_deal ON ai_insights_log(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_ai_insights_created ON ai_insights_log(created_at);

-- ============================================
-- DEAL HEALTH HISTORY TABLE
-- ============================================

CREATE TABLE deal_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  -- Overall score
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),

  -- Component scores
  engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
  velocity_score INTEGER CHECK (velocity_score >= 0 AND velocity_score <= 100),
  stakeholder_score INTEGER CHECK (stakeholder_score >= 0 AND stakeholder_score <= 100),
  activity_score INTEGER CHECK (activity_score >= 0 AND activity_score <= 100),
  sentiment_score INTEGER CHECK (sentiment_score >= 0 AND sentiment_score <= 100),

  -- Detailed breakdown
  score_breakdown JSONB DEFAULT '{}',

  -- Factors
  risk_factors TEXT[],
  positive_factors TEXT[],

  -- Trend analysis
  trend health_trend,
  change_from_last INTEGER, -- Points change from previous record

  -- When this was recorded
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_deal_health_deal ON deal_health_history(deal_id);
CREATE INDEX idx_deal_health_recorded ON deal_health_history(recorded_at);
CREATE INDEX idx_deal_health_deal_time ON deal_health_history(deal_id, recorded_at DESC);

-- ============================================
-- ADD health_score COLUMN TO DEALS IF NOT EXISTS
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'health_score'
  ) THEN
    ALTER TABLE deals ADD COLUMN health_score INTEGER DEFAULT 50
      CHECK (health_score >= 0 AND health_score <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'health_updated_at'
  ) THEN
    ALTER TABLE deals ADD COLUMN health_updated_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'health_trend'
  ) THEN
    ALTER TABLE deals ADD COLUMN health_trend health_trend;
  END IF;
END $$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at on ai_summaries
CREATE TRIGGER ai_summaries_updated_at
  BEFORE UPDATE ON ai_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update updated_at on ai_signals
CREATE TRIGGER ai_signals_updated_at
  BEFORE UPDATE ON ai_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update updated_at on ai_email_drafts
CREATE TRIGGER ai_email_drafts_updated_at
  BEFORE UPDATE ON ai_email_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_action_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_health_history ENABLE ROW LEVEL SECURITY;

-- AI Summaries - viewable by authenticated users
CREATE POLICY ai_summaries_select ON ai_summaries
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY ai_summaries_insert ON ai_summaries
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY ai_summaries_update ON ai_summaries
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- AI Action Queue - viewable by authenticated users
CREATE POLICY ai_action_queue_select ON ai_action_queue
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY ai_action_queue_insert ON ai_action_queue
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY ai_action_queue_update ON ai_action_queue
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- AI Signals - viewable by authenticated users
CREATE POLICY ai_signals_select ON ai_signals
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY ai_signals_insert ON ai_signals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY ai_signals_update ON ai_signals
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- AI Email Drafts - viewable by authenticated users
CREATE POLICY ai_email_drafts_select ON ai_email_drafts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY ai_email_drafts_insert ON ai_email_drafts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY ai_email_drafts_update ON ai_email_drafts
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY ai_email_drafts_delete ON ai_email_drafts
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- AI Insights Log - viewable by authenticated users
CREATE POLICY ai_insights_log_select ON ai_insights_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY ai_insights_log_insert ON ai_insights_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Deal Health History - viewable by authenticated users
CREATE POLICY deal_health_history_select ON deal_health_history
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY deal_health_history_insert ON deal_health_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to mark summaries as stale when related data changes
CREATE OR REPLACE FUNCTION mark_summaries_stale()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark deal summaries stale
  IF TG_TABLE_NAME = 'activities' THEN
    UPDATE ai_summaries SET stale = TRUE, updated_at = NOW()
    WHERE deal_id = COALESCE(NEW.deal_id, OLD.deal_id)
       OR company_id = COALESCE(NEW.company_id, OLD.company_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to mark summaries stale on activity changes
CREATE TRIGGER activities_mark_summaries_stale
  AFTER INSERT OR UPDATE OR DELETE ON activities
  FOR EACH ROW EXECUTE FUNCTION mark_summaries_stale();

-- ============================================
-- VIEWS
-- ============================================

-- Active signals view with entity info
CREATE OR REPLACE VIEW active_signals_view AS
SELECT
  s.*,
  d.name as deal_name,
  d.stage as deal_stage,
  c.name as company_name,
  ct.name as contact_name
FROM ai_signals s
LEFT JOIN deals d ON s.deal_id = d.id
LEFT JOIN companies c ON s.company_id = c.id
LEFT JOIN contacts ct ON s.contact_id = ct.id
WHERE s.status = 'active';

-- Pending actions view
CREATE OR REPLACE VIEW pending_actions_view AS
SELECT
  a.*,
  d.name as deal_name,
  c.name as company_name,
  u.name as user_name
FROM ai_action_queue a
LEFT JOIN deals d ON a.deal_id = d.id
LEFT JOIN companies c ON a.company_id = c.id
LEFT JOIN users u ON a.user_id = u.id
WHERE a.status = 'pending'
ORDER BY
  CASE a.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  a.created_at;

-- Deal health with latest scores
CREATE OR REPLACE VIEW deal_health_view AS
SELECT DISTINCT ON (d.id)
  d.id as deal_id,
  d.name as deal_name,
  d.stage,
  d.health_score,
  d.health_trend,
  d.health_updated_at,
  h.engagement_score,
  h.velocity_score,
  h.stakeholder_score,
  h.activity_score,
  h.sentiment_score,
  h.risk_factors,
  h.positive_factors,
  h.recorded_at as last_calculated
FROM deals d
LEFT JOIN deal_health_history h ON d.id = h.deal_id
WHERE d.stage NOT IN ('closed_won', 'closed_lost')
ORDER BY d.id, h.recorded_at DESC;
