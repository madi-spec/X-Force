-- Relationship Intelligence Full Schema
-- Builds on 20251217_contact_relationship_intelligence.sql
-- Adds cumulative context tracking for contacts and companies

-- ============================================
-- RELATIONSHIP INTELLIGENCE TABLE
-- ============================================
-- Cumulative intelligence record per contact+company pair

CREATE TABLE IF NOT EXISTS relationship_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity (one or both may be set)
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  -- Cumulative context (grows over time)
  context JSONB DEFAULT '{}'::jsonb,
  -- Structure:
  -- {
  --   "company_profile": { name, industry, size, location, description, recent_news[], tech_stack[], competitors[], key_people[] },
  --   "key_facts": [{ fact, source, source_id, date }],
  --   "stakeholders": [{ name, title, role, sentiment, notes }],
  --   "preferences": { preferred_channel, best_time_to_reach, communication_style, response_pattern }
  -- }

  -- Interaction timeline (array of all interactions)
  interactions JSONB DEFAULT '[]'::jsonb,
  -- Structure per interaction:
  -- {
  --   id, type, date, summary, analysis_id,
  --   key_points[], commitments_made[], commitments_received[],
  --   buying_signals[], concerns[], sentiment
  -- }

  -- Active commitments tracking
  open_commitments JSONB DEFAULT '{"ours": [], "theirs": []}'::jsonb,
  -- Structure:
  -- {
  --   "ours": [{ commitment, made_on, due_by, source_type, source_id, status }],
  --   "theirs": [{ commitment, made_on, expected_by, source_type, source_id, status }]
  -- }

  -- Cumulative signals
  signals JSONB DEFAULT '{"buying_signals": [], "concerns": [], "objections": []}'::jsonb,
  -- Structure:
  -- {
  --   "buying_signals": [{ signal, quote, strength, date, source_id }],
  --   "concerns": [{ concern, severity, resolved, resolution, date, source_id }],
  --   "objections": [{ objection, response_given, outcome, date, source_id }]
  -- }

  -- Aggregated metrics
  metrics JSONB DEFAULT '{}'::jsonb,
  -- Structure:
  -- {
  --   total_interactions, days_in_relationship, average_response_time_hours,
  --   last_contact_date, overall_sentiment_trend, engagement_score
  -- }

  -- AI-generated relationship summary (regenerated periodically)
  relationship_summary TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure uniqueness per contact+company pair
  UNIQUE(contact_id, company_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_relationship_intelligence_contact
  ON relationship_intelligence(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_relationship_intelligence_company
  ON relationship_intelligence(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_relationship_intelligence_updated
  ON relationship_intelligence(updated_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_relationship_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS relationship_intelligence_updated_at ON relationship_intelligence;
CREATE TRIGGER relationship_intelligence_updated_at
  BEFORE UPDATE ON relationship_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_relationship_intelligence_updated_at();


-- ============================================
-- RELATIONSHIP NOTES TABLE
-- ============================================
-- Manual notes added by salespeople for context

CREATE TABLE IF NOT EXISTS relationship_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linking (one or both may be set)
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  -- Note content
  note TEXT NOT NULL,
  context_type VARCHAR(50) DEFAULT 'general',
  -- Types: 'strategy', 'insight', 'warning', 'general'

  -- Who added it
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMPTZ DEFAULT NOW(),

  -- Optional link to specific item that triggered this note
  linked_item_id UUID REFERENCES command_center_items(id) ON DELETE SET NULL,
  linked_source_type VARCHAR(50),  -- 'email', 'transcript', 'deal'
  linked_source_id UUID
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_relationship_notes_contact
  ON relationship_notes(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_relationship_notes_company
  ON relationship_notes(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_relationship_notes_added
  ON relationship_notes(added_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_notes_item
  ON relationship_notes(linked_item_id) WHERE linked_item_id IS NOT NULL;


-- ============================================
-- EMAIL MESSAGES: Add relationship tracking columns
-- ============================================

-- Add commitment tracking (for outbound email analysis)
ALTER TABLE email_messages
ADD COLUMN IF NOT EXISTS commitments_extracted JSONB;

COMMENT ON COLUMN email_messages.commitments_extracted IS 'Commitments we made in outbound emails: [{commitment, deadline_mentioned, inferred_due_date}]';

-- Add relationship update tracking
ALTER TABLE email_messages
ADD COLUMN IF NOT EXISTS relationship_updated BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN email_messages.relationship_updated IS 'Whether this email has been processed to update relationship_intelligence';

-- Add processed_for_cc flag for command center processing
ALTER TABLE email_messages
ADD COLUMN IF NOT EXISTS processed_for_cc BOOLEAN DEFAULT FALSE;

ALTER TABLE email_messages
ADD COLUMN IF NOT EXISTS cc_processed_at TIMESTAMPTZ;

COMMENT ON COLUMN email_messages.processed_for_cc IS 'Whether this email has been processed to create command center items';

-- Index for finding emails that need relationship processing
CREATE INDEX IF NOT EXISTS idx_email_messages_relationship_pending
ON email_messages(user_id, is_sent_by_user, relationship_updated)
WHERE relationship_updated = FALSE;


-- ============================================
-- COMMAND CENTER ITEMS: Add reanalysis tracking
-- ============================================

-- Add reanalysis columns
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS reanalyzed_at TIMESTAMPTZ;

ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS reanalyzed_with_context TEXT;

ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS manual_context_added TEXT;

COMMENT ON COLUMN command_center_items.reanalyzed_at IS 'When this item was last re-analyzed with additional context';
COMMENT ON COLUMN command_center_items.reanalyzed_with_context IS 'The manual context that was added before re-analysis';
COMMENT ON COLUMN command_center_items.manual_context_added IS 'Latest manual note added by salesperson';

-- Add transcription reference if not exists
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS transcription_id UUID REFERENCES meeting_transcriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_command_center_items_transcription
  ON command_center_items(transcription_id) WHERE transcription_id IS NOT NULL;


-- ============================================
-- MEETING TRANSCRIPTIONS: Add CC tracking
-- ============================================

ALTER TABLE meeting_transcriptions
ADD COLUMN IF NOT EXISTS cc_items_created BOOLEAN DEFAULT FALSE;

ALTER TABLE meeting_transcriptions
ADD COLUMN IF NOT EXISTS cc_processed_at TIMESTAMPTZ;

COMMENT ON COLUMN meeting_transcriptions.cc_items_created IS 'Whether command center items have been created from this transcript';


-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE relationship_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_notes ENABLE ROW LEVEL SECURITY;

-- Relationship Intelligence: All authenticated users can read
-- (Filtered by contact/company access in app layer)
CREATE POLICY relationship_intelligence_select ON relationship_intelligence
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY relationship_intelligence_insert ON relationship_intelligence
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY relationship_intelligence_update ON relationship_intelligence
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY relationship_intelligence_delete ON relationship_intelligence
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Relationship Notes: User-based access
CREATE POLICY relationship_notes_select ON relationship_notes
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY relationship_notes_insert ON relationship_notes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY relationship_notes_update ON relationship_notes
  FOR UPDATE USING (auth.uid() IS NOT NULL OR auth.uid() = added_by);

CREATE POLICY relationship_notes_delete ON relationship_notes
  FOR DELETE USING (auth.uid() = added_by);

-- Service role bypass for cron jobs
CREATE POLICY "Service role has full access to relationship_intelligence"
  ON relationship_intelligence FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role has full access to relationship_notes"
  ON relationship_notes FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================
-- HELPER VIEWS
-- ============================================

-- View to get relationship context for a contact
CREATE OR REPLACE VIEW contact_relationship_context AS
SELECT
  c.id as contact_id,
  c.name as contact_name,
  c.email as contact_email,
  c.title as contact_title,
  c.company_id,
  co.name as company_name,
  co.industry,
  co.segment,
  ri.relationship_summary,
  ri.context,
  ri.interactions,
  ri.open_commitments,
  ri.signals,
  ri.metrics,
  ri.updated_at as intelligence_updated_at,
  (SELECT COUNT(*) FROM relationship_notes rn WHERE rn.contact_id = c.id) as note_count,
  (SELECT MAX(added_at) FROM relationship_notes rn WHERE rn.contact_id = c.id) as last_note_at
FROM contacts c
LEFT JOIN companies co ON c.company_id = co.id
LEFT JOIN relationship_intelligence ri ON ri.contact_id = c.id;


-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE relationship_intelligence IS 'Cumulative intelligence record tracking all interactions, signals, and context for a contact/company relationship';
COMMENT ON TABLE relationship_notes IS 'Manual notes added by salespeople to provide context for AI analysis';
COMMENT ON COLUMN relationship_intelligence.context IS 'Company profile, key facts learned, stakeholders identified, communication preferences';
COMMENT ON COLUMN relationship_intelligence.interactions IS 'Timeline of all interactions (emails, calls, meetings) with summaries and extracted data';
COMMENT ON COLUMN relationship_intelligence.open_commitments IS 'Active commitments - ours to them and theirs to us - with status tracking';
COMMENT ON COLUMN relationship_intelligence.signals IS 'Cumulative buying signals, concerns, and objections detected across all interactions';
COMMENT ON COLUMN relationship_intelligence.relationship_summary IS 'AI-generated summary of the relationship, regenerated periodically';
