-- ============================================
-- MEETINGS PAGE REDESIGN - DATABASE MIGRATION
-- ============================================

-- 1. MEETINGS TABLE
-- Stores calendar meetings synced from external sources or created manually
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  meeting_type TEXT DEFAULT 'video' CHECK (meeting_type IN ('video', 'phone', 'in_person')),
  meeting_url TEXT,
  external_id TEXT, -- ID from external calendar (Google, Outlook, etc.)
  external_source TEXT, -- google, outlook, etc.
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  excluded BOOLEAN DEFAULT FALSE,
  excluded_at TIMESTAMPTZ,
  excluded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MEETING ATTENDEES TABLE
-- Tracks who is attending each meeting
CREATE TABLE IF NOT EXISTS meeting_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT,
  is_organizer BOOLEAN DEFAULT FALSE,
  response_status TEXT DEFAULT 'pending' CHECK (response_status IN ('pending', 'accepted', 'declined', 'tentative')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MEETING PREP TABLE
-- AI-generated preparation materials for upcoming meetings
CREATE TABLE IF NOT EXISTS meeting_prep (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  summary TEXT,
  key_points JSONB DEFAULT '[]'::jsonb,
  suggested_questions JSONB DEFAULT '[]'::jsonb,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id)
);

-- 4. TRANSCRIPTS TABLE (new version for meetings redesign)
-- Only create if it doesn't exist - may conflict with existing transcriptions table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_transcripts') THEN
    CREATE TABLE meeting_transcripts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
      title TEXT,
      source TEXT NOT NULL CHECK (source IN ('fireflies', 'manual', 'zoom', 'teams', 'google_meet')),
      external_id TEXT, -- ID from source system
      raw_content TEXT,
      word_count INTEGER DEFAULT 0,
      duration_seconds INTEGER,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'failed')),
      processing_progress INTEGER DEFAULT 0 CHECK (processing_progress >= 0 AND processing_progress <= 100),
      error_message TEXT,
      recorded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 5. TRANSCRIPT ANALYSIS TABLE (for meeting_transcripts)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_transcript_analysis') THEN
    CREATE TABLE meeting_transcript_analysis (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transcript_id UUID NOT NULL REFERENCES meeting_transcripts(id) ON DELETE CASCADE,
      summary TEXT,
      key_insights JSONB DEFAULT '[]'::jsonb,
      sentiment TEXT CHECK (sentiment IN ('very_positive', 'positive', 'neutral', 'negative', 'very_negative')),
      sentiment_score DECIMAL(3,2),
      signals_count INTEGER DEFAULT 0,
      signals JSONB DEFAULT '[]'::jsonb,
      topics JSONB DEFAULT '[]'::jsonb,
      speaker_breakdown JSONB DEFAULT '[]'::jsonb,
      full_analysis JSONB, -- Complete AI analysis output
      analyzed_at TIMESTAMPTZ DEFAULT NOW(),
      analyzed_by TEXT, -- AI model identifier
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(transcript_id)
    );
  END IF;
END $$;

