-- Intelligence System Redesign
-- Two-layer architecture: Data Layer + Analysis Layer
-- All fields have source attribution, editable by users

-- ============================================
-- 1. Company Intelligence (Data Layer)
-- ============================================

CREATE TABLE IF NOT EXISTS company_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Company Profile (auto-collected + editable)
  company_profile JSONB DEFAULT '{
    "founded_year": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "employee_count": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "employee_range": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "annual_revenue": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "revenue_range": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "headquarters": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "locations_count": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "company_type": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "ownership": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null}
  }'::jsonb,

  -- Online Presence
  online_presence JSONB DEFAULT '{
    "website_url": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "linkedin_url": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "linkedin_followers": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "facebook_url": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "facebook_followers": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "twitter_url": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "instagram_url": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "youtube_url": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "youtube_subscribers": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null}
  }'::jsonb,

  -- Reviews
  reviews JSONB DEFAULT '{
    "google_rating": {"value": null, "source": "google_places", "source_url": null, "verified": false, "last_checked": null},
    "google_review_count": {"value": null, "source": "google_places", "source_url": null, "verified": false, "last_checked": null},
    "google_place_id": {"value": null, "source": "google_places", "source_url": null, "verified": false, "last_checked": null},
    "facebook_rating": {"value": null, "source": "facebook", "source_url": null, "verified": false, "last_checked": null},
    "facebook_review_count": {"value": null, "source": "facebook", "source_url": null, "verified": false, "last_checked": null},
    "bbb_rating": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "yelp_rating": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "review_velocity_30d": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "recent_reviews": {"value": [], "source": null, "source_url": null, "verified": false, "last_checked": null}
  }'::jsonb,

  -- Marketing Signals
  marketing JSONB DEFAULT '{
    "has_blog": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "blog_url": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "blog_post_frequency": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "last_blog_post_date": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "email_marketing": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "social_posting_frequency": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "has_paid_ads": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "marketing_sophistication": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "primary_channels": {"value": [], "source": null, "source_url": null, "verified": false, "last_checked": null}
  }'::jsonb,

  -- Technology Stack
  technology JSONB DEFAULT '{
    "crm_system": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "routing_software": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "phone_system": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "payment_processor": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "website_platform": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "scheduling_system": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "detected_technologies": {"value": [], "source": "builtwith", "source_url": null, "verified": false, "last_checked": null},
    "has_online_booking": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "has_live_chat": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null}
  }'::jsonb,

  -- Financial Indicators
  financial JSONB DEFAULT '{
    "estimated_revenue": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "growth_signals": {"value": [], "source": null, "source_url": null, "verified": false, "last_checked": null},
    "funding_status": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "recent_acquisitions": {"value": [], "source": null, "source_url": null, "verified": false, "last_checked": null},
    "hiring_activity": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null},
    "job_postings_count": {"value": null, "source": null, "source_url": null, "verified": false, "last_checked": null}
  }'::jsonb,

  -- Services & Operations
  services JSONB DEFAULT '{
    "primary_services": {"value": [], "source": null, "source_url": null, "verified": false, "last_checked": null},
    "service_areas": {"value": [], "source": null, "source_url": null, "verified": false, "last_checked": null},
    "certifications": {"value": [], "source": null, "source_url": null, "verified": false, "last_checked": null},
    "awards": {"value": [], "source": null, "source_url": null, "verified": false, "last_checked": null},
    "specializations": {"value": [], "source": null, "source_url": null, "verified": false, "last_checked": null}
  }'::jsonb,

  -- Key People (discovered contacts)
  key_people JSONB DEFAULT '[]'::jsonb,

  -- Industry Mentions
  industry_mentions JSONB DEFAULT '[]'::jsonb,

  -- Collection Metadata
  collection_status TEXT DEFAULT 'pending' CHECK (collection_status IN ('pending', 'collecting', 'complete', 'failed', 'partial')),
  last_collected_at TIMESTAMPTZ,
  collection_errors JSONB DEFAULT '[]'::jsonb,

  -- Data Quality
  completeness_score INTEGER DEFAULT 0,
  data_quality_score INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(company_id)
);

-- ============================================
-- 2. Intelligence Analyses (On-Demand AI Layer)
-- ============================================

CREATE TABLE IF NOT EXISTS company_intelligence_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  intelligence_id UUID REFERENCES company_intelligence(id) ON DELETE SET NULL,

  -- Analysis Type
  analysis_type TEXT NOT NULL DEFAULT 'full' CHECK (analysis_type IN ('full', 'quick', 'competitive', 'pain_points')),

  -- AI-Generated Content
  executive_summary TEXT,

  -- SWOT Analysis
  strengths JSONB DEFAULT '[]'::jsonb,
  weaknesses JSONB DEFAULT '[]'::jsonb,
  opportunities JSONB DEFAULT '[]'::jsonb,
  threats JSONB DEFAULT '[]'::jsonb,

  -- Sales Intelligence
  pain_points JSONB DEFAULT '[]'::jsonb,
  talking_points JSONB DEFAULT '[]'::jsonb,
  recommended_approach TEXT,
  objection_handlers JSONB DEFAULT '[]'::jsonb,

  -- Competitive Analysis
  competitive_position TEXT,
  competitor_mentions JSONB DEFAULT '[]'::jsonb,
  differentiation_angles JSONB DEFAULT '[]'::jsonb,

  -- Connection Points
  connection_points JSONB DEFAULT '[]'::jsonb,

  -- Timing & Signals
  buying_signals JSONB DEFAULT '[]'::jsonb,
  timing_assessment TEXT,
  urgency_level TEXT CHECK (urgency_level IN ('high', 'medium', 'low')),

  -- Scores
  overall_score INTEGER,
  engagement_score INTEGER,
  fit_score INTEGER,

  -- Metadata
  data_snapshot_hash TEXT,
  model_version TEXT,
  tokens_used INTEGER,
  generation_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

