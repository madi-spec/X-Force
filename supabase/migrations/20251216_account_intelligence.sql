-- Account Intelligence System
-- Stores AI-gathered intelligence about companies from multiple sources

-- ============================================
-- 1. Main Intelligence Record
-- ============================================

CREATE TABLE IF NOT EXISTS account_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Scores (0-100)
  overall_score INTEGER,
  website_score INTEGER,
  social_score INTEGER,
  review_score INTEGER,
  industry_score INTEGER,

  -- AI Synthesis
  executive_summary TEXT,
  pain_points JSONB DEFAULT '[]'::jsonb,
  opportunities JSONB DEFAULT '[]'::jsonb,
  talking_points JSONB DEFAULT '[]'::jsonb,
  recommended_approach TEXT,

  -- Collection Metadata
  last_collected_at TIMESTAMPTZ,
  collection_status TEXT DEFAULT 'pending' CHECK (collection_status IN ('pending', 'collecting', 'complete', 'failed', 'partial')),
  context_hash TEXT,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(company_id)
);

-- ============================================
-- 2. Intelligence Sources
-- ============================================

CREATE TABLE IF NOT EXISTS intelligence_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_intelligence_id UUID NOT NULL REFERENCES account_intelligence(id) ON DELETE CASCADE,

  source_type TEXT NOT NULL CHECK (source_type IN (
    'website',
    'facebook',
    'google_reviews',
    'linkedin_company',
    'linkedin_people',
    'industry_mentions'
  )),

  raw_data JSONB,
  processed_data JSONB,
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),

  collected_at TIMESTAMPTZ DEFAULT now(),
  collection_duration_ms INTEGER,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. Contact Intelligence (from Apollo/LinkedIn)
-- ============================================

CREATE TABLE IF NOT EXISTS contact_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- From Apollo.io / LinkedIn
  full_name TEXT,
  title TEXT,
  department TEXT,
  seniority TEXT CHECK (seniority IN ('entry', 'senior', 'manager', 'director', 'vp', 'c_level', 'owner', 'partner')),
  linkedin_url TEXT,
  email TEXT,
  phone TEXT,

  -- Apollo metadata
  apollo_id TEXT,
  headline TEXT,
  photo_url TEXT,

  -- AI Analysis
  relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 100),
  engagement_notes TEXT,
  is_decision_maker BOOLEAN DEFAULT false,
  recommended_approach TEXT,

  source TEXT DEFAULT 'apollo' CHECK (source IN ('apollo', 'linkedin', 'manual')),
  collected_at TIMESTAMPTZ DEFAULT now(),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. Industry Mentions
-- ============================================

CREATE TABLE IF NOT EXISTS industry_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  mention_type TEXT CHECK (mention_type IN ('news', 'podcast', 'award', 'press_release', 'blog', 'event', 'other')),
  title TEXT NOT NULL,
  source_name TEXT,
  source_url TEXT,
  published_at TIMESTAMPTZ,
  summary TEXT,
  content_snippet TEXT,

  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 100),

  -- Metadata
  search_query TEXT,
  serp_position INTEGER,

  collected_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_account_intel_company ON account_intelligence(company_id);
CREATE INDEX IF NOT EXISTS idx_account_intel_status ON account_intelligence(collection_status);
CREATE INDEX IF NOT EXISTS idx_account_intel_updated ON account_intelligence(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_intel_sources_parent ON intelligence_sources(account_intelligence_id);
CREATE INDEX IF NOT EXISTS idx_intel_sources_type ON intelligence_sources(source_type);

CREATE INDEX IF NOT EXISTS idx_contact_intel_company ON contact_intelligence(company_id);
CREATE INDEX IF NOT EXISTS idx_contact_intel_seniority ON contact_intelligence(seniority);
CREATE INDEX IF NOT EXISTS idx_contact_intel_decision_maker ON contact_intelligence(is_decision_maker) WHERE is_decision_maker = true;

CREATE INDEX IF NOT EXISTS idx_industry_mentions_company ON industry_mentions(company_id);
CREATE INDEX IF NOT EXISTS idx_industry_mentions_type ON industry_mentions(mention_type);
CREATE INDEX IF NOT EXISTS idx_industry_mentions_published ON industry_mentions(published_at DESC);

-- ============================================
-- Updated At Trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_account_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_account_intelligence_updated ON account_intelligence;
CREATE TRIGGER trg_account_intelligence_updated
  BEFORE UPDATE ON account_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_account_intelligence_updated_at();

DROP TRIGGER IF EXISTS trg_contact_intelligence_updated ON contact_intelligence;
CREATE TRIGGER trg_contact_intelligence_updated
  BEFORE UPDATE ON contact_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_account_intelligence_updated_at();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE account_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_mentions ENABLE ROW LEVEL SECURITY;

-- Simple policies: authenticated users can view, service role can manage all
CREATE POLICY "Authenticated users can view intelligence" ON account_intelligence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage all intelligence" ON account_intelligence
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Authenticated users can view sources" ON intelligence_sources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage all sources" ON intelligence_sources
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Authenticated users can view contact intel" ON contact_intelligence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage all contact intel" ON contact_intelligence
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Authenticated users can view mentions" ON industry_mentions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage all mentions" ON industry_mentions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
