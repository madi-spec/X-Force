-- Microsoft Graph Webhook Subscriptions
-- Tracks active webhook subscriptions for real-time email notifications

CREATE TABLE IF NOT EXISTS microsoft_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'created',
  expiration_date TIMESTAMPTZ NOT NULL,
  client_state TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for looking up subscriptions by user
CREATE INDEX IF NOT EXISTS idx_ms_subscriptions_user_id ON microsoft_subscriptions(user_id);

-- Index for looking up by subscription_id (used in webhook callbacks)
CREATE INDEX IF NOT EXISTS idx_ms_subscriptions_subscription_id ON microsoft_subscriptions(subscription_id);

-- Index for finding expired subscriptions
CREATE INDEX IF NOT EXISTS idx_ms_subscriptions_expiration ON microsoft_subscriptions(expiration_date)
  WHERE is_active = true;

-- System metrics table for tracking webhook health
CREATE TABLE IF NOT EXISTS system_metrics (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE microsoft_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to see their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON microsoft_subscriptions FOR SELECT
  USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

-- Service role can manage all
CREATE POLICY "Service role can manage subscriptions"
  ON microsoft_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage metrics"
  ON system_metrics FOR ALL
  USING (auth.role() = 'service_role');
