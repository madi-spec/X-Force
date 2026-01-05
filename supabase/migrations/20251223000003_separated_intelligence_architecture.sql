-- =====================================================
-- SEPARATED INTELLIGENCE ARCHITECTURE
-- Phase 1: Raw Data Collection (no analysis)
-- Phase 2: User Review & Edit
-- Phase 3: AI Analysis (user-triggered)
-- =====================================================

-- Drop old tables if they exist (we're replacing them)
-- Note: In production, you'd want to migrate data first
DROP TABLE IF EXISTS company_intelligence_analysis CASCADE;
DROP TABLE IF EXISTS company_intelligence_edits CASCADE;
DROP TABLE IF EXISTS company_intelligence_raw CASCADE;

-- =====================================================
-- RAW DATA TABLE
-- Stores ONLY collected data - no analysis/insights
-- =====================================================

CREATE TABLE company_intelligence_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  -- =====================
  -- IDENTITY
  -- =====================
  company_name JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  dba_names JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  former_names JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  website JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- FOUNDING & HISTORY
  -- =====================
  year_founded JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  founded_by JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  founding_story JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  founding_city JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  founding_state JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- OWNERSHIP
  -- =====================
  ownership_type JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  owner_name JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  owner_title JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  family_generation JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  pe_firm_name JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  franchise_brand JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- SIZE & SCALE
  -- =====================
  employee_count JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  location_count JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  states_served JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  estimated_revenue JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  revenue_range JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- HEADQUARTERS
  -- =====================
  hq_address JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  hq_city JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  hq_state JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  hq_zip JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- LEADERSHIP TEAM
  -- Array of { name, title, email, phone, linkedin, bio, isOwner, isFamily, isDecisionMaker }
  -- =====================
  leadership_team JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- SERVICES
  -- =====================
  services_offered JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  specializations JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  industries_served JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- ONLINE PRESENCE
  -- =====================
  google_rating JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  google_review_count JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  google_place_id JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  linkedin_url JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  linkedin_followers JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  facebook_url JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  facebook_followers JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  facebook_rating JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  twitter_url JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  instagram_url JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  youtube_url JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- REPUTATION
  -- =====================
  bbb_rating JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  bbb_accredited JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  yelp_rating JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  yelp_review_count JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- AWARDS & RECOGNITION
  -- Array of { name, year, rank, issuer, personHonored, sourceUrl }
  -- =====================
  awards JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  certifications JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- TECHNOLOGY
  -- Array of { name, category, confidence, evidence, sourceUrl }
  -- =====================
  tech_stack JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  has_customer_portal JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  has_online_scheduling JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  has_mobile_app JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- M&A ACTIVITY
  -- Array of { companyName, year, type, sourceUrl }
  -- =====================
  acquisitions_made JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  was_acquired JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  acquired_by JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  acquisition_year JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- GROWTH SIGNALS
  -- =====================
  is_hiring JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  open_positions JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  recent_expansions JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- CONTENT & CULTURE
  -- =====================
  tagline JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  company_values JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  mission_statement JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  key_quotes JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  differentiators JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- CONTACT
  -- =====================
  main_phone JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,
  main_email JSONB DEFAULT '{"value": null, "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- ASSOCIATION MEMBERSHIPS
  -- Array of { name, role, isBoardMember }
  -- =====================
  association_memberships JSONB DEFAULT '{"value": [], "source": null, "sourceUrl": null, "confidence": "low", "verified": false}'::jsonb,

  -- =====================
  -- METADATA
  -- =====================
  collection_status TEXT DEFAULT 'pending' CHECK (collection_status IN ('pending', 'collecting', 'collected', 'reviewed', 'verified', 'failed')),
  data_completeness INTEGER DEFAULT 0 CHECK (data_completeness >= 0 AND data_completeness <= 100),
  collected_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  sources_used TEXT[] DEFAULT ARRAY[]::TEXT[],
  collection_notes TEXT[] DEFAULT ARRAY[]::TEXT[],
  user_notes TEXT[] DEFAULT ARRAY[]::TEXT[],
  collection_errors TEXT[] DEFAULT ARRAY[]::TEXT[],

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(company_id)
);

-- =====================================================
-- FIELD EDIT HISTORY
-- Track all user edits for audit trail
-- =====================================================

CREATE TABLE company_intelligence_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_id UUID REFERENCES company_intelligence_raw(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  edited_by UUID REFERENCES auth.users(id),
  edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  edit_reason TEXT
);

-- =====================================================
-- AI ANALYSIS TABLE
-- Stores AI-generated insights - SEPARATE from raw data
-- Only created when user triggers "Generate Insights"
-- =====================================================