-- ============================================
-- 3. Intelligence Edit History (Audit Trail)
-- ============================================

CREATE TABLE IF NOT EXISTS company_intelligence_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intelligence_id UUID NOT NULL REFERENCES company_intelligence(id) ON DELETE CASCADE,

  -- Edit Details
  field_path TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  edit_reason TEXT,

  -- Who made the edit
  edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_by_name TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. Collection Sources Log
-- ============================================

CREATE TABLE IF NOT EXISTS intelligence_collection_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intelligence_id UUID NOT NULL REFERENCES company_intelligence(id) ON DELETE CASCADE,

  source_type TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,

  success BOOLEAN,
  error_message TEXT,

  raw_data JSONB,
  fields_updated JSONB DEFAULT '[]'::jsonb,
  quality_score INTEGER,
  duration_ms INTEGER
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_company_intel_company ON company_intelligence(company_id);
CREATE INDEX IF NOT EXISTS idx_company_intel_status ON company_intelligence(collection_status);
CREATE INDEX IF NOT EXISTS idx_company_intel_updated ON company_intelligence(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_intel_quality ON company_intelligence(data_quality_score DESC);

CREATE INDEX IF NOT EXISTS idx_intel_analyses_company ON company_intelligence_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_intel_analyses_type ON company_intelligence_analyses(analysis_type);
CREATE INDEX IF NOT EXISTS idx_intel_analyses_created ON company_intelligence_analyses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intel_edits_intel ON company_intelligence_edits(intelligence_id);
CREATE INDEX IF NOT EXISTS idx_intel_edits_field ON company_intelligence_edits(field_path);
CREATE INDEX IF NOT EXISTS idx_intel_edits_created ON company_intelligence_edits(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collection_log_intel ON intelligence_collection_log(intelligence_id);
CREATE INDEX IF NOT EXISTS idx_collection_log_source ON intelligence_collection_log(source_type);

-- ============================================
-- Updated At Trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_company_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_intelligence_updated ON company_intelligence;
CREATE TRIGGER trg_company_intelligence_updated
  BEFORE UPDATE ON company_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_company_intelligence_updated_at();

-- ============================================
-- Completeness Score Function
-- ============================================

CREATE OR REPLACE FUNCTION calculate_intelligence_completeness(intel company_intelligence)
RETURNS INTEGER AS $$
DECLARE
  total_fields INTEGER := 0;
  filled_fields INTEGER := 0;
  profile_fields TEXT[] := ARRAY['founded_year', 'employee_count', 'headquarters', 'company_type'];
  presence_fields TEXT[] := ARRAY['website_url', 'linkedin_url', 'facebook_url'];
  review_fields TEXT[] := ARRAY['google_rating', 'google_review_count'];
  field TEXT;
  field_val JSONB;
BEGIN
  -- Check company profile fields
  FOREACH field IN ARRAY profile_fields LOOP
    total_fields := total_fields + 1;
    field_val := intel.company_profile -> field -> 'value';
    IF field_val IS NOT NULL AND field_val != 'null'::jsonb THEN
      filled_fields := filled_fields + 1;
    END IF;
  END LOOP;

  -- Check online presence fields
  FOREACH field IN ARRAY presence_fields LOOP
    total_fields := total_fields + 1;
    field_val := intel.online_presence -> field -> 'value';
    IF field_val IS NOT NULL AND field_val != 'null'::jsonb THEN
      filled_fields := filled_fields + 1;
    END IF;
  END LOOP;

  -- Check review fields
  FOREACH field IN ARRAY review_fields LOOP
    total_fields := total_fields + 1;
    field_val := intel.reviews -> field -> 'value';
    IF field_val IS NOT NULL AND field_val != 'null'::jsonb THEN
      filled_fields := filled_fields + 1;
    END IF;
  END LOOP;

  IF total_fields = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((filled_fields::NUMERIC / total_fields::NUMERIC) * 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE company_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_intelligence_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_intelligence_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_collection_log ENABLE ROW LEVEL SECURITY;

-- Policies for company_intelligence
CREATE POLICY "Authenticated users can view company intelligence" ON company_intelligence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert company intelligence" ON company_intelligence
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update company intelligence" ON company_intelligence
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Service role can manage all company intelligence" ON company_intelligence
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Policies for analyses
CREATE POLICY "Authenticated users can view analyses" ON company_intelligence_analyses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create analyses" ON company_intelligence_analyses
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Service role can manage all analyses" ON company_intelligence_analyses
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Policies for edits
CREATE POLICY "Authenticated users can view edits" ON company_intelligence_edits
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create edits" ON company_intelligence_edits
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Service role can manage all edits" ON company_intelligence_edits
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Policies for collection log
CREATE POLICY "Authenticated users can view collection log" ON intelligence_collection_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage collection log" ON intelligence_collection_log
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
