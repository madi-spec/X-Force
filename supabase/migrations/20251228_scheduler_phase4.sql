-- ============================================
-- AI SCHEDULER PHASE 4: INTELLIGENCE & GUARDRAILS
-- ============================================

-- ============================================
-- CONTACT FREQUENCY TRACKING
-- ============================================

-- State table for tracking contact communication status
CREATE TABLE IF NOT EXISTS contact_frequency_state (
  contact_id UUID PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  is_blocked BOOLEAN DEFAULT FALSE,
  block_reason TEXT,
  block_until TIMESTAMPTZ,
  outreach_without_response INTEGER DEFAULT 0,
  last_response_at TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table for tracking individual contact events
CREATE TABLE IF NOT EXISTS contact_frequency_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  channel VARCHAR(20) NOT NULL, -- 'email', 'sms', 'phone'
  direction VARCHAR(20) NOT NULL, -- 'outbound', 'inbound'
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_contact_frequency_events_contact_id
  ON contact_frequency_events(contact_id);

CREATE INDEX IF NOT EXISTS idx_contact_frequency_events_event_at
  ON contact_frequency_events(event_at);

-- Index for efficient weekly queries (no partial - will filter at query time)
CREATE INDEX IF NOT EXISTS idx_contact_frequency_events_contact_time
  ON contact_frequency_events(contact_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_frequency_state_blocked
  ON contact_frequency_state(is_blocked)
  WHERE is_blocked = TRUE;

-- ============================================
-- SCHEDULING INTELLIGENCE CACHE
-- ============================================

-- Cache computed scheduling intelligence for performance
CREATE TABLE IF NOT EXISTS scheduling_intelligence_cache (
  scheduling_request_id UUID PRIMARY KEY REFERENCES scheduling_requests(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Computed values
  scheduling_health VARCHAR(20), -- 'healthy', 'at_risk', 'critical'
  success_probability INTEGER, -- 0-100

  -- Signals stored as JSONB
  signals JSONB DEFAULT '[]',
  risks JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  deal_signals JSONB DEFAULT '[]',
  response_pattern JSONB,

  -- Timestamps
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX IF NOT EXISTS idx_scheduling_intelligence_deal
  ON scheduling_intelligence_cache(deal_id)
  WHERE deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_intelligence_expires
  ON scheduling_intelligence_cache(expires_at);

-- ============================================
-- ATTENDEE OPTIMIZATION TRACKING
-- ============================================

-- Track suggested attendee changes
CREATE TABLE IF NOT EXISTS attendee_optimization_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduling_request_id UUID NOT NULL REFERENCES scheduling_requests(id) ON DELETE CASCADE,

  -- Suggestion details
  suggestion_type VARCHAR(50) NOT NULL, -- 'add_attendee', 'remove_attendee', 'upgrade_to_decision_maker'
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  suggested_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Reasoning
  reason TEXT NOT NULL,
  confidence DECIMAL(3,2), -- 0.00 to 1.00
  impact VARCHAR(20), -- 'high', 'medium', 'low'

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'auto_applied'
  processed_at TIMESTAMPTZ,
  processed_by UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendee_suggestions_request
  ON attendee_optimization_suggestions(scheduling_request_id);

CREATE INDEX IF NOT EXISTS idx_attendee_suggestions_pending
  ON attendee_optimization_suggestions(status)
  WHERE status = 'pending';

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE contact_frequency_state IS 'Tracks contact communication status for reputation guardrails';
COMMENT ON TABLE contact_frequency_events IS 'Individual contact events for frequency tracking';
COMMENT ON TABLE scheduling_intelligence_cache IS 'Cached scheduling intelligence computations';
COMMENT ON TABLE attendee_optimization_suggestions IS 'AI-suggested attendee changes for meetings';

COMMENT ON COLUMN contact_frequency_state.is_blocked IS 'Whether contact is blocked from outreach';
COMMENT ON COLUMN contact_frequency_state.block_reason IS 'Reason for blocking (e.g., "Requested no contact", "Excessive no-shows")';
COMMENT ON COLUMN contact_frequency_state.outreach_without_response IS 'Count of outbound contacts since last inbound';

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update contact_frequency_state.updated_at
CREATE OR REPLACE FUNCTION update_contact_frequency_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS contact_frequency_state_updated_at ON contact_frequency_state;
CREATE TRIGGER contact_frequency_state_updated_at
  BEFORE UPDATE ON contact_frequency_state
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_frequency_state_timestamp();

-- Function to clean up expired intelligence cache
CREATE OR REPLACE FUNCTION cleanup_expired_scheduling_intelligence()
RETURNS void AS $$
BEGIN
  DELETE FROM scheduling_intelligence_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE contact_frequency_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_frequency_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_intelligence_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendee_optimization_suggestions ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can view contact frequency state"
  ON contact_frequency_state FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view contact frequency events"
  ON contact_frequency_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view scheduling intelligence"
  ON scheduling_intelligence_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view attendee suggestions"
  ON attendee_optimization_suggestions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access to contact_frequency_state"
  ON contact_frequency_state FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to contact_frequency_events"
  ON contact_frequency_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to scheduling_intelligence_cache"
  ON scheduling_intelligence_cache FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to attendee_optimization_suggestions"
  ON attendee_optimization_suggestions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