-- 6. MEETING ACTION ITEMS TABLE
-- Tasks extracted from meetings or created manually
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  transcript_id UUID REFERENCES meeting_transcripts(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'manual' CHECK (source IN ('ai_generated', 'manual')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Meetings indexes
CREATE INDEX IF NOT EXISTS idx_meetings_org_start ON meetings(organization_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_org_excluded ON meetings(organization_id, excluded, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_customer ON meetings(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_external ON meetings(external_source, external_id) WHERE external_id IS NOT NULL;

-- Meeting attendees indexes
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting ON meeting_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_user ON meeting_attendees(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_email ON meeting_attendees(email);

-- Meeting transcripts indexes
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_org ON meeting_transcripts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_meeting ON meeting_transcripts(meeting_id) WHERE meeting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_status ON meeting_transcripts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_external ON meeting_transcripts(source, external_id) WHERE external_id IS NOT NULL;

-- Meeting action items indexes
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_org ON meeting_action_items(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting ON meeting_action_items(meeting_id) WHERE meeting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_transcript ON meeting_action_items(transcript_id) WHERE transcript_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_assignee ON meeting_action_items(assignee_id, status) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_status ON meeting_action_items(organization_id, status);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_prep_updated_at ON meeting_prep;
CREATE TRIGGER update_meeting_prep_updated_at
  BEFORE UPDATE ON meeting_prep
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_transcripts_updated_at ON meeting_transcripts;
CREATE TRIGGER update_meeting_transcripts_updated_at
  BEFORE UPDATE ON meeting_transcripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_transcript_analysis_updated_at ON meeting_transcript_analysis;
CREATE TRIGGER update_meeting_transcript_analysis_updated_at
  BEFORE UPDATE ON meeting_transcript_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_action_items_updated_at ON meeting_action_items;
CREATE TRIGGER update_meeting_action_items_updated_at
  BEFORE UPDATE ON meeting_action_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_prep ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_transcript_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

-- Meetings policies
DROP POLICY IF EXISTS "Users can view meetings in their organization" ON meetings;
CREATE POLICY "Users can view meetings in their organization"
  ON meetings FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert meetings in their organization" ON meetings;
CREATE POLICY "Users can insert meetings in their organization"
  ON meetings FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update meetings in their organization" ON meetings;
CREATE POLICY "Users can update meetings in their organization"
  ON meetings FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can delete meetings in their organization" ON meetings;
CREATE POLICY "Users can delete meetings in their organization"
  ON meetings FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

-- Meeting attendees policies
DROP POLICY IF EXISTS "Users can view meeting attendees for accessible meetings" ON meeting_attendees;
CREATE POLICY "Users can view meeting attendees for accessible meetings"
  ON meeting_attendees FOR SELECT
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can manage meeting attendees for accessible meetings" ON meeting_attendees;
CREATE POLICY "Users can manage meeting attendees for accessible meetings"
  ON meeting_attendees FOR ALL
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));

-- Meeting prep policies
DROP POLICY IF EXISTS "Users can view meeting prep for accessible meetings" ON meeting_prep;
CREATE POLICY "Users can view meeting prep for accessible meetings"
  ON meeting_prep FOR SELECT
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can manage meeting prep for accessible meetings" ON meeting_prep;
CREATE POLICY "Users can manage meeting prep for accessible meetings"
  ON meeting_prep FOR ALL
  USING (meeting_id IN (
    SELECT id FROM meetings WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));

-- Meeting transcripts policies
DROP POLICY IF EXISTS "Users can view transcripts in their organization" ON meeting_transcripts;
CREATE POLICY "Users can view transcripts in their organization"
  ON meeting_transcripts FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can manage transcripts in their organization" ON meeting_transcripts;
CREATE POLICY "Users can manage transcripts in their organization"
  ON meeting_transcripts FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

-- Meeting transcript analysis policies
DROP POLICY IF EXISTS "Users can view analysis for accessible transcripts" ON meeting_transcript_analysis;
CREATE POLICY "Users can view analysis for accessible transcripts"
  ON meeting_transcript_analysis FOR SELECT
  USING (transcript_id IN (
    SELECT id FROM meeting_transcripts WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can manage analysis for accessible transcripts" ON meeting_transcript_analysis;
CREATE POLICY "Users can manage analysis for accessible transcripts"
  ON meeting_transcript_analysis FOR ALL
  USING (transcript_id IN (
    SELECT id FROM meeting_transcripts WHERE organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  ));

-- Meeting action items policies
DROP POLICY IF EXISTS "Users can view action items in their organization" ON meeting_action_items;
CREATE POLICY "Users can view action items in their organization"
  ON meeting_action_items FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can manage action items in their organization" ON meeting_action_items;
CREATE POLICY "Users can manage action items in their organization"
  ON meeting_action_items FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));
