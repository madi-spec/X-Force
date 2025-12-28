-- =============================================
-- Phase 9: Webhooks & External Integrations
-- =============================================

-- Webhook Event Types
CREATE TYPE scheduler_webhook_event_type AS ENUM (
  'meeting.scheduled',
  'meeting.cancelled',
  'meeting.rescheduled',
  'meeting.completed',
  'meeting.no_show',
  'request.created',
  'request.status_changed',
  'request.paused',
  'request.resumed',
  'response.received',
  'response.positive',
  'response.negative',
  'attempt.sent',
  'attempt.failed',
  'channel.escalated'
);

-- Webhook Endpoints Table
CREATE TABLE IF NOT EXISTS scheduler_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Webhook configuration
  name VARCHAR(100) NOT NULL,
  description TEXT,
  url TEXT NOT NULL,

  -- Authentication
  secret_key VARCHAR(255), -- For HMAC signature verification
  auth_type VARCHAR(50) DEFAULT 'hmac' CHECK (auth_type IN ('none', 'hmac', 'bearer', 'basic')),
  auth_value TEXT, -- Bearer token or basic auth credentials (encrypted)

  -- Event subscription
  events scheduler_webhook_event_type[] NOT NULL DEFAULT '{}',

  -- Filtering (optional)
  filter_meeting_types TEXT[], -- Only trigger for specific meeting types
  filter_users UUID[], -- Only trigger for specific users' requests

  -- Headers
  custom_headers JSONB DEFAULT '{}'::jsonb,

  -- Retry configuration
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  timeout_seconds INTEGER DEFAULT 30,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE, -- Set after successful test delivery
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,

  -- Auto-disable after failures
  auto_disable_after_failures INTEGER DEFAULT 10,
  disabled_reason TEXT,

  -- Ownership
  created_by UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook Deliveries Log
CREATE TABLE IF NOT EXISTS scheduler_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  webhook_id UUID NOT NULL REFERENCES scheduler_webhooks(id) ON DELETE CASCADE,

  -- Event details
  event_type scheduler_webhook_event_type NOT NULL,
  event_id UUID, -- Reference to the triggering entity (request_id, meeting_id, etc.)

  -- Request details
  payload JSONB NOT NULL,
  request_headers JSONB,

  -- Response details
  response_status INTEGER,
  response_body TEXT,
  response_headers JSONB,
  response_time_ms INTEGER,

  -- Delivery status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  attempt_number INTEGER DEFAULT 1,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- API Keys Table
CREATE TABLE IF NOT EXISTS scheduler_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Key identification
  name VARCHAR(100) NOT NULL,
  description TEXT,
  key_prefix VARCHAR(8) NOT NULL, -- First 8 chars for identification (e.g., "sk_live_")
  key_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of the full key

  -- Permissions
  permissions JSONB DEFAULT '{
    "read": true,
    "create_requests": true,
    "update_requests": false,
    "cancel_requests": false,
    "manage_webhooks": false
  }'::jsonb,

  -- Restrictions
  allowed_ips TEXT[], -- NULL = all IPs allowed
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 10000,

  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  last_used_ip VARCHAR(45),
  total_requests INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ, -- NULL = never expires
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Ownership
  created_by UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_key_hash UNIQUE (key_hash)
);

