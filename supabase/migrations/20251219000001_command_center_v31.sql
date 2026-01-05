-- AI Command Center v3.1 "Momentum Engine"
-- Phase 1: Time-Aware Daily Planning

-- ============================================
-- COMMAND CENTER ITEMS (Unified Action Queue)
-- ============================================
-- Replaces tasks table with unified action queue
-- Supports tasks, emails, meeting prep, follow-ups, signals

CREATE TABLE IF NOT EXISTS command_center_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Source linking (one or more may be set)
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES email_conversations(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  signal_id UUID REFERENCES ai_signals(id) ON DELETE SET NULL,
  meeting_id TEXT,  -- Calendar event ID from Microsoft Graph

  -- Action details
  action_type VARCHAR(50) NOT NULL,
  -- Types: call, call_with_prep, email_send_draft, email_compose, email_respond,
  --        meeting_prep, meeting_follow_up, proposal_review, linkedin_touch,
  --        research_account, internal_sync, task_simple, task_complex

  title TEXT NOT NULL,
  description TEXT,

  -- Targets (denormalized for display performance)
  target_name TEXT,           -- Contact or company name
  company_name TEXT,          -- Company name

  -- Value context
  deal_value NUMERIC(15,2),
  deal_probability FLOAT DEFAULT 0.5,
  deal_stage VARCHAR(50),

  -- Time estimates (minutes)
  estimated_minutes INTEGER DEFAULT 15,

  -- Momentum scoring (v3.1)
  momentum_score INTEGER DEFAULT 0 CHECK (momentum_score >= 0 AND momentum_score <= 100),
  score_factors JSONB DEFAULT '{}',
  score_explanation TEXT[] DEFAULT '{}',

  -- Score components (for debugging and transparency)
  base_priority INTEGER DEFAULT 0,
  time_pressure INTEGER DEFAULT 0,
  value_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,

  -- Timing
  due_at TIMESTAMPTZ,
  optimal_hours INTEGER[],    -- Best hours to execute (0-23)
  optimal_days TEXT[],        -- Best days ('Mon', 'Tue', etc.)

  -- AI-generated context
  why_now TEXT,               -- "He opened your proposal 3x in last hour"
  context_brief TEXT,         -- Relevant background
  win_tip TEXT,               -- Tactical suggestion

  -- Status lifecycle
  status VARCHAR(30) DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_progress', 'completed', 'snoozed', 'dismissed')
  ),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  dismissed_reason TEXT,

  -- Snooze tracking
  snoozed_until TIMESTAMPTZ,
  snooze_count INTEGER DEFAULT 0,
  last_snoozed_at TIMESTAMPTZ,

  -- Skip/ignore tracking (for learning)
  skip_count INTEGER DEFAULT 0,
  last_skipped_at TIMESTAMPTZ,

  -- Planning
  planned_for_date DATE,
  planned_block_index INTEGER,
  planned_order INTEGER,

  -- Primary action configuration
  primary_action_label TEXT DEFAULT 'Do It',
  primary_action_url TEXT,
  fallback_action_label TEXT,

  -- Source tracking
  source VARCHAR(50) DEFAULT 'system',
  -- Sources: system, manual, email_sync, calendar_sync, signal_detection, ai_recommendation
  source_id TEXT,             -- ID from source system

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cci_user_status ON command_center_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_cci_user_date ON command_center_items(user_id, planned_for_date);
CREATE INDEX IF NOT EXISTS idx_cci_momentum ON command_center_items(user_id, momentum_score DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_cci_user_pending ON command_center_items(user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_cci_due_at ON command_center_items(due_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_cci_deal ON command_center_items(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cci_company ON command_center_items(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cci_conversation ON command_center_items(conversation_id) WHERE conversation_id IS NOT NULL;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_command_center_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS command_center_items_updated_at ON command_center_items;
CREATE TRIGGER command_center_items_updated_at
  BEFORE UPDATE ON command_center_items
  FOR EACH ROW
  EXECUTE FUNCTION update_command_center_items_updated_at();


-- ============================================
-- DAILY PLANS
-- ============================================
-- Stores calculated daily capacity and time blocks

CREATE TABLE IF NOT EXISTS daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,

  -- Capacity (all in minutes)
  total_work_minutes INTEGER DEFAULT 480,       -- 8 hours default
  meeting_minutes INTEGER DEFAULT 0,
  prep_buffer_minutes INTEGER DEFAULT 0,        -- Time before meetings
  reactive_buffer_minutes INTEGER DEFAULT 60,   -- Time for unexpected work
  available_minutes INTEGER DEFAULT 0,          -- What's left for planned actions
  planned_minutes INTEGER DEFAULT 0,            -- Actually scheduled

  -- Time blocks (JSON array)
  -- Each block: { start: ISO, end: ISO, type: 'available'|'meeting'|'prep'|'buffer', meeting_id?: string }
  time_blocks JSONB DEFAULT '[]',

  -- Items planned for this day (ordered by execution order)
  planned_item_ids UUID[] DEFAULT '{}',

  -- Metrics
  total_potential_value NUMERIC(15,2) DEFAULT 0,
  completed_value NUMERIC(15,2) DEFAULT 0,
  items_planned INTEGER DEFAULT 0,
  items_completed INTEGER DEFAULT 0,
  completion_rate FLOAT DEFAULT 0,

  -- Generation tracking
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  last_refreshed_at TIMESTAMPTZ,
  calendar_hash TEXT,         -- Hash of calendar to detect changes

  UNIQUE(user_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_daily_plans_date ON daily_plans(plan_date);


-- ============================================
-- REP TIME PROFILES
-- ============================================
-- Stores work preferences and learned patterns per rep

CREATE TABLE IF NOT EXISTS rep_time_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  -- Work schedule
  work_start_time TIME DEFAULT '09:00',
  work_end_time TIME DEFAULT '17:00',
  work_days TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
  timezone TEXT DEFAULT 'America/New_York',

  -- Buffers (minutes)
  meeting_prep_buffer INTEGER DEFAULT 15,        -- Time before external meetings
  reactive_buffer INTEGER DEFAULT 60,            -- Daily buffer for unexpected work
  focus_block_preference INTEGER DEFAULT 60,     -- Preferred uninterrupted block size

  -- Learned action durations (overrides defaults)
  -- Format: { "call": 18, "email_respond": 5 }
  action_durations JSONB DEFAULT '{}',

  -- Preferences
  prefer_calls_morning BOOLEAN DEFAULT TRUE,
  prefer_email_batching BOOLEAN DEFAULT TRUE,
  max_calls_per_day INTEGER DEFAULT 20,
  max_emails_per_day INTEGER DEFAULT 50,

  -- Learning stats
  total_actions_completed INTEGER DEFAULT 0,
  avg_actions_per_day FLOAT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_rep_time_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rep_time_profiles_updated_at ON rep_time_profiles;
CREATE TRIGGER rep_time_profiles_updated_at
  BEFORE UPDATE ON rep_time_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_rep_time_profiles_updated_at();


-- ============================================
-- ACTION TYPE ENUM (for reference)
-- ============================================
-- Not enforced as enum to allow flexibility, but documented here:
--
-- call              - Phone call (no prep)
-- call_with_prep    - Phone call with context review
-- email_send_draft  - AI draft ready to review/send
-- email_compose     - Write email from scratch
-- email_respond     - Reply to received email
-- meeting_prep      - Prepare for upcoming meeting
-- meeting_follow_up - Follow up after meeting
-- proposal_review   - Review/send proposal
-- linkedin_touch    - LinkedIn engagement
-- research_account  - Research company/contact
-- internal_sync     - Internal team coordination
-- task_simple       - Quick task (~5 min)
-- task_complex      - Complex task (~30 min)


-- ============================================
-- MIGRATE EXISTING TASKS (run after creation)
-- ============================================
-- This creates command_center_items from existing tasks

INSERT INTO command_center_items (
  user_id,
  task_id,
  deal_id,
  company_id,
  action_type,
  title,
  description,
  due_at,
  status,
  completed_at,
  source,
  created_at
)
SELECT
  t.assigned_to as user_id,
  t.id as task_id,
  t.deal_id,
  t.company_id,
  CASE
    WHEN t.type = 'call' THEN 'call'
    WHEN t.type = 'email' THEN 'email_compose'
    WHEN t.type = 'meeting' THEN 'meeting_prep'
    WHEN t.type = 'follow_up' THEN 'task_simple'
    WHEN t.type = 'review' THEN 'task_complex'
    ELSE 'task_simple'
  END as action_type,
  t.title,
  t.description,
  t.due_at,
  CASE
    WHEN t.completed_at IS NOT NULL THEN 'completed'
    ELSE 'pending'
  END as status,
  t.completed_at,
  CASE t.source
    WHEN 'ai_recommendation' THEN 'ai_recommendation'
    WHEN 'meeting_extraction' THEN 'calendar_sync'
    WHEN 'fireflies_ai' THEN 'calendar_sync'
    ELSE 'manual'
  END as source,
  t.created_at
FROM tasks t
WHERE t.assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;


-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE command_center_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_time_profiles ENABLE ROW LEVEL SECURITY;

-- Command Center Items: Users can only see their own items
DROP POLICY IF EXISTS "Users can view own command center items" ON command_center_items;
CREATE POLICY "Users can view own command center items"
  ON command_center_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own command center items" ON command_center_items;
CREATE POLICY "Users can insert own command center items"
  ON command_center_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own command center items" ON command_center_items;
CREATE POLICY "Users can update own command center items"
  ON command_center_items FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own command center items" ON command_center_items;
CREATE POLICY "Users can delete own command center items"
  ON command_center_items FOR DELETE
  USING (auth.uid() = user_id);

-- Daily Plans: Users can only see their own plans
DROP POLICY IF EXISTS "Users can view own daily plans" ON daily_plans;
CREATE POLICY "Users can view own daily plans"
  ON daily_plans FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily plans" ON daily_plans;
CREATE POLICY "Users can insert own daily plans"
  ON daily_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily plans" ON daily_plans;
CREATE POLICY "Users can update own daily plans"
  ON daily_plans FOR UPDATE
  USING (auth.uid() = user_id);

-- Rep Time Profiles: Users can only see their own profile
DROP POLICY IF EXISTS "Users can view own time profile" ON rep_time_profiles;
CREATE POLICY "Users can view own time profile"
  ON rep_time_profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own time profile" ON rep_time_profiles;
CREATE POLICY "Users can insert own time profile"
  ON rep_time_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own time profile" ON rep_time_profiles;
CREATE POLICY "Users can update own time profile"
  ON rep_time_profiles FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================
-- SERVICE ROLE BYPASS
-- ============================================
-- Allow service role full access for cron jobs

DROP POLICY IF EXISTS "Service role has full access to command_center_items" ON command_center_items;
CREATE POLICY "Service role has full access to command_center_items"
  ON command_center_items FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role has full access to daily_plans" ON daily_plans;
CREATE POLICY "Service role has full access to daily_plans"
  ON daily_plans FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role has full access to rep_time_profiles" ON rep_time_profiles;
CREATE POLICY "Service role has full access to rep_time_profiles"
  ON rep_time_profiles FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
