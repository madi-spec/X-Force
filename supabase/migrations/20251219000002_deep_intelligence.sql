-- ============================================
-- Deep Account Intelligence Enhancement
-- Adds comprehensive company profiling, review analysis,
-- marketing assessment, and enrichment tracking
-- ============================================

-- ============================================
-- ACCOUNT INTELLIGENCE ENHANCEMENTS
-- ============================================

-- Company profile data (size, maturity, service model)
ALTER TABLE account_intelligence
  ADD COLUMN IF NOT EXISTS company_profile JSONB DEFAULT '{}'::jsonb;

-- Pain points extracted from Google reviews with quotes
ALTER TABLE account_intelligence
  ADD COLUMN IF NOT EXISTS review_pain_points JSONB DEFAULT '[]'::jsonb;

-- Marketing activity assessment
ALTER TABLE account_intelligence
  ADD COLUMN IF NOT EXISTS marketing_profile JSONB DEFAULT '{}'::jsonb;

-- Employees discovered with media presence
ALTER TABLE account_intelligence
  ADD COLUMN IF NOT EXISTS visible_employees JSONB DEFAULT '[]'::jsonb;

-- Products and services offered
ALTER TABLE account_intelligence
  ADD COLUMN IF NOT EXISTS products_services JSONB DEFAULT '[]'::jsonb;

-- Geographic service areas
ALTER TABLE account_intelligence
  ADD COLUMN IF NOT EXISTS service_areas JSONB DEFAULT '[]'::jsonb;

-- Industry certifications (QualityPro, NPMA, etc.)
ALTER TABLE account_intelligence
  ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_account_intelligence_company_profile
  ON account_intelligence USING gin (company_profile);

CREATE INDEX IF NOT EXISTS idx_account_intelligence_review_pain_points
  ON account_intelligence USING gin (review_pain_points);

-- Add comments for documentation
COMMENT ON COLUMN account_intelligence.company_profile IS 'Company size, maturity, service model, and tech adoption assessment';
COMMENT ON COLUMN account_intelligence.review_pain_points IS 'Pain points extracted from Google reviews with actual customer quotes';
COMMENT ON COLUMN account_intelligence.marketing_profile IS 'Marketing activity assessment including social media, content, and digital presence';
COMMENT ON COLUMN account_intelligence.visible_employees IS 'Key employees with media presence, thought leaders, and visibility scores';
COMMENT ON COLUMN account_intelligence.products_services IS 'Products and services offered with descriptions and primary/secondary designation';
COMMENT ON COLUMN account_intelligence.service_areas IS 'Geographic service areas covered by the company';
COMMENT ON COLUMN account_intelligence.certifications IS 'Industry certifications like QualityPro, NPMA membership, BBB rating, etc.';

-- ============================================
-- ENRICHMENT LOG TABLE
-- Track all enrichment operations for audit
-- ============================================

CREATE TABLE IF NOT EXISTS enrichment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company', 'contact')),
  entity_id UUID NOT NULL,
  source TEXT NOT NULL,
  fields_updated JSONB DEFAULT '[]'::jsonb,
  previous_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying enrichment history
CREATE INDEX IF NOT EXISTS idx_enrichment_log_entity
  ON enrichment_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_enrichment_log_created
  ON enrichment_log (created_at DESC);

COMMENT ON TABLE enrichment_log IS 'Audit log tracking all auto-enrichment operations on companies and contacts';

-- ============================================
-- CONTACT TABLE ENHANCEMENTS
-- Add fields for richer contact data
-- ============================================

-- LinkedIn profile URL
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Job seniority level
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS seniority TEXT;

-- Department/function
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS department TEXT;

-- Direct phone (different from main phone)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS direct_phone TEXT;

-- When this contact was last enriched
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Source of enrichment data (apollo, linkedin, manual)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS enrichment_source TEXT;

-- Index for finding contacts needing enrichment
CREATE INDEX IF NOT EXISTS idx_contacts_enriched_at
  ON contacts (enriched_at) WHERE enriched_at IS NULL;

COMMENT ON COLUMN contacts.linkedin_url IS 'LinkedIn profile URL for the contact';
COMMENT ON COLUMN contacts.seniority IS 'Job seniority level (entry, senior, manager, director, vp, c_level, owner)';
COMMENT ON COLUMN contacts.department IS 'Department or function (operations, sales, marketing, finance, etc.)';
COMMENT ON COLUMN contacts.direct_phone IS 'Direct dial phone number';
COMMENT ON COLUMN contacts.enriched_at IS 'Timestamp of last enrichment from external sources';
COMMENT ON COLUMN contacts.enrichment_source IS 'Source of enrichment data (apollo, linkedin, manual)';

-- ============================================
-- COMPANY TABLE ENHANCEMENTS (if not exists)
-- ============================================

-- Employee count from Apollo
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS employee_count INTEGER;

-- Revenue estimate from Apollo
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS revenue_estimate TEXT;

-- Founded year
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS founded_year INTEGER;

-- Technologies detected
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS technologies JSONB DEFAULT '[]'::jsonb;

-- When company was last enriched
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;

-- Source of enrichment
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS enrichment_source TEXT;

COMMENT ON COLUMN companies.employee_count IS 'Estimated employee count from Apollo/LinkedIn';
COMMENT ON COLUMN companies.revenue_estimate IS 'Revenue range estimate from Apollo';
COMMENT ON COLUMN companies.founded_year IS 'Year company was founded';
COMMENT ON COLUMN companies.technologies IS 'Technologies and tools detected in use';
COMMENT ON COLUMN companies.enriched_at IS 'Timestamp of last enrichment from external sources';
COMMENT ON COLUMN companies.enrichment_source IS 'Source of enrichment data (apollo, website, manual)';