-- API Key Usage Log (for rate limiting and auditing)
CREATE TABLE IF NOT EXISTS scheduler_api_key_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  api_key_id UUID NOT NULL REFERENCES scheduler_api_keys(id) ON DELETE CASCADE,

  -- Request details
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Response
  status_code INTEGER,
  response_time_ms INTEGER,

  -- Rate limiting window
  window_minute TIMESTAMPTZ, -- Truncated to minute for rate limiting

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON scheduler_webhooks(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON scheduler_webhooks USING GIN(events);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON scheduler_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON scheduler_webhook_deliveries(status) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON scheduler_webhook_deliveries(next_retry_at) WHERE status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON scheduler_webhook_deliveries(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON scheduler_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON scheduler_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON scheduler_api_key_usage(api_key_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_window ON scheduler_api_key_usage(api_key_id, window_minute);

-- Function to get webhooks for an event
CREATE OR REPLACE FUNCTION get_webhooks_for_event(
  p_event_type scheduler_webhook_event_type,
  p_meeting_type TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  secret_key VARCHAR,
  auth_type VARCHAR,
  auth_value TEXT,
  custom_headers JSONB,
  max_retries INTEGER,
  retry_delay_seconds INTEGER,
  timeout_seconds INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.url,
    w.secret_key,
    w.auth_type,
    w.auth_value,
    w.custom_headers,
    w.max_retries,
    w.retry_delay_seconds,
    w.timeout_seconds
  FROM scheduler_webhooks w
  WHERE w.is_active = TRUE
    AND p_event_type = ANY(w.events)
    AND (w.filter_meeting_types IS NULL OR p_meeting_type = ANY(w.filter_meeting_types))
    AND (w.filter_users IS NULL OR p_user_id = ANY(w.filter_users));
END;
$$ LANGUAGE plpgsql;

-- Function to record webhook delivery attempt
CREATE OR REPLACE FUNCTION record_webhook_delivery(
  p_webhook_id UUID,
  p_event_type scheduler_webhook_event_type,
  p_event_id UUID,
  p_payload JSONB,
  p_status VARCHAR,
  p_response_status INTEGER DEFAULT NULL,
  p_response_body TEXT DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_delivery_id UUID;
BEGIN
  INSERT INTO scheduler_webhook_deliveries (
    webhook_id,
    event_type,
    event_id,
    payload,
    status,
    response_status,
    response_body,
    response_time_ms,
    error_message,
    completed_at
  ) VALUES (
    p_webhook_id,
    p_event_type,
    p_event_id,
    p_payload,
    p_status,
    p_response_status,
    p_response_body,
    p_response_time_ms,
    p_error_message,
    CASE WHEN p_status IN ('success', 'failed') THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_delivery_id;

  -- Update webhook stats
  UPDATE scheduler_webhooks
  SET
    last_triggered_at = NOW(),
    last_success_at = CASE WHEN p_status = 'success' THEN NOW() ELSE last_success_at END,
    last_failure_at = CASE WHEN p_status = 'failed' THEN NOW() ELSE last_failure_at END,
    consecutive_failures = CASE
      WHEN p_status = 'success' THEN 0
      WHEN p_status = 'failed' THEN consecutive_failures + 1
      ELSE consecutive_failures
    END,
    -- Auto-disable if too many failures
    is_active = CASE
      WHEN p_status = 'failed' AND consecutive_failures + 1 >= auto_disable_after_failures
      THEN FALSE
      ELSE is_active
    END,
    disabled_reason = CASE
      WHEN p_status = 'failed' AND consecutive_failures + 1 >= auto_disable_after_failures
      THEN 'Auto-disabled after ' || auto_disable_after_failures || ' consecutive failures'
      ELSE disabled_reason
    END
  WHERE id = p_webhook_id;

  RETURN v_delivery_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check API key rate limit
CREATE OR REPLACE FUNCTION check_api_key_rate_limit(
  p_key_hash VARCHAR,
  p_ip_address VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  allowed BOOLEAN,
  api_key_id UUID,
  requests_this_minute INTEGER,
  requests_today INTEGER,
  limit_per_minute INTEGER,
  limit_per_day INTEGER
) AS $$
DECLARE
  v_key_record RECORD;
  v_minute_window TIMESTAMPTZ;
  v_day_start TIMESTAMPTZ;
  v_minute_count INTEGER;
  v_day_count INTEGER;
BEGIN
  -- Get API key
  SELECT * INTO v_key_record
  FROM scheduler_api_keys k
  WHERE k.key_hash = p_key_hash
    AND k.is_active = TRUE
    AND (k.expires_at IS NULL OR k.expires_at > NOW())
    AND k.revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 0, 0;
    RETURN;
  END IF;

  -- Check IP restrictions
  IF v_key_record.allowed_ips IS NOT NULL AND p_ip_address IS NOT NULL THEN
    IF NOT p_ip_address = ANY(v_key_record.allowed_ips) THEN
      RETURN QUERY SELECT FALSE, v_key_record.id, 0, 0, 0, 0;
      RETURN;
    END IF;
  END IF;

  -- Calculate rate limit windows
  v_minute_window := date_trunc('minute', NOW());
  v_day_start := date_trunc('day', NOW());

  -- Count requests this minute
  SELECT COUNT(*) INTO v_minute_count
  FROM scheduler_api_key_usage
  WHERE api_key_id = v_key_record.id
    AND window_minute = v_minute_window;

  -- Count requests today
  SELECT COUNT(*) INTO v_day_count
  FROM scheduler_api_key_usage
  WHERE api_key_id = v_key_record.id
    AND created_at >= v_day_start;

  -- Check limits
  RETURN QUERY SELECT
    (v_minute_count < v_key_record.rate_limit_per_minute AND v_day_count < v_key_record.rate_limit_per_day),
    v_key_record.id,
    v_minute_count,
    v_day_count,
    v_key_record.rate_limit_per_minute,
    v_key_record.rate_limit_per_day;
END;
$$ LANGUAGE plpgsql;

-- Function to record API key usage
CREATE OR REPLACE FUNCTION record_api_key_usage(
  p_api_key_id UUID,
  p_endpoint VARCHAR,
  p_method VARCHAR,
  p_ip_address VARCHAR DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_status_code INTEGER DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Insert usage record
  INSERT INTO scheduler_api_key_usage (
    api_key_id,
    endpoint,
    method,
    ip_address,
    user_agent,
    status_code,
    response_time_ms,
    window_minute
  ) VALUES (
    p_api_key_id,
    p_endpoint,
    p_method,
    p_ip_address,
    p_user_agent,
    p_status_code,
    p_response_time_ms,
    date_trunc('minute', NOW())
  );

  -- Update API key last used
  UPDATE scheduler_api_keys
  SET
    last_used_at = NOW(),
    last_used_ip = p_ip_address,
    total_requests = total_requests + 1
  WHERE id = p_api_key_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE TRIGGER trigger_webhooks_updated
  BEFORE UPDATE ON scheduler_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_scheduler_settings_timestamp();

CREATE TRIGGER trigger_api_keys_updated
  BEFORE UPDATE ON scheduler_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_scheduler_settings_timestamp();

-- Cleanup old delivery logs (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_deliveries()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM scheduler_webhook_deliveries
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND status IN ('success', 'failed');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old API usage logs (keep 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_api_usage()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM scheduler_api_key_usage
  WHERE created_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;
