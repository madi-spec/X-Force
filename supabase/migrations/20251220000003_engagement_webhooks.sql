-- Phase 3: Engagement Events & Outbound Webhooks
-- Enables real-time tracking of email opens, clicks, proposal views
-- and dispatching signals to external systems

-- ============================================
-- ENGAGEMENT EVENTS TABLE
-- ============================================
-- Unified table for all engagement events (opens, clicks, views)

CREATE TABLE IF NOT EXISTS engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who triggered this event (the prospect/contact)
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  -- Who owns this engagement (the rep)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Event classification
  event_type VARCHAR(50) NOT NULL,
  -- email_opened, email_clicked, proposal_viewed, link_clicked,
  -- document_downloaded, page_visited, form_submitted

  -- Source context
  source_type VARCHAR(50) NOT NULL, -- 'email', 'proposal', 'website', 'document'
  source_id VARCHAR(255),           -- email message_id, proposal_id, page URL

  -- Event-specific metadata
  metadata JSONB DEFAULT '{}',
  -- For clicks: { url, link_text, link_position }
  -- For opens: { email_subject, open_count, is_first_open }
  -- For proposals: { proposal_name, page_viewed, time_spent_seconds }

  -- Tracking context
  ip_address INET,
  user_agent TEXT,
  device_type VARCHAR(20), -- desktop, mobile, tablet, unknown
  geo_location JSONB,      -- { city, region, country, timezone }

  -- Timestamps
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Processing state
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  signal_id UUID REFERENCES ai_signals(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX idx_engagement_user_time ON engagement_events(user_id, occurred_at DESC);
CREATE INDEX idx_engagement_contact ON engagement_events(contact_id, occurred_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_engagement_deal ON engagement_events(deal_id, occurred_at DESC) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_engagement_source ON engagement_events(source_type, source_id);
CREATE INDEX idx_engagement_unprocessed ON engagement_events(processed, created_at) WHERE processed = FALSE;
CREATE INDEX idx_engagement_type ON engagement_events(event_type, occurred_at DESC);

-- ============================================
-- OUTBOUND WEBHOOKS TABLE
-- ============================================
-- Configuration for pushing events to external systems

CREATE TABLE IF NOT EXISTS outbound_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Webhook identity
  name VARCHAR(255) NOT NULL,
  description TEXT,
  url TEXT NOT NULL,

  -- Authentication
  auth_type VARCHAR(20) NOT NULL DEFAULT 'none',
  -- none: No auth
  -- bearer: Authorization: Bearer {token}
  -- hmac: X-Signature header with HMAC-SHA256
  -- basic: Authorization: Basic {base64}
  auth_value TEXT, -- token, secret, or base64 credentials (encrypted)

  -- Event filtering
  event_types TEXT[] DEFAULT ARRAY['*'],
  -- '*' = all events, or specific: ['engagement.email_opened', 'signal.created']
  min_severity VARCHAR(20), -- NULL = all, or: 'critical', 'warning', 'info', 'positive'
  deal_stages TEXT[],       -- NULL = all, or specific stages to filter

  -- Custom headers (e.g., API keys)
  custom_headers JSONB DEFAULT '{}',

  -- Reliability settings
  is_active BOOLEAN DEFAULT TRUE,
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  timeout_seconds INTEGER DEFAULT 10,

  -- Auto-disable on failures
  auto_disable_after_failures INTEGER DEFAULT 10,
  consecutive_failures INTEGER DEFAULT 0,

  -- Stats
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_error TEXT,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,

  -- Verification (for testing)
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbound_webhooks_user ON outbound_webhooks(user_id, is_active);
CREATE INDEX idx_outbound_webhooks_active ON outbound_webhooks(is_active) WHERE is_active = TRUE;

-- ============================================
-- WEBHOOK DELIVERIES TABLE
-- ============================================
-- Log of all webhook delivery attempts

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES outbound_webhooks(id) ON DELETE CASCADE,

  -- Event info
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,

  -- Delivery status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending, success, failed, retrying

  -- Response info
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,

  -- Retry tracking
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX idx_deliveries_pending ON webhook_deliveries(status, next_retry_at)
  WHERE status IN ('pending', 'retrying');

-- ============================================
-- TRACKING TOKENS TABLE
-- ============================================
-- Short-lived tokens for tracking URLs (prevents token guessing)

CREATE TABLE IF NOT EXISTS tracking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Token (short, URL-safe)
  token VARCHAR(32) NOT NULL UNIQUE,

  -- Context encoded in token
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  -- Email/source context
  source_type VARCHAR(50) NOT NULL, -- 'email', 'proposal'
  source_id VARCHAR(255),           -- message_id, proposal_id

  -- For link tracking
  original_url TEXT,
  link_text VARCHAR(255),
  link_position INTEGER, -- Position in email (1st link, 2nd link, etc.)

  -- Usage tracking
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,

  -- Expiry (tokens expire after 90 days)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tokens_lookup ON tracking_tokens(token);
CREATE INDEX idx_tokens_source ON tracking_tokens(source_type, source_id);
CREATE INDEX idx_tokens_expiry ON tracking_tokens(expires_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to record engagement and update open/click counts
CREATE OR REPLACE FUNCTION record_engagement_from_token(
  p_token VARCHAR,
  p_event_type VARCHAR,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_token_record tracking_tokens%ROWTYPE;
  v_event_id UUID;
  v_device_type VARCHAR(20);
BEGIN
  -- Look up token
  SELECT * INTO v_token_record
  FROM tracking_tokens
  WHERE token = p_token AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Determine device type from user agent
  v_device_type := CASE
    WHEN p_user_agent ILIKE '%mobile%' OR p_user_agent ILIKE '%android%' OR p_user_agent ILIKE '%iphone%' THEN 'mobile'
    WHEN p_user_agent ILIKE '%tablet%' OR p_user_agent ILIKE '%ipad%' THEN 'tablet'
    WHEN p_user_agent IS NOT NULL THEN 'desktop'
    ELSE 'unknown'
  END;

  -- Insert engagement event
  INSERT INTO engagement_events (
    user_id, contact_id, deal_id,
    event_type, source_type, source_id,
    metadata, ip_address, user_agent, device_type,
    occurred_at
  ) VALUES (
    v_token_record.user_id,
    v_token_record.contact_id,
    v_token_record.deal_id,
    p_event_type,
    v_token_record.source_type,
    v_token_record.source_id,
    p_metadata || jsonb_build_object(
      'original_url', v_token_record.original_url,
      'link_text', v_token_record.link_text
    ),
    p_ip_address,
    p_user_agent,
    v_device_type,
    NOW()
  ) RETURNING id INTO v_event_id;

  -- Update token counts
  IF p_event_type = 'email_opened' THEN
    UPDATE tracking_tokens
    SET
      open_count = open_count + 1,
      first_opened_at = COALESCE(first_opened_at, NOW()),
      last_opened_at = NOW()
    WHERE id = v_token_record.id;
  ELSIF p_event_type = 'email_clicked' THEN
    UPDATE tracking_tokens
    SET click_count = click_count + 1
    WHERE id = v_token_record.id;
  END IF;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_tokens ENABLE ROW LEVEL SECURITY;

-- Engagement events: users can see their own events
CREATE POLICY engagement_events_user_policy ON engagement_events
  FOR ALL USING (user_id = auth.uid());

-- Webhooks: users can manage their own webhooks
CREATE POLICY outbound_webhooks_user_policy ON outbound_webhooks
  FOR ALL USING (user_id = auth.uid());

-- Deliveries: users can see deliveries for their webhooks
CREATE POLICY webhook_deliveries_user_policy ON webhook_deliveries
  FOR ALL USING (
    webhook_id IN (SELECT id FROM outbound_webhooks WHERE user_id = auth.uid())
  );

-- Tracking tokens: users can see their own tokens
CREATE POLICY tracking_tokens_user_policy ON tracking_tokens
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE engagement_events IS 'Stores all prospect engagement events (email opens, clicks, proposal views)';
COMMENT ON TABLE outbound_webhooks IS 'Configuration for pushing events to external systems (Zapier, Slack, CRM)';
COMMENT ON TABLE webhook_deliveries IS 'Audit log of all webhook delivery attempts with retry tracking';
COMMENT ON TABLE tracking_tokens IS 'Short tokens for tracking URLs, maps to full context for engagement recording';

COMMENT ON COLUMN engagement_events.event_type IS 'Type: email_opened, email_clicked, proposal_viewed, link_clicked, document_downloaded';
COMMENT ON COLUMN engagement_events.source_type IS 'Source: email, proposal, website, document';
COMMENT ON COLUMN engagement_events.processed IS 'Whether this event has been processed into a signal';

COMMENT ON COLUMN outbound_webhooks.auth_type IS 'Auth method: none, bearer, hmac, basic';
COMMENT ON COLUMN outbound_webhooks.event_types IS 'Array of event types to send, or [*] for all';
COMMENT ON COLUMN outbound_webhooks.consecutive_failures IS 'Count of consecutive failures, resets on success';
