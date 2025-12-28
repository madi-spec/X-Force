-- Sales Intelligence Enhancements
-- Adds company classification, external research storage, and sales reports

-- ============================================
-- 1. Add Classification to Company Intelligence
-- ============================================

-- Add company classification columns to company_intelligence
ALTER TABLE company_intelligence ADD COLUMN IF NOT EXISTS classification_type TEXT;
ALTER TABLE company_intelligence ADD COLUMN IF NOT EXISTS classification_confidence TEXT CHECK (classification_confidence IN ('high', 'medium', 'low'));
ALTER TABLE company_intelligence ADD COLUMN IF NOT EXISTS classification_tier TEXT CHECK (classification_tier IN ('enterprise', 'mid_market', 'smb', 'startup'));
ALTER TABLE company_intelligence ADD COLUMN IF NOT EXISTS classification_signals JSONB DEFAULT '[]'::jsonb;
ALTER TABLE company_intelligence ADD COLUMN IF NOT EXISTS classification_updated_at TIMESTAMPTZ;

-- Add comment to explain classification types
COMMENT ON COLUMN company_intelligence.classification_type IS 'Company type: pe_backed_platform, family_owned_enterprise, franchise_system, growth_stage_regional, local_operator, unknown';

-- ============================================
-- 2. External Research Storage
-- ============================================

-- Add columns for storing external research data
ALTER TABLE company_intelligence ADD COLUMN IF NOT EXISTS external_research JSONB DEFAULT '{
  "awards": [],
  "mna_activity": [],
  "recent_news": [],
  "key_quotes": [],
  "executive_profiles": [],
  "is_pe_backed": null,
  "pe_backer_name": null,
  "industry_recognition_score": null,
  "media_presence_score": null,
  "collected_at": null
}'::jsonb;

-- ============================================
-- 3. Sales Reports Table
-- ============================================

CREATE TABLE IF NOT EXISTS company_sales_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  intelligence_id UUID REFERENCES company_intelligence(id) ON DELETE SET NULL,

  -- Report Content
  markdown_content TEXT NOT NULL,

  -- Classification snapshot (at time of report generation)
  company_type TEXT,
  company_tier TEXT,
  confidence TEXT,

  -- Sales Approach Summary
  primary_focus TEXT,
  key_decision_makers JSONB DEFAULT '[]'::jsonb,
  value_proposition TEXT,

  -- Quality Metrics
  data_quality_score INTEGER,

  -- Metadata
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),

  -- Versioning
  version INTEGER DEFAULT 1
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_sales_reports_company ON company_sales_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_reports_generated ON company_sales_reports(generated_at DESC);

-- ============================================
-- 4. Research Collection Tracking
-- ============================================

-- Add source type for serper research
DO $$
BEGIN
  -- The source_type column is TEXT so we don't need to alter any enum
  -- Just ensure we can track serper_research collections
  NULL;
END $$;

-- ============================================
-- 5. Row Level Security for Sales Reports
-- ============================================

ALTER TABLE company_sales_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sales reports" ON company_sales_reports
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create sales reports" ON company_sales_reports
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update own reports" ON company_sales_reports
  FOR UPDATE TO authenticated USING (generated_by = auth.uid());

CREATE POLICY "Service role can manage all sales reports" ON company_sales_reports
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 6. Helper Functions
-- ============================================

-- Function to get latest sales report for a company
CREATE OR REPLACE FUNCTION get_latest_sales_report(p_company_id UUID)
RETURNS company_sales_reports AS $$
DECLARE
  v_report company_sales_reports;
BEGIN
  SELECT * INTO v_report
  FROM company_sales_reports
  WHERE company_id = p_company_id
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY generated_at DESC
  LIMIT 1;

  RETURN v_report;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if classification needs update
CREATE OR REPLACE FUNCTION needs_classification_update(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated_at TIMESTAMPTZ;
  v_last_collected TIMESTAMPTZ;
BEGIN
  SELECT classification_updated_at, last_collected_at
  INTO v_updated_at, v_last_collected
  FROM company_intelligence
  WHERE company_id = p_company_id;

  -- Needs update if:
  -- 1. Never classified
  -- 2. Classification older than last collection
  -- 3. Classification older than 7 days
  IF v_updated_at IS NULL THEN
    RETURN TRUE;
  END IF;

  IF v_last_collected IS NOT NULL AND v_last_collected > v_updated_at THEN
    RETURN TRUE;
  END IF;

  IF v_updated_at < (now() - interval '7 days') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;
