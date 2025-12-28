-- AI Autopilot System Migration
-- Creates ai_action_log table for auditing all AI-initiated actions
-- Provides transparency, debugging, safety controls, and idempotency

-- ============================================
-- 1. ENUM TYPES (drop and recreate if table doesn't exist)
-- ============================================

-- Only recreate enums if the table doesn't exist yet (clean slate)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_action_log') THEN
    -- Drop existing enums if they exist (from failed previous runs)
    DROP TYPE IF EXISTS ai_action_source CASCADE;
    DROP TYPE IF EXISTS ai_action_type CASCADE;
    DROP TYPE IF EXISTS ai_action_status CASCADE;

    -- Create enum types fresh
    CREATE TYPE ai_action_source AS ENUM (
      'scheduler',
      'communications',
      'transcript',
      'pipeline',
      'system'
    );

    CREATE TYPE ai_action_type AS ENUM (
      'EMAIL_SENT',
      'EMAIL_DRAFTED',
      'MEETING_BOOKED',
      'MEETING_PROPOSED',
      'MEETING_RESCHEDULED',
      'FOLLOWUP_CREATED',
      'NEXT_STEP_SET',
      'FLAG_CREATED',
      'FLAG_RESOLVED',
      'ESCALATED_TO_HUMAN',
      'ERROR'
    );

    CREATE TYPE ai_action_status AS ENUM (
      'success',
      'skipped',
      'failed',
      'pending'
    );
  END IF;
END $$;

-- ============================================
-- 2. AI_ACTION_LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS ai_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source and type
  source ai_action_source NOT NULL,
  action_type ai_action_type NOT NULL,

  -- Status
  status ai_action_status NOT NULL DEFAULT 'pending',

  -- Entity relationships (context)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL,
  communication_id UUID REFERENCES communications(id) ON DELETE SET NULL,
  scheduling_request_id UUID REFERENCES scheduling_requests(id) ON DELETE SET NULL,
  transcription_id UUID REFERENCES meeting_transcriptions(id) ON DELETE SET NULL,
  attention_flag_id UUID REFERENCES attention_flags(id) ON DELETE SET NULL,

  -- Action details
  inputs JSONB DEFAULT '{}',          -- Input data for the action
  outputs JSONB DEFAULT '{}',         -- Result data (email content, meeting ID, etc.)
  ai_reasoning TEXT,                  -- Why AI took this action

  -- Idempotency
  idempotency_key TEXT UNIQUE,        -- Prevents duplicate actions

  -- Error handling
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- 3. INDEXES
-- ============================================

-- Query by source and status (for retry/monitoring)
CREATE INDEX IF NOT EXISTS idx_ai_action_log_source_status
  ON ai_action_log(source, status, created_at DESC);

-- Query by entity (for audit trail per entity)
CREATE INDEX IF NOT EXISTS idx_ai_action_log_company
  ON ai_action_log(company_id, created_at DESC)
  WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_action_log_contact
  ON ai_action_log(contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_action_log_user
  ON ai_action_log(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_action_log_communication
  ON ai_action_log(communication_id, created_at DESC)
  WHERE communication_id IS NOT NULL;

-- Idempotency lookups (unique constraint already creates index, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_ai_action_log_idempotency
  ON ai_action_log(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Failed actions for retry
CREATE INDEX IF NOT EXISTS idx_ai_action_log_failed
  ON ai_action_log(status, retry_count, created_at)
  WHERE status = 'failed'::ai_action_status;

-- Recent actions for activity page (covers common query pattern)
CREATE INDEX IF NOT EXISTS idx_ai_action_log_recent
  ON ai_action_log(created_at DESC);

-- Action type filtering
CREATE INDEX IF NOT EXISTS idx_ai_action_log_action_type
  ON ai_action_log(action_type, created_at DESC);

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE ai_action_log ENABLE ROW LEVEL SECURITY;

-- Users can view actions related to their data
CREATE POLICY "Users can view relevant AI actions" ON ai_action_log
  FOR SELECT USING (
    -- User's own actions
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    OR
    -- Admins/managers can see all
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'manager')
    )
  );

-- Service role has full access (for background jobs)
CREATE POLICY "Service role full access" ON ai_action_log
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Function to check idempotency before inserting
CREATE OR REPLACE FUNCTION check_ai_action_idempotency(p_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM ai_action_log
    WHERE idempotency_key = p_key
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get recent AI actions for a communication (for Daily Driver filtering)
CREATE OR REPLACE FUNCTION get_ai_handled_communication_ids(p_hours INTEGER DEFAULT 24)
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT communication_id
  FROM ai_action_log
  WHERE communication_id IS NOT NULL
    AND status = 'success'::ai_action_status
    AND action_type IN ('EMAIL_SENT'::ai_action_type, 'FLAG_CREATED'::ai_action_type, 'FLAG_RESOLVED'::ai_action_type)
    AND created_at >= NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. COMMENTS
-- ============================================

COMMENT ON TABLE ai_action_log IS
  'Audit log for all AI-initiated actions. Provides transparency, debugging, and safety controls.';

COMMENT ON COLUMN ai_action_log.source IS
  'Which autopilot workflow initiated this action';

COMMENT ON COLUMN ai_action_log.action_type IS
  'What type of action was taken';

COMMENT ON COLUMN ai_action_log.idempotency_key IS
  'Unique key to prevent duplicate actions. Format: source:entity_id:action_type:date';

COMMENT ON COLUMN ai_action_log.inputs IS
  'JSONB snapshot of input data used to make the decision';

COMMENT ON COLUMN ai_action_log.outputs IS
  'JSONB result of the action (email content, meeting ID, etc.)';

COMMENT ON COLUMN ai_action_log.ai_reasoning IS
  'Human-readable explanation of why the AI took this action';

-- ============================================
-- 7. EXTEND MEETING_TRANSCRIPTIONS FOR FOLLOW-UP TRACKING
-- ============================================

-- Add follow_up_sent tracking if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_transcriptions'
    AND column_name = 'follow_up_sent'
  ) THEN
    ALTER TABLE meeting_transcriptions
      ADD COLUMN follow_up_sent BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_transcriptions'
    AND column_name = 'follow_up_sent_at'
  ) THEN
    ALTER TABLE meeting_transcriptions
      ADD COLUMN follow_up_sent_at TIMESTAMPTZ;
  END IF;
END $$;

-- Index for transcript autopilot query
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_followup_pending
  ON meeting_transcriptions(meeting_date DESC)
  WHERE follow_up_sent = FALSE AND analysis IS NOT NULL;
