-- ============================================================================
-- EVENT-SOURCED LIFECYCLE ENGINE - DATABASE FOUNDATION
-- ============================================================================
-- This migration establishes the core event sourcing infrastructure for
-- managing the full customer lifecycle: Sales → Onboarding → Engagement
--
-- ARCHITECTURE:
-- - event_store: Append-only, immutable source of truth
-- - product_processes: Versioned lifecycle process definitions
-- - product_process_stages: Ordered stages per process version
-- - company_product_read_model: Current state projection (derived)
-- - company_product_stage_facts: Stage duration analytics (derived)
-- - product_pipeline_stage_counts: Kanban optimization (derived)
-- - projector_checkpoints: Projector processing state
--
-- RULES:
-- 1. event_store is NEVER updated or deleted (append-only)
-- 2. Projections are ALWAYS derived from events
-- 3. APIs write ONLY to event_store
-- 4. Projections can be rebuilt from events at any time
-- ============================================================================

-- ============================================================================
-- 1. EVENT STORE - Append-only, immutable event log
-- ============================================================================
-- This is the SOURCE OF TRUTH for all lifecycle state changes.
-- Every action (human or AI) is recorded as an immutable event.

CREATE TABLE IF NOT EXISTS event_store (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Aggregate identification (what entity this event belongs to)
  aggregate_type TEXT NOT NULL,  -- 'company_product', 'deal', etc.
  aggregate_id UUID NOT NULL,     -- The specific entity ID

  -- Event ordering (critical for replay)
  sequence_number BIGINT NOT NULL,  -- Monotonically increasing per aggregate
  global_sequence BIGSERIAL,        -- Global ordering across all events

  -- Event payload
  event_type TEXT NOT NULL,         -- 'StageTransitioned', 'TaskCompleted', etc.
  event_data JSONB NOT NULL,        -- Event-specific payload
  metadata JSONB DEFAULT '{}',      -- Correlation IDs, causation, actor info

  -- Audit trail
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'ai')),
  actor_id TEXT,                    -- User ID, AI model, or 'system'

  -- Timestamps
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- When the event happened
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- When we stored it

  -- Ensure event ordering integrity per aggregate
  CONSTRAINT event_store_aggregate_sequence_unique
    UNIQUE (aggregate_type, aggregate_id, sequence_number)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_event_store_aggregate
  ON event_store (aggregate_type, aggregate_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_event_store_global_sequence
  ON event_store (global_sequence);

CREATE INDEX IF NOT EXISTS idx_event_store_event_type
  ON event_store (event_type);

CREATE INDEX IF NOT EXISTS idx_event_store_occurred_at
  ON event_store (occurred_at);

CREATE INDEX IF NOT EXISTS idx_event_store_actor
  ON event_store (actor_type, actor_id);

-- Prevent any updates or deletes (append-only enforcement)
CREATE OR REPLACE FUNCTION prevent_event_store_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'event_store is immutable. Updates and deletes are not allowed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_event_store_immutability_update ON event_store;
CREATE TRIGGER enforce_event_store_immutability_update
  BEFORE UPDATE ON event_store
  FOR EACH ROW
  EXECUTE FUNCTION prevent_event_store_mutation();

DROP TRIGGER IF EXISTS enforce_event_store_immutability_delete ON event_store;
CREATE TRIGGER enforce_event_store_immutability_delete
  BEFORE DELETE ON event_store
  FOR EACH ROW
  EXECUTE FUNCTION prevent_event_store_mutation();

-- Comments for documentation
COMMENT ON TABLE event_store IS 'Append-only event log. Source of truth for all lifecycle state.';
COMMENT ON COLUMN event_store.sequence_number IS 'Per-aggregate ordering. Must be monotonically increasing.';
COMMENT ON COLUMN event_store.global_sequence IS 'Global ordering for projector processing.';
COMMENT ON COLUMN event_store.event_data IS 'Event-specific payload. Schema varies by event_type.';
COMMENT ON COLUMN event_store.metadata IS 'Cross-cutting concerns: correlation_id, causation_id, request_id, etc.';

-- ============================================================================
-- 2. PRODUCT PROCESSES - Versioned lifecycle definitions
-- ============================================================================
-- Defines the lifecycle processes that company_products follow.
-- Supports versioning so we can evolve processes without breaking history.

CREATE TYPE process_type AS ENUM ('sales', 'onboarding', 'engagement');
CREATE TYPE process_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE IF NOT EXISTS product_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Process identification
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  process_type process_type NOT NULL,

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  status process_status NOT NULL DEFAULT 'draft',

  -- Metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Configuration
  config JSONB DEFAULT '{}',  -- Process-level settings

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,

  -- Version must be unique per product/type
  CONSTRAINT product_processes_version_unique
    UNIQUE (product_id, process_type, version)
);

