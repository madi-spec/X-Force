-- ============================================================================
-- SUPPORT CASE SYSTEM - EVENT-SOURCED
-- ============================================================================
-- Support cases are a core engagement signal. They must:
-- - Be tracked and worked (queue, detail view, SLAs)
-- - Affect engagement risk/health/stage
-- - Be auditable and replayable
--
-- ARCHITECTURE:
-- - support_cases: Thin identity table (aggregate root, no mutable state)
-- - support_case_read_model: Current state projection (derived)
-- - support_case_sla_facts: SLA tracking projection (derived)
-- - company_product_open_case_counts: Aggregated counts projection (derived)
--
-- RULES:
-- 1. support_cases contains ONLY identity (no state fields)
-- 2. All state is derived from events via projectors
-- 3. Commands write events, projectors update read models
-- ============================================================================

-- ============================================================================
-- 1. SUPPORT CASES - Thin identity table (aggregate root)
-- ============================================================================
-- This is the AGGREGATE ROOT for support cases.
-- Contains ONLY identity fields - no mutable state.
-- All state is derived from event_store via projections.

CREATE TABLE IF NOT EXISTS support_cases (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys (immutable after creation)
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL,

  -- Immutable audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_support_cases_company
  ON support_cases (company_id);

CREATE INDEX IF NOT EXISTS idx_support_cases_company_product
  ON support_cases (company_product_id)
  WHERE company_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_cases_created_at
  ON support_cases (created_at);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_support_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS support_cases_updated_at ON support_cases;
CREATE TRIGGER support_cases_updated_at
  BEFORE UPDATE ON support_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_support_cases_updated_at();

COMMENT ON TABLE support_cases IS 'Identity table for support cases. No mutable state - state derived from events.';
COMMENT ON COLUMN support_cases.company_product_id IS 'Optional link to specific product. Can be NULL for company-wide issues.';

-- ============================================================================
-- 2. SUPPORT CASE READ MODEL - Current state projection
-- ============================================================================
-- This is a PROJECTION - derived entirely from event_store.
-- NEVER write to this table directly from APIs.
-- Use the projector to rebuild from events.

CREATE TABLE IF NOT EXISTS support_case_read_model (
  -- Identity (1:1 with support_cases)
  support_case_id UUID PRIMARY KEY REFERENCES support_cases(id) ON DELETE CASCADE,

  -- Denormalized for query efficiency
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL,

  -- Case information
  title TEXT,
  description TEXT,
  external_id TEXT,  -- ID from external ticketing system if any
  source TEXT,  -- 'email', 'phone', 'chat', 'portal', 'internal'

  -- Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',
    'in_progress',
    'waiting_on_customer',
    'waiting_on_internal',
    'escalated',
    'resolved',
    'closed'
  )),

  -- Priority/Severity
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN (
    'low',
    'medium',
    'high',
    'urgent',
    'critical'
  )),

  -- Category
  category TEXT,  -- 'bug', 'feature_request', 'question', 'billing', 'onboarding', 'integration', etc.
  subcategory TEXT,
  tags JSONB DEFAULT '[]',

  -- Assignment
  owner_id TEXT,
  owner_name TEXT,
  assigned_team TEXT,

  -- SLA tracking
  first_response_due_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  first_response_breached BOOLEAN DEFAULT FALSE,

  resolution_due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_breached BOOLEAN DEFAULT FALSE,

  -- Timing
  opened_at TIMESTAMPTZ NOT NULL,
  last_customer_contact_at TIMESTAMPTZ,
  last_agent_response_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- Metrics
  response_count INTEGER DEFAULT 0,
  customer_response_count INTEGER DEFAULT 0,
  agent_response_count INTEGER DEFAULT 0,
  escalation_count INTEGER DEFAULT 0,
  reopen_count INTEGER DEFAULT 0,

  -- Customer satisfaction
  csat_score INTEGER CHECK (csat_score >= 1 AND csat_score <= 5),
  csat_comment TEXT,
  csat_submitted_at TIMESTAMPTZ,

  -- Resolution
  resolution_summary TEXT,
  root_cause TEXT,

  -- Impact on engagement
  engagement_impact TEXT CHECK (engagement_impact IN ('positive', 'neutral', 'negative', 'critical')),
  churn_risk_contribution INTEGER CHECK (churn_risk_contribution >= 0 AND churn_risk_contribution <= 100),

  -- Last event tracking
  last_event_at TIMESTAMPTZ,
  last_event_type TEXT,
  last_event_sequence BIGINT,

  -- Projection metadata
  projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  projection_version INTEGER NOT NULL DEFAULT 1
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scrm_company
  ON support_case_read_model (company_id);

CREATE INDEX IF NOT EXISTS idx_scrm_company_product
  ON support_case_read_model (company_product_id)
  WHERE company_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scrm_status
  ON support_case_read_model (status);

CREATE INDEX IF NOT EXISTS idx_scrm_severity
  ON support_case_read_model (severity);

