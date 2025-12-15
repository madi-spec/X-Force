-- Meeting Transcriptions Table
-- Stores uploaded meeting transcriptions and their AI analysis

CREATE TABLE meeting_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linked entities
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) NOT NULL,

  -- Meeting info
  title VARCHAR(255) NOT NULL,
  meeting_date DATE NOT NULL,
  duration_minutes INTEGER,
  attendees TEXT[],

  -- Transcription
  transcription_text TEXT NOT NULL,
  transcription_format VARCHAR(50), -- 'plain', 'vtt', 'srt', 'teams', 'zoom'
  word_count INTEGER,

  -- AI Analysis (stored as JSONB)
  analysis JSONB,
  analysis_generated_at TIMESTAMP WITH TIME ZONE,

  -- Generated content
  summary TEXT,
  follow_up_email_draft TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX idx_meeting_transcriptions_deal ON meeting_transcriptions(deal_id);
CREATE INDEX idx_meeting_transcriptions_company ON meeting_transcriptions(company_id);
CREATE INDEX idx_meeting_transcriptions_user ON meeting_transcriptions(user_id);
CREATE INDEX idx_meeting_transcriptions_date ON meeting_transcriptions(meeting_date);
CREATE INDEX idx_meeting_transcriptions_created ON meeting_transcriptions(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_meeting_transcriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_meeting_transcriptions_updated_at
  BEFORE UPDATE ON meeting_transcriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_transcriptions_updated_at();

-- Row Level Security
ALTER TABLE meeting_transcriptions ENABLE ROW LEVEL SECURITY;

-- Users can view transcriptions they created
CREATE POLICY "Users can view their own transcriptions"
  ON meeting_transcriptions FOR SELECT
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE id = meeting_transcriptions.user_id
    )
  );

-- Users can view transcriptions for deals they own or collaborate on
CREATE POLICY "Users can view transcriptions for their deals"
  ON meeting_transcriptions FOR SELECT
  USING (
    deal_id IS NOT NULL AND (
      -- Deal owner
      auth.uid() IN (
        SELECT u.auth_id FROM users u
        JOIN deals d ON d.owner_id = u.id
        WHERE d.id = meeting_transcriptions.deal_id
      )
      OR
      -- Deal collaborator
      auth.uid() IN (
        SELECT u.auth_id FROM users u
        JOIN deal_collaborators dc ON dc.user_id = u.id
        WHERE dc.deal_id = meeting_transcriptions.deal_id
      )
    )
  );

-- Users can insert their own transcriptions
CREATE POLICY "Users can insert their own transcriptions"
  ON meeting_transcriptions FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE id = user_id
    )
  );

-- Users can update their own transcriptions
CREATE POLICY "Users can update their own transcriptions"
  ON meeting_transcriptions FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE id = meeting_transcriptions.user_id
    )
  );

-- Users can delete their own transcriptions
CREATE POLICY "Users can delete their own transcriptions"
  ON meeting_transcriptions FOR DELETE
  USING (
    auth.uid() IN (
      SELECT auth_id FROM users WHERE id = meeting_transcriptions.user_id
    )
  );
