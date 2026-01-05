-- ============================================================================
-- AI GOVERNANCE - DATABASE SCHEMA
-- ============================================================================
-- This migration adds AI governance infrastructure:
-- 1. AI suggestions read model (projection from AISuggestion* events)
-- 2. SLA breach tracking projection
-- 3. Projection rebuild tracking
--
-- GUARDRAILS:
-- - AI never auto-executes - all suggestions require human acceptance
-- - All state changes are traceable through events
-- - Rebuild produces identical projections from events
-- ============================================================================

-- ============================================================================
-- 1. AI SUGGESTIONS READ MODEL
-- ============================================================================
-- Projection of AI suggestions from AISuggestionCreated/Accepted/Dismissed events.
-- Shows pending, accepted, and dismissed suggestions per company_product.

CREATE TABLE IF NOT EXISTS ai_suggestions_read_model (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Suggestion identity
  suggestion_id TEXT NOT NULL UNIQUE,  -- From event data

  -- Target entity
  company_product_id UUID NOT NULL REFERENCES company_products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  product_id UUID NOT NULL,

  -- Suggestion details
  suggestion_type TEXT NOT NULL,  -- 'advance_stage', 'set_tier', etc.
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  -- Source information
  source_type TEXT NOT NULL,  -- 'transcript', 'email', 'sla_scan', etc.
  source_id TEXT,

  -- Suggested action (JSON)
  suggested_action JSONB NOT NULL,  -- { command: string, params: {} }

  -- State
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'expired')),

  -- Resolution information
  resolved_at TIMESTAMPTZ,
  resolved_by_actor_type TEXT,
  resolved_by_actor_id TEXT,
  resolution_notes TEXT,
  dismiss_reason TEXT,  -- If dismissed

  -- Timing
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,

  -- Event tracking
  created_event_id UUID REFERENCES event_store(id),
  resolved_event_id UUID REFERENCES event_store(id),

  -- Projection metadata
  projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT ai_suggestions_company_fk
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT ai_suggestions_product_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_company_product
  ON ai_suggestions_read_model (company_product_id);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status
  ON ai_suggestions_read_model (status);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_pending
  ON ai_suggestions_read_model (company_product_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type
  ON ai_suggestions_read_model (suggestion_type);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_created_at
  ON ai_suggestions_read_model (created_at);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_expires_at
  ON ai_suggestions_read_model (expires_at)
  WHERE expires_at IS NOT NULL AND status = 'pending';

COMMENT ON TABLE ai_suggestions_read_model IS 'PROJECTION: AI suggestions pending human review. Derived from AISuggestion* events.';

-- ============================================================================
-- 2. SLA BREACH TRACKING
-- ============================================================================
-- Tracks SLA breaches per company_product_stage.
-- Derived from CompanyProductSLABreached events.

CREATE TABLE IF NOT EXISTS sla_breach_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity information
  company_product_id UUID NOT NULL REFERENCES company_products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  product_id UUID NOT NULL,

  -- Stage information
  stage_id UUID NOT NULL REFERENCES product_process_stages(id),
  stage_name TEXT NOT NULL,
  process_type TEXT NOT NULL,

  -- Breach details
  sla_days INTEGER NOT NULL,
  actual_days INTEGER NOT NULL,
  days_over INTEGER NOT NULL,

  -- Timing
  breached_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,  -- When moved to another stage

  -- Event tracking
  breach_event_id UUID UNIQUE REFERENCES event_store(id),
  resolution_event_id UUID REFERENCES event_store(id),

  -- Projection metadata
  projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_breach_facts_company_product
  ON sla_breach_facts (company_product_id);

CREATE INDEX IF NOT EXISTS idx_sla_breach_facts_stage
  ON sla_breach_facts (stage_id);

CREATE INDEX IF NOT EXISTS idx_sla_breach_facts_breached_at
  ON sla_breach_facts (breached_at);

CREATE INDEX IF NOT EXISTS idx_sla_breach_facts_unresolved
  ON sla_breach_facts (company_product_id)
  WHERE resolved_at IS NULL;

COMMENT ON TABLE sla_breach_facts IS 'PROJECTION: SLA breach tracking. Derived from CompanyProductSLABreached events.';

-- ============================================================================
-- 3. PROJECTION REBUILD AUDIT
-- ============================================================================
-- Tracks projection rebuild operations for compliance and debugging.

CREATE TABLE IF NOT EXISTS projection_rebuild_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rebuild information
  rebuild_id TEXT NOT NULL,  -- UUID for grouping related rebuilds
  projector_name TEXT NOT NULL,

  -- Scope
  scope TEXT NOT NULL CHECK (scope IN ('full', 'aggregate', 'range')),
  aggregate_id UUID,  -- If scope = 'aggregate'
  from_sequence BIGINT,  -- If scope = 'range'
  to_sequence BIGINT,

  -- Stats
  events_processed INTEGER NOT NULL DEFAULT 0,
  records_created INTEGER NOT NULL DEFAULT 0,
  records_updated INTEGER NOT NULL DEFAULT 0,
  records_deleted INTEGER NOT NULL DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Result
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  error_message TEXT,

  -- Actor
  actor_type TEXT NOT NULL,
  actor_id TEXT,

  -- Metadata
  config JSONB DEFAULT '{}',
  result_summary JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_rebuild_audit_projector
  ON projection_rebuild_audit (projector_name);

CREATE INDEX IF NOT EXISTS idx_rebuild_audit_rebuild_id
  ON projection_rebuild_audit (rebuild_id);

CREATE INDEX IF NOT EXISTS idx_rebuild_audit_started_at
  ON projection_rebuild_audit (started_at);

COMMENT ON TABLE projection_rebuild_audit IS 'Audit trail for projection rebuild operations.';

-- ============================================================================
-- 4. ADD PROJECTOR CHECKPOINTS FOR NEW PROJECTORS
-- ============================================================================

INSERT INTO projector_checkpoints (projector_name, status) VALUES
  ('ai_suggestions', 'active'),
  ('sla_breach_facts', 'active')
ON CONFLICT (projector_name) DO NOTHING;

-- ============================================================================
-- 5. ADD OWNER, TIER, MRR, SEATS FIELDS TO READ MODEL
-- ============================================================================
-- These fields support the additional commands we implemented

ALTER TABLE company_product_read_model
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS tier INTEGER CHECK (tier >= 1 AND tier <= 5),
  ADD COLUMN IF NOT EXISTS mrr NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS mrr_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS seats INTEGER,
  ADD COLUMN IF NOT EXISTS next_step TEXT,
  ADD COLUMN IF NOT EXISTS next_step_due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_next_step_overdue BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_cprm_owner
  ON company_product_read_model (owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cprm_tier
  ON company_product_read_model (tier)
  WHERE tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cprm_next_step_overdue
  ON company_product_read_model (next_step_due_date)
  WHERE is_next_step_overdue = TRUE;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

ALTER TABLE ai_suggestions_read_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_breach_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projection_rebuild_audit ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on ai_suggestions_read_model"
  ON ai_suggestions_read_model FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on sla_breach_facts"
  ON sla_breach_facts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on projection_rebuild_audit"
  ON projection_rebuild_audit FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY "Authenticated users can read ai_suggestions"
  ON ai_suggestions_read_model FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read sla_breach_facts"
  ON sla_breach_facts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read projection_rebuild_audit"
  ON projection_rebuild_audit FOR SELECT
  USING (auth.role() = 'authenticated');