CREATE INDEX IF NOT EXISTS idx_scrm_owner
  ON support_case_read_model (owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scrm_open_cases
  ON support_case_read_model (company_id, status)
  WHERE status NOT IN ('resolved', 'closed');

CREATE INDEX IF NOT EXISTS idx_scrm_first_response_due
  ON support_case_read_model (first_response_due_at)
  WHERE first_response_at IS NULL AND status NOT IN ('resolved', 'closed');

CREATE INDEX IF NOT EXISTS idx_scrm_resolution_due
  ON support_case_read_model (resolution_due_at)
  WHERE resolved_at IS NULL AND status NOT IN ('resolved', 'closed');

CREATE INDEX IF NOT EXISTS idx_scrm_breached
  ON support_case_read_model (company_id)
  WHERE first_response_breached = TRUE OR resolution_breached = TRUE;

CREATE INDEX IF NOT EXISTS idx_scrm_engagement_impact
  ON support_case_read_model (company_product_id, engagement_impact)
  WHERE engagement_impact IN ('negative', 'critical');

COMMENT ON TABLE support_case_read_model IS 'PROJECTION: Current support case state. Derived from event_store. Do not write directly.';

-- ============================================================================
-- 3. SUPPORT CASE SLA FACTS - SLA tracking projection
-- ============================================================================
-- Records SLA events for analytics and breach tracking.
-- This is a PROJECTION - derived from SLA-related events.

CREATE TABLE IF NOT EXISTS support_case_sla_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  support_case_id UUID NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  company_product_id UUID,

  -- SLA type
  sla_type TEXT NOT NULL CHECK (sla_type IN ('first_response', 'resolution', 'update')),

  -- Target
  severity TEXT NOT NULL,
  target_hours INTEGER NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,

  -- Outcome
  met_at TIMESTAMPTZ,
  breached_at TIMESTAMPTZ,
  is_breached BOOLEAN NOT NULL DEFAULT FALSE,

  -- Duration
  actual_hours NUMERIC(10,2),
  hours_over_sla NUMERIC(10,2),  -- If breached

  -- Event tracking
  sla_set_event_id UUID REFERENCES event_store(id),
  sla_met_event_id UUID REFERENCES event_store(id),
  sla_breached_event_id UUID REFERENCES event_store(id),

  -- Projection metadata
  projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scsf_support_case
  ON support_case_sla_facts (support_case_id);

CREATE INDEX IF NOT EXISTS idx_scsf_company
  ON support_case_sla_facts (company_id);

CREATE INDEX IF NOT EXISTS idx_scsf_company_product
  ON support_case_sla_facts (company_product_id)
  WHERE company_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scsf_breached
  ON support_case_sla_facts (company_id)
  WHERE is_breached = TRUE;

CREATE INDEX IF NOT EXISTS idx_scsf_sla_type
  ON support_case_sla_facts (sla_type, is_breached);

CREATE INDEX IF NOT EXISTS idx_scsf_due_at
  ON support_case_sla_facts (due_at)
  WHERE met_at IS NULL AND breached_at IS NULL;

COMMENT ON TABLE support_case_sla_facts IS 'PROJECTION: SLA tracking per case. Derived from SLA events.';

-- ============================================================================
-- 4. COMPANY PRODUCT OPEN CASE COUNTS - Aggregated counts projection
-- ============================================================================
-- Pre-aggregated counts for fast dashboard rendering and health calculations.
-- This is a PROJECTION - rebuilt from support_case_read_model.

CREATE TABLE IF NOT EXISTS company_product_open_case_counts (
  -- Identity
  company_product_id UUID PRIMARY KEY REFERENCES company_products(id) ON DELETE CASCADE,

  -- Denormalized
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Counts by status
  open_count INTEGER NOT NULL DEFAULT 0,
  in_progress_count INTEGER NOT NULL DEFAULT 0,
  waiting_count INTEGER NOT NULL DEFAULT 0,  -- waiting_on_customer + waiting_on_internal
  escalated_count INTEGER NOT NULL DEFAULT 0,

  -- Counts by severity
  low_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  urgent_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,

  -- SLA status
  first_response_breached_count INTEGER NOT NULL DEFAULT 0,
  resolution_breached_count INTEGER NOT NULL DEFAULT 0,
  any_breached_count INTEGER NOT NULL DEFAULT 0,

  -- At risk (approaching SLA)
  first_response_at_risk_count INTEGER NOT NULL DEFAULT 0,
  resolution_at_risk_count INTEGER NOT NULL DEFAULT 0,

  -- Totals
  total_open_count INTEGER NOT NULL DEFAULT 0,  -- All non-closed cases
  total_resolved_30d INTEGER NOT NULL DEFAULT 0,  -- Resolved in last 30 days

  -- Impact summary
  negative_impact_count INTEGER NOT NULL DEFAULT 0,
  critical_impact_count INTEGER NOT NULL DEFAULT 0,

  -- Averages (for health scoring)
  avg_resolution_hours_30d NUMERIC(10,2),
  avg_first_response_hours_30d NUMERIC(10,2),
  avg_csat_30d NUMERIC(3,2),

  -- Projection metadata
  projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cpocc_company
  ON company_product_open_case_counts (company_id);

CREATE INDEX IF NOT EXISTS idx_cpocc_product
  ON company_product_open_case_counts (product_id);

CREATE INDEX IF NOT EXISTS idx_cpocc_breached
  ON company_product_open_case_counts (company_product_id)
  WHERE any_breached_count > 0;

CREATE INDEX IF NOT EXISTS idx_cpocc_critical
  ON company_product_open_case_counts (company_product_id)
  WHERE critical_count > 0 OR urgent_count > 0;

COMMENT ON TABLE company_product_open_case_counts IS 'PROJECTION: Aggregated case counts per company_product for dashboards and health scoring.';

-- ============================================================================
-- 5. COMPANY OPEN CASE COUNTS - Company-level aggregation
-- ============================================================================
-- For cases not linked to a specific product, and company-wide totals.

CREATE TABLE IF NOT EXISTS company_open_case_counts (
  -- Identity
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,

  -- Counts (all cases for company, including product-linked)
  total_open_count INTEGER NOT NULL DEFAULT 0,
  unassigned_product_count INTEGER NOT NULL DEFAULT 0,  -- Cases without company_product_id

  -- By severity (company-wide)
  high_and_above_count INTEGER NOT NULL DEFAULT 0,  -- high + urgent + critical
  critical_count INTEGER NOT NULL DEFAULT 0,

  -- SLA (company-wide)
  any_breached_count INTEGER NOT NULL DEFAULT 0,

  -- Health indicator
  support_health_score INTEGER CHECK (support_health_score >= 0 AND support_health_score <= 100),
  support_risk_level TEXT CHECK (support_risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Projection metadata
  projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cocc_support_health
  ON company_open_case_counts (support_health_score, support_risk_level);

CREATE INDEX IF NOT EXISTS idx_cocc_critical
  ON company_open_case_counts (company_id)
  WHERE critical_count > 0 OR any_breached_count > 0;

COMMENT ON TABLE company_open_case_counts IS 'PROJECTION: Company-level case aggregation for health scoring.';

-- ============================================================================
-- 6. SLA CONFIGURATION
-- ============================================================================
-- Defines SLA targets by severity. Can be overridden per product.

CREATE TABLE IF NOT EXISTS support_sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,  -- NULL = default

  -- Severity
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'urgent', 'critical')),

  -- SLA targets (in hours)
  first_response_hours INTEGER NOT NULL,
  resolution_hours INTEGER NOT NULL,
  update_hours INTEGER,  -- Optional: max hours between updates

  -- Warning thresholds (percentage of SLA consumed)
  warning_threshold_percent INTEGER NOT NULL DEFAULT 75,

  -- Active flag
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique per product/severity (or global if product_id is NULL)
  CONSTRAINT support_sla_config_unique
    UNIQUE NULLS NOT DISTINCT (product_id, severity)
);

-- Insert default SLA configuration
INSERT INTO support_sla_config (severity, first_response_hours, resolution_hours, update_hours) VALUES
  ('critical', 1, 4, 1),
  ('urgent', 2, 8, 2),
  ('high', 4, 24, 4),
  ('medium', 8, 72, 8),
  ('low', 24, 168, 24)
ON CONFLICT (product_id, severity) DO NOTHING;

COMMENT ON TABLE support_sla_config IS 'SLA targets by severity. NULL product_id = default. Product-specific overrides take precedence.';

-- ============================================================================
-- 7. REGISTER PROJECTORS
-- ============================================================================

INSERT INTO projector_checkpoints (projector_name, status) VALUES
  ('support_case_read_model', 'active'),
  ('support_case_sla_facts', 'active'),
  ('company_product_open_case_counts', 'active'),
  ('company_open_case_counts', 'active')
ON CONFLICT (projector_name) DO NOTHING;

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_case_read_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_case_sla_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_product_open_case_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_open_case_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_sla_config ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on support_cases"
  ON support_cases FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on support_case_read_model"
  ON support_case_read_model FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on support_case_sla_facts"
  ON support_case_sla_facts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on company_product_open_case_counts"
  ON company_product_open_case_counts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on company_open_case_counts"
  ON company_open_case_counts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on support_sla_config"
  ON support_sla_config FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY "Authenticated users can read support_cases"
  ON support_cases FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert support_cases"
  ON support_cases FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read support_case_read_model"
  ON support_case_read_model FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read support_case_sla_facts"
  ON support_case_sla_facts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read company_product_open_case_counts"
  ON company_product_open_case_counts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read company_open_case_counts"
  ON company_open_case_counts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read support_sla_config"
  ON support_sla_config FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- 9. COMMENTS
-- ============================================================================

COMMENT ON TABLE support_cases IS 'Identity table for support cases. Aggregate root with no mutable state fields.';
COMMENT ON TABLE support_case_read_model IS 'PROJECTION: Current case state. Derived from events.';
COMMENT ON TABLE support_case_sla_facts IS 'PROJECTION: SLA tracking facts. Derived from SLA events.';
COMMENT ON TABLE company_product_open_case_counts IS 'PROJECTION: Aggregated counts per product. For dashboards and health scoring.';
COMMENT ON TABLE company_open_case_counts IS 'PROJECTION: Company-level aggregation. For overall health scoring.';