-- Only one published version per product/type (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_processes_unique_published
  ON product_processes (product_id, process_type)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_product_processes_product
  ON product_processes (product_id);

CREATE INDEX IF NOT EXISTS idx_product_processes_published
  ON product_processes (product_id, process_type)
  WHERE status = 'published';

COMMENT ON TABLE product_processes IS 'Versioned lifecycle process definitions per product.';
COMMENT ON COLUMN product_processes.status IS 'Only published processes are executable.';

-- ============================================================================
-- 3. PRODUCT PROCESS STAGES - Ordered stages per process version
-- ============================================================================
-- Defines the stages within each process version.
-- Stages are ordered and can have SLAs and exit criteria.

CREATE TABLE IF NOT EXISTS product_process_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent process
  process_id UUID NOT NULL REFERENCES product_processes(id) ON DELETE CASCADE,

  -- Stage definition
  name TEXT NOT NULL,
  slug TEXT NOT NULL,  -- URL-safe identifier
  description TEXT,

  -- Ordering
  stage_order INTEGER NOT NULL,

  -- SLA configuration
  sla_days INTEGER,  -- Target days in this stage
  sla_warning_days INTEGER,  -- Warning threshold

  -- Exit criteria (optional structured validation)
  exit_criteria JSONB DEFAULT '[]',  -- Array of criteria objects

  -- Stage behavior
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,  -- Ends the process
  terminal_type TEXT CHECK (
    terminal_type IS NULL OR
    terminal_type IN ('won', 'lost', 'completed', 'churned', 'cancelled')
  ),

  -- Visual configuration
  color TEXT,
  icon TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Stage order must be unique within process
  CONSTRAINT product_process_stages_order_unique
    UNIQUE (process_id, stage_order),

  -- Slug must be unique within process
  CONSTRAINT product_process_stages_slug_unique
    UNIQUE (process_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_product_process_stages_process
  ON product_process_stages (process_id, stage_order);

COMMENT ON TABLE product_process_stages IS 'Ordered stages within each process version.';
COMMENT ON COLUMN product_process_stages.exit_criteria IS 'JSON array of required conditions to exit this stage.';
COMMENT ON COLUMN product_process_stages.is_terminal IS 'True if this stage ends the process lifecycle.';

-- ============================================================================
-- 4. COMPANY PRODUCT READ MODEL - Current state projection
-- ============================================================================
-- This is a PROJECTION - derived entirely from event_store.
-- NEVER write to this table directly from APIs.
-- Use the projector to rebuild from events.

CREATE TABLE IF NOT EXISTS company_product_read_model (
  -- Identity (mirrors company_products)
  company_product_id UUID PRIMARY KEY REFERENCES company_products(id) ON DELETE CASCADE,

  -- Denormalized for query efficiency
  company_id UUID NOT NULL,
  product_id UUID NOT NULL,

  -- Current lifecycle state
  current_process_type process_type,
  current_process_id UUID REFERENCES product_processes(id),
  current_stage_id UUID REFERENCES product_process_stages(id),
  current_stage_name TEXT,
  current_stage_slug TEXT,

  -- Stage timing
  stage_entered_at TIMESTAMPTZ,
  stage_sla_deadline TIMESTAMPTZ,
  stage_sla_warning_at TIMESTAMPTZ,
  is_sla_breached BOOLEAN DEFAULT FALSE,
  is_sla_warning BOOLEAN DEFAULT FALSE,

  -- Process timing
  process_started_at TIMESTAMPTZ,
  process_completed_at TIMESTAMPTZ,

  -- Derived metrics
  days_in_current_stage INTEGER,
  total_process_days INTEGER,
  stage_transition_count INTEGER DEFAULT 0,

  -- Health indicators
  health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_factors JSONB DEFAULT '[]',

  -- Last activity
  last_event_at TIMESTAMPTZ,
  last_event_type TEXT,
  last_event_sequence BIGINT,

  -- Projection metadata
  projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  projection_version INTEGER NOT NULL DEFAULT 1,

  -- Indexes for common queries
  CONSTRAINT company_product_read_model_company_fk
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT company_product_read_model_product_fk
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cprm_company
  ON company_product_read_model (company_id);

CREATE INDEX IF NOT EXISTS idx_cprm_product
  ON company_product_read_model (product_id);

CREATE INDEX IF NOT EXISTS idx_cprm_current_stage
  ON company_product_read_model (current_stage_id);

CREATE INDEX IF NOT EXISTS idx_cprm_process_type
  ON company_product_read_model (current_process_type);

CREATE INDEX IF NOT EXISTS idx_cprm_sla_breached
  ON company_product_read_model (is_sla_breached)
  WHERE is_sla_breached = TRUE;

CREATE INDEX IF NOT EXISTS idx_cprm_health
  ON company_product_read_model (health_score, risk_level);

COMMENT ON TABLE company_product_read_model IS 'PROJECTION: Current lifecycle state. Derived from event_store. Do not write directly.';

-- ============================================================================
-- 5. COMPANY PRODUCT STAGE FACTS - Stage duration analytics
-- ============================================================================
-- Records each stage entry/exit for duration analytics.
-- This is a PROJECTION - derived from stage transition events.

CREATE TABLE IF NOT EXISTS company_product_stage_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  company_product_id UUID NOT NULL REFERENCES company_products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  product_id UUID NOT NULL,

  -- Stage information
  process_id UUID NOT NULL REFERENCES product_processes(id),
  process_type process_type NOT NULL,
  stage_id UUID NOT NULL REFERENCES product_process_stages(id),
  stage_name TEXT NOT NULL,
  stage_slug TEXT NOT NULL,
  stage_order INTEGER NOT NULL,

  -- Timing
  entered_at TIMESTAMPTZ NOT NULL,
  exited_at TIMESTAMPTZ,
  duration_seconds BIGINT,  -- Calculated on exit
  duration_business_days NUMERIC(10,2),  -- Excludes weekends

  -- SLA tracking
  sla_days INTEGER,
  sla_met BOOLEAN,  -- Set on exit
  days_over_sla INTEGER,  -- If breached

  -- Exit information
  exit_reason TEXT,  -- 'progressed', 'regressed', 'completed', 'cancelled'
  exit_event_id UUID REFERENCES event_store(id),

  -- Entry information
  entry_event_id UUID REFERENCES event_store(id),

  -- Projection metadata
  projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cpsf_company_product
  ON company_product_stage_facts (company_product_id);

CREATE INDEX IF NOT EXISTS idx_cpsf_stage
  ON company_product_stage_facts (stage_id);

CREATE INDEX IF NOT EXISTS idx_cpsf_process
  ON company_product_stage_facts (process_id, process_type);

CREATE INDEX IF NOT EXISTS idx_cpsf_entered_at
  ON company_product_stage_facts (entered_at);

CREATE INDEX IF NOT EXISTS idx_cpsf_sla_breached
  ON company_product_stage_facts (sla_met)
  WHERE sla_met = FALSE;

COMMENT ON TABLE company_product_stage_facts IS 'PROJECTION: Stage entry/exit facts for duration analytics.';

-- ============================================================================
-- 6. PRODUCT PIPELINE STAGE COUNTS - Kanban optimization
-- ============================================================================
-- Pre-aggregated counts per stage for fast kanban rendering.
-- This is a PROJECTION - rebuilt from company_product_read_model.

CREATE TABLE IF NOT EXISTS product_pipeline_stage_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dimensions
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES product_processes(id) ON DELETE CASCADE,
  process_type process_type NOT NULL,
  stage_id UUID NOT NULL REFERENCES product_process_stages(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  stage_order INTEGER NOT NULL,

  -- Metrics
  total_count INTEGER NOT NULL DEFAULT 0,
  active_count INTEGER NOT NULL DEFAULT 0,  -- Not stalled
  stalled_count INTEGER NOT NULL DEFAULT 0,  -- Over SLA warning
  breached_count INTEGER NOT NULL DEFAULT 0,  -- Over SLA

  -- Value metrics (for sales)
  total_value NUMERIC(15,2) DEFAULT 0,
  weighted_value NUMERIC(15,2) DEFAULT 0,  -- Probability-weighted

  -- Velocity metrics
  avg_days_in_stage NUMERIC(10,2),
  median_days_in_stage NUMERIC(10,2),

  -- Projection metadata
  projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint
  CONSTRAINT product_pipeline_stage_counts_unique
    UNIQUE (product_id, process_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_ppsc_product
  ON product_pipeline_stage_counts (product_id);

CREATE INDEX IF NOT EXISTS idx_ppsc_process
  ON product_pipeline_stage_counts (process_id);

COMMENT ON TABLE product_pipeline_stage_counts IS 'PROJECTION: Aggregated counts per stage for kanban views.';

-- ============================================================================
-- 7. PROJECTOR CHECKPOINTS - Projector processing state
-- ============================================================================
-- Tracks the last processed event for each projector.
-- Enables incremental processing and restart recovery.

CREATE TABLE IF NOT EXISTS projector_checkpoints (
  -- Projector identification
  projector_name TEXT PRIMARY KEY,

  -- Processing state
  last_processed_global_sequence BIGINT NOT NULL DEFAULT 0,
  last_processed_event_id UUID REFERENCES event_store(id),
  last_processed_at TIMESTAMPTZ,

  -- Health monitoring
  events_processed_count BIGINT NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,

  -- State
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'rebuilding', 'error')),

  -- Metadata
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE projector_checkpoints IS 'Tracks projector processing state for incremental updates.';
COMMENT ON COLUMN projector_checkpoints.last_processed_global_sequence IS 'Resume point for projector. Process events with global_sequence > this value.';

-- ============================================================================
-- INITIAL DATA: Insert default projector checkpoints
-- ============================================================================

INSERT INTO projector_checkpoints (projector_name, status) VALUES
  ('company_product_read_model', 'active'),
  ('company_product_stage_facts', 'active'),
  ('product_pipeline_stage_counts', 'active')
ON CONFLICT (projector_name) DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE event_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_process_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_product_read_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_product_stage_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_pipeline_stage_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projector_checkpoints ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for projectors)
CREATE POLICY "Service role full access on event_store"
  ON event_store FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on product_processes"
  ON product_processes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on product_process_stages"
  ON product_process_stages FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on company_product_read_model"
  ON company_product_read_model FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on company_product_stage_facts"
  ON company_product_stage_facts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on product_pipeline_stage_counts"
  ON product_pipeline_stage_counts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on projector_checkpoints"
  ON projector_checkpoints FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can read events they have access to
CREATE POLICY "Authenticated users can read events"
  ON event_store FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert events (but not update/delete)
CREATE POLICY "Authenticated users can insert events"
  ON event_store FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can read projections
CREATE POLICY "Authenticated users can read read_model"
  ON company_product_read_model FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read stage_facts"
  ON company_product_stage_facts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read pipeline_counts"
  ON product_pipeline_stage_counts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read processes"
  ON product_processes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read stages"
  ON product_process_stages FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get next sequence number for an aggregate
CREATE OR REPLACE FUNCTION get_next_event_sequence(
  p_aggregate_type TEXT,
  p_aggregate_id UUID
) RETURNS BIGINT AS $$
DECLARE
  next_seq BIGINT;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO next_seq
  FROM event_store
  WHERE aggregate_type = p_aggregate_type
    AND aggregate_id = p_aggregate_id;

  RETURN next_seq;
END;
$$ LANGUAGE plpgsql;

-- Function to append an event (with automatic sequence numbering)
CREATE OR REPLACE FUNCTION append_event(
  p_aggregate_type TEXT,
  p_aggregate_id UUID,
  p_event_type TEXT,
  p_event_data JSONB,
  p_actor_type TEXT,
  p_actor_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  new_event_id UUID;
  next_seq BIGINT;
BEGIN
  -- Get next sequence number
  next_seq := get_next_event_sequence(p_aggregate_type, p_aggregate_id);

  -- Insert the event
  INSERT INTO event_store (
    aggregate_type,
    aggregate_id,
    sequence_number,
    event_type,
    event_data,
    actor_type,
    actor_id,
    metadata
  ) VALUES (
    p_aggregate_type,
    p_aggregate_id,
    next_seq,
    p_event_type,
    p_event_data,
    p_actor_type,
    p_actor_id,
    p_metadata
  ) RETURNING id INTO new_event_id;

  RETURN new_event_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION append_event IS 'Appends an event to the event store with automatic sequence numbering.';

-- Function to get all events for an aggregate
CREATE OR REPLACE FUNCTION get_aggregate_events(
  p_aggregate_type TEXT,
  p_aggregate_id UUID,
  p_from_sequence BIGINT DEFAULT 0
) RETURNS SETOF event_store AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM event_store
  WHERE aggregate_type = p_aggregate_type
    AND aggregate_id = p_aggregate_id
    AND sequence_number > p_from_sequence
  ORDER BY sequence_number ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_aggregate_events IS 'Returns all events for an aggregate, optionally from a specific sequence.';