CREATE TABLE company_intelligence_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  raw_id UUID REFERENCES company_intelligence_raw(id) ON DELETE SET NULL,

  -- =====================
  -- SIGNALS DETECTED
  -- =====================
  signals JSONB DEFAULT '{}'::jsonb,

  -- =====================
  -- POSITIONING
  -- =====================
  primary_positioning TEXT,
  positioning_emoji TEXT,
  secondary_positioning TEXT[] DEFAULT ARRAY[]::TEXT[],
  classification_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  signal_summary TEXT,

  -- =====================
  -- SALES APPROACH
  -- =====================
  why_they_buy TEXT,
  key_messages TEXT[] DEFAULT ARRAY[]::TEXT[],
  entry_point TEXT,
  best_timing TEXT,
  target_roles TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- =====================
  -- TALKING POINTS
  -- Array of { point, dataReference }
  -- =====================
  talking_points JSONB DEFAULT '[]'::jsonb,

  -- =====================
  -- OBJECTIONS
  -- Array of { objection, response }
  -- =====================
  likely_objections JSONB DEFAULT '[]'::jsonb,

  -- =====================
  -- QUESTIONS & PREP
  -- =====================
  questions_to_ask TEXT[] DEFAULT ARRAY[]::TEXT[],
  things_to_avoid TEXT[] DEFAULT ARRAY[]::TEXT[],
  call_prep_checklist TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- =====================
  -- FULL REPORT
  -- =====================
  full_report_markdown TEXT,

  -- =====================
  -- METADATA
  -- =====================
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id),
  data_snapshot JSONB, -- Snapshot of raw data used for analysis
  generation_model TEXT DEFAULT 'claude-sonnet-4-20250514',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(company_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_raw_company_id ON company_intelligence_raw(company_id);
CREATE INDEX idx_raw_collection_status ON company_intelligence_raw(collection_status);
CREATE INDEX idx_raw_collected_at ON company_intelligence_raw(collected_at);

CREATE INDEX idx_edits_raw_id ON company_intelligence_edits(raw_id);
CREATE INDEX idx_edits_company_id ON company_intelligence_edits(company_id);
CREATE INDEX idx_edits_edited_at ON company_intelligence_edits(edited_at);

CREATE INDEX idx_analysis_company_id ON company_intelligence_analysis(company_id);
CREATE INDEX idx_analysis_raw_id ON company_intelligence_analysis(raw_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE company_intelligence_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_intelligence_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_intelligence_analysis ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write their organization's data
CREATE POLICY "Users can view company intelligence raw" ON company_intelligence_raw
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert company intelligence raw" ON company_intelligence_raw
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update company intelligence raw" ON company_intelligence_raw
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view edits" ON company_intelligence_edits
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert edits" ON company_intelligence_edits
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can view analysis" ON company_intelligence_analysis
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert analysis" ON company_intelligence_analysis
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update analysis" ON company_intelligence_analysis
  FOR UPDATE TO authenticated USING (true);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp on raw data changes
CREATE OR REPLACE FUNCTION update_raw_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_raw_updated_at
  BEFORE UPDATE ON company_intelligence_raw
  FOR EACH ROW
  EXECUTE FUNCTION update_raw_updated_at();

-- Update timestamp on analysis changes
CREATE TRIGGER trigger_analysis_updated_at
  BEFORE UPDATE ON company_intelligence_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_raw_updated_at();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to calculate data completeness
CREATE OR REPLACE FUNCTION calculate_raw_completeness(raw_row company_intelligence_raw)
RETURNS INTEGER AS $$
DECLARE
  total_fields INTEGER := 0;
  filled_fields INTEGER := 0;
  field_value JSONB;
BEGIN
  -- Check each important field
  -- Identity
  IF (raw_row.company_name->>'value') IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  IF (raw_row.website->>'value') IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  -- Founding
  IF (raw_row.year_founded->>'value') IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  -- Ownership
  IF (raw_row.ownership_type->>'value') IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  IF (raw_row.owner_name->>'value') IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  -- Size
  IF (raw_row.employee_count->>'value') IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  IF (raw_row.location_count->>'value') IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  -- Online presence
  IF (raw_row.google_rating->>'value') IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  IF (raw_row.linkedin_url->>'value') IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  -- Leadership
  IF jsonb_array_length(COALESCE(raw_row.leadership_team->'value', '[]'::jsonb)) > 0 THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  -- Services
  IF jsonb_array_length(COALESCE(raw_row.services_offered->'value', '[]'::jsonb)) > 0 THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  -- Awards
  IF jsonb_array_length(COALESCE(raw_row.awards->'value', '[]'::jsonb)) > 0 THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  -- Tech
  IF jsonb_array_length(COALESCE(raw_row.tech_stack->'value', '[]'::jsonb)) > 0 THEN filled_fields := filled_fields + 1; END IF;
  total_fields := total_fields + 1;

  RETURN ROUND((filled_fields::DECIMAL / total_fields) * 100);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate completeness
CREATE OR REPLACE FUNCTION update_raw_completeness()
RETURNS TRIGGER AS $$
BEGIN
  NEW.data_completeness := calculate_raw_completeness(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_raw_completeness
  BEFORE INSERT OR UPDATE ON company_intelligence_raw
  FOR EACH ROW
  EXECUTE FUNCTION update_raw_completeness();
