-- Contact Relationship Intelligence Migration
-- Enables AI-detected contacts from transcripts with relationship facts

-- ============================================
-- EXTEND CONTACTS TABLE
-- ============================================

-- Add relationship intelligence fields to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS relationship_facts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS communication_style JSONB DEFAULT '{}'::jsonb;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_detected_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_detection_source TEXT CHECK (ai_detection_source IN ('meeting', 'email', 'manual'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2) CHECK (ai_confidence >= 0 AND ai_confidence <= 1);

-- Index for AI-detected contacts
CREATE INDEX IF NOT EXISTS idx_contacts_ai_detected ON contacts(ai_detected_at) WHERE ai_detected_at IS NOT NULL;

-- ============================================
-- CONTACT MEETING MENTIONS TABLE
-- ============================================

-- Track which meetings a contact was detected/mentioned in
CREATE TABLE IF NOT EXISTS contact_meeting_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  transcription_id UUID NOT NULL REFERENCES meeting_transcriptions(id) ON DELETE CASCADE,

  -- Detection details from this meeting
  role_detected TEXT,
  deal_role_detected TEXT CHECK (deal_role_detected IN ('decision_maker', 'influencer', 'champion', 'end_user', 'blocker')),
  sentiment_detected TEXT CHECK (sentiment_detected IN ('positive', 'neutral', 'negative')),

  -- Quotes and facts from this specific meeting
  key_quotes JSONB DEFAULT '[]'::jsonb,
  facts_extracted JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate entries for same contact/meeting
  UNIQUE(contact_id, transcription_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_contact_mentions_contact ON contact_meeting_mentions(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_mentions_transcription ON contact_meeting_mentions(transcription_id);
CREATE INDEX IF NOT EXISTS idx_contact_mentions_created ON contact_meeting_mentions(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new table
ALTER TABLE contact_meeting_mentions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read contact mentions
CREATE POLICY contact_mentions_select ON contact_meeting_mentions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert contact mentions
CREATE POLICY contact_mentions_insert ON contact_meeting_mentions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update contact mentions
CREATE POLICY contact_mentions_update ON contact_meeting_mentions
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to delete contact mentions
CREATE POLICY contact_mentions_delete ON contact_meeting_mentions
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN contacts.relationship_facts IS 'AI-extracted personal facts for relationship building (JSON array)';
COMMENT ON COLUMN contacts.communication_style IS 'AI-detected communication preferences (JSON object)';
COMMENT ON COLUMN contacts.ai_detected_at IS 'When this contact was first detected by AI';
COMMENT ON COLUMN contacts.ai_detection_source IS 'Source of AI detection: meeting, email, or manual';
COMMENT ON COLUMN contacts.ai_confidence IS 'AI confidence score for contact detection (0-1)';

COMMENT ON TABLE contact_meeting_mentions IS 'Tracks contact mentions across meeting transcriptions for provenance';
COMMENT ON COLUMN contact_meeting_mentions.key_quotes IS 'Notable quotes from this person in this meeting';
COMMENT ON COLUMN contact_meeting_mentions.facts_extracted IS 'Personal facts detected in this specific meeting';
