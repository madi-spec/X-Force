-- Microsoft 365 Integration Schema
-- Stores OAuth tokens and connection state for Microsoft Graph API

-- Microsoft connections table
CREATE TABLE microsoft_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  microsoft_user_id VARCHAR(255),
  email VARCHAR(255),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_microsoft_connections_user_id ON microsoft_connections(user_id);
CREATE INDEX idx_microsoft_connections_is_active ON microsoft_connections(is_active);

-- Add external_id to activities for deduplication of synced emails/events
ALTER TABLE activities ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_external_id ON activities(external_id) WHERE external_id IS NOT NULL;

-- RLS policies for microsoft_connections
ALTER TABLE microsoft_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own connection
CREATE POLICY microsoft_connections_select ON microsoft_connections
  FOR SELECT USING (user_id = get_current_user_id() OR is_admin());

-- Users can only insert their own connection
CREATE POLICY microsoft_connections_insert ON microsoft_connections
  FOR INSERT WITH CHECK (user_id = get_current_user_id());

-- Users can only update their own connection
CREATE POLICY microsoft_connections_update ON microsoft_connections
  FOR UPDATE USING (user_id = get_current_user_id());

-- Users can only delete their own connection
CREATE POLICY microsoft_connections_delete ON microsoft_connections
  FOR DELETE USING (user_id = get_current_user_id());

-- Add new activity types for email
DO $$
BEGIN
  -- Check if enum value exists before adding
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'email_sent' AND enumtypid = 'activity_type'::regtype) THEN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'email_sent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'email_received' AND enumtypid = 'activity_type'::regtype) THEN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'email_received';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'calendar_event' AND enumtypid = 'activity_type'::regtype) THEN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'calendar_event';
  END IF;
END$$;
