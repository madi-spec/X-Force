-- Command Center Rich Context Enhancement
-- Adds columns for context enrichment, email drafts, scheduling, and action configuration

-- Add new columns to command_center_items
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS context_summary TEXT,
ADD COLUMN IF NOT EXISTS considerations TEXT[],
ADD COLUMN IF NOT EXISTS source_links JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS primary_contact JSONB,
ADD COLUMN IF NOT EXISTS email_draft JSONB,
ADD COLUMN IF NOT EXISTS schedule_suggestions JSONB,
ADD COLUMN IF NOT EXISTS available_actions TEXT[] DEFAULT ARRAY['complete'];

-- Add comments for documentation
COMMENT ON COLUMN command_center_items.context_summary IS 'AI-generated 2-3 sentence summary of why this action matters';
COMMENT ON COLUMN command_center_items.considerations IS 'Array of key considerations/warnings for this action';
COMMENT ON COLUMN command_center_items.source_links IS 'JSON array of {type, label, url} for related resources';
COMMENT ON COLUMN command_center_items.primary_contact IS 'JSON object with name, email, title of primary contact';
COMMENT ON COLUMN command_center_items.email_draft IS 'JSON object with subject, body, confidence for AI-generated draft';
COMMENT ON COLUMN command_center_items.schedule_suggestions IS 'JSON object with suggested_times, duration_minutes, meeting_title';
COMMENT ON COLUMN command_center_items.available_actions IS 'Array of available actions: complete, email, schedule, call';

-- Create index on available_actions for filtering
CREATE INDEX IF NOT EXISTS idx_command_center_items_available_actions
ON command_center_items USING GIN (available_actions);

-- Meeting prep storage table
CREATE TABLE IF NOT EXISTS meeting_prep (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meeting_id TEXT NOT NULL,
  meeting_external_id TEXT, -- Microsoft Graph event ID

  -- Meeting details
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  join_url TEXT,

  -- Context linking
  company_id UUID REFERENCES companies(id),
  deal_id UUID REFERENCES deals(id),

  -- Attendees with intelligence
  attendees JSONB DEFAULT '[]',
  -- Structure: [{email, name, title, role, relationship_notes}]

  -- AI-generated prep content
  objective TEXT,
  talking_points TEXT[],
  landmines TEXT[],
  questions_to_ask TEXT[],

  -- Prep materials
  prep_materials JSONB DEFAULT '[]',
  -- Structure: [{type, label, url}]

  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  last_refreshed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, meeting_id)
);

-- RLS for meeting_prep
ALTER TABLE meeting_prep ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meeting prep" ON meeting_prep
  FOR SELECT USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

CREATE POLICY "Users can manage own meeting prep" ON meeting_prep
  FOR ALL USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

CREATE POLICY "Service role full access to meeting_prep" ON meeting_prep
  FOR ALL USING (auth.role() = 'service_role');

-- Index for meeting lookup
CREATE INDEX IF NOT EXISTS idx_meeting_prep_user_meeting
ON meeting_prep(user_id, meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_prep_start_time
ON meeting_prep(user_id, start_time);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_meeting_prep_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_meeting_prep_updated_at
  BEFORE UPDATE ON meeting_prep
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_prep_updated_at();
