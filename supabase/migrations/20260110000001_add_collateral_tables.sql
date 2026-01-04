-- ============================================
-- MEETING PREP HUB - PHASE 1
-- Collateral Library, Software Links, Meeting Prep Notes
-- ============================================

-- ============================================
-- COLLATERAL LIBRARY
-- ============================================

CREATE TABLE IF NOT EXISTS collateral (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- File storage (Supabase Storage)
  file_path TEXT,                     -- Storage path (null if external link)
  file_name VARCHAR(255),
  file_type VARCHAR(50) NOT NULL,     -- pdf, docx, pptx, html, link
  file_size INTEGER,
  thumbnail_path TEXT,

  -- External link (alternative to file)
  external_url TEXT,                  -- If type is 'link'

  -- Categorization
  document_type VARCHAR(50) NOT NULL,
  -- Values: 'one_pager', 'case_study', 'pricing', 'proposal_template',
  -- 'implementation_guide', 'technical_doc', 'demo_script',
  -- 'roi_calculator', 'contract', 'presentation', 'video', 'other'

  -- Smart matching tags (arrays for flexible querying)
  meeting_types TEXT[] DEFAULT '{}',
  -- Values: 'discovery', 'demo', 'technical_deep_dive', 'proposal',
  -- 'trial_kickoff', 'implementation', 'check_in', 'executive'

  products TEXT[] DEFAULT '{}',
  -- Values: 'voice_agent', 'performance_center', 'action_hub',
  -- 'accountability_hub', 'call_analytics', 'platform'

  industries TEXT[] DEFAULT '{}',
  -- Values: 'pest_control', 'lawn_care', 'hvac', 'plumbing', 'general'

  company_sizes TEXT[] DEFAULT '{}',
  -- Values: 'smb', 'mid_market', 'enterprise', 'pe_platform'

  -- Versioning
  version VARCHAR(20) DEFAULT '1.0',
  is_current BOOLEAN DEFAULT true,
  previous_version_id UUID REFERENCES collateral(id),

  -- Usage tracking
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Ownership
  visibility VARCHAR(20) DEFAULT 'team',
  created_by UUID REFERENCES users(id),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_collateral_meeting_types ON collateral USING GIN(meeting_types);
CREATE INDEX IF NOT EXISTS idx_collateral_products ON collateral USING GIN(products);
CREATE INDEX IF NOT EXISTS idx_collateral_industries ON collateral USING GIN(industries);
CREATE INDEX IF NOT EXISTS idx_collateral_document_type ON collateral(document_type);
CREATE INDEX IF NOT EXISTS idx_collateral_is_current ON collateral(is_current) WHERE is_current = true AND archived_at IS NULL;


-- ============================================
-- COLLATERAL USAGE TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS collateral_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id UUID REFERENCES collateral(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  meeting_id VARCHAR(255),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL,  -- 'viewed', 'downloaded', 'shared', 'copied_link'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collateral_usage_collateral ON collateral_usage(collateral_id);
CREATE INDEX IF NOT EXISTS idx_collateral_usage_deal ON collateral_usage(deal_id);


-- ============================================
-- SOFTWARE ACCESS LINKS
-- ============================================

CREATE TABLE IF NOT EXISTS software_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  icon VARCHAR(50),  -- Lucide icon name

  -- Context for when to show
  show_for_meeting_types TEXT[] DEFAULT '{}',
  show_for_products TEXT[] DEFAULT '{}',
  show_for_deal_stages TEXT[] DEFAULT '{}',

  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default demo environment link
INSERT INTO software_links (name, description, url, icon, show_for_meeting_types, sort_order)
VALUES ('Demo Environment', 'Main demo login', 'https://demo.xrai.com', 'Monitor', ARRAY['demo', 'discovery'], 1)
ON CONFLICT DO NOTHING;


-- ============================================
-- MEETING PREP NOTES (persisted)
-- ============================================

CREATE TABLE IF NOT EXISTS meeting_prep_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  meeting_id VARCHAR(255) NOT NULL,   -- Microsoft Graph meeting ID
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Content
  prep_notes TEXT,      -- Notes before meeting
  meeting_notes TEXT,   -- Notes during/after

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_prep_notes_unique ON meeting_prep_notes(meeting_id, user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_prep_notes_deal ON meeting_prep_notes(deal_id);
CREATE INDEX IF NOT EXISTS idx_meeting_prep_notes_company ON meeting_prep_notes(company_id);


-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE collateral ENABLE ROW LEVEL SECURITY;
ALTER TABLE collateral_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_prep_notes ENABLE ROW LEVEL SECURITY;

-- Collateral: team visibility (all authenticated users can see team collateral)
DROP POLICY IF EXISTS "Users can view team collateral" ON collateral;
CREATE POLICY "Users can view team collateral" ON collateral
  FOR SELECT USING (visibility = 'team' AND archived_at IS NULL);

DROP POLICY IF EXISTS "Users can insert collateral" ON collateral;
CREATE POLICY "Users can insert collateral" ON collateral
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update own collateral" ON collateral;
CREATE POLICY "Users can update own collateral" ON collateral
  FOR UPDATE USING (auth.uid() = created_by);

-- Collateral usage: users see their own
DROP POLICY IF EXISTS "Users can view own usage" ON collateral_usage;
CREATE POLICY "Users can view own usage" ON collateral_usage
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert usage" ON collateral_usage;
CREATE POLICY "Users can insert usage" ON collateral_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Software links: all users can view active
DROP POLICY IF EXISTS "Users can view active software links" ON software_links;
CREATE POLICY "Users can view active software links" ON software_links
  FOR SELECT USING (is_active = true);

-- Meeting prep notes: users see their own
DROP POLICY IF EXISTS "Users can manage own prep notes" ON meeting_prep_notes;
CREATE POLICY "Users can manage own prep notes" ON meeting_prep_notes
  FOR ALL USING (auth.uid() = user_id);


-- ============================================
-- UPDATE TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_collateral_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS collateral_updated_at ON collateral;
CREATE TRIGGER collateral_updated_at
  BEFORE UPDATE ON collateral
  FOR EACH ROW
  EXECUTE FUNCTION update_collateral_updated_at();

DROP TRIGGER IF EXISTS software_links_updated_at ON software_links;
CREATE TRIGGER software_links_updated_at
  BEFORE UPDATE ON software_links
  FOR EACH ROW
  EXECUTE FUNCTION update_collateral_updated_at();

DROP TRIGGER IF EXISTS meeting_prep_notes_updated_at ON meeting_prep_notes;
CREATE TRIGGER meeting_prep_notes_updated_at
  BEFORE UPDATE ON meeting_prep_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_collateral_updated_at();
