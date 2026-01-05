-- Work Item Projections
-- Materialized views derived from WorkItem events
-- These are read-optimized projections, not source of truth

-- ============================================================================
-- WORK ITEM DETAIL PROJECTION
-- ============================================================================
-- Primary key: work_item_id
-- Contains full detail for a single work item, derived from events

CREATE TABLE IF NOT EXISTS work_item_projections (
  work_item_id UUID PRIMARY KEY,
  focus_lens TEXT NOT NULL CHECK (focus_lens IN ('sales', 'onboarding', 'customer_success', 'support')),
  queue_id TEXT NOT NULL,

  -- Entity references (immutable from created event)
  company_id UUID NOT NULL REFERENCES companies(id),
  company_name TEXT NOT NULL,
  deal_id UUID REFERENCES deals(id),
  case_id UUID,
  communication_id UUID,
  contact_id UUID REFERENCES contacts(id),

  -- Source signal
  source_type TEXT NOT NULL CHECK (source_type IN ('communication', 'scheduler', 'command_center', 'lifecycle_stage')),
  signal_type TEXT NOT NULL,
  signal_id TEXT,

  -- Display
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  why_here TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  priority_score INTEGER NOT NULL DEFAULT 50,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('open', 'snoozed', 'resolved')) DEFAULT 'open',
  snoozed_until TIMESTAMPTZ,

  -- Assignment
  assigned_to_user_id UUID REFERENCES users(id),
  assigned_to_team_id UUID,

  -- Resolution
  resolution_type TEXT CHECK (resolution_type IN ('completed', 'cancelled', 'merged', 'invalid')),
  resolution_notes TEXT,
  resolved_by_action TEXT,
  resolved_at TIMESTAMPTZ,

  -- Attached signals (JSON array)
  attached_signals JSONB NOT NULL DEFAULT '[]',

  -- Analysis artifact
  analysis_artifact_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Event replay checkpoint
  last_event_sequence INTEGER NOT NULL DEFAULT 0
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_work_item_projections_assigned_user
  ON work_item_projections(assigned_to_user_id, focus_lens, status);

CREATE INDEX IF NOT EXISTS idx_work_item_projections_queue
  ON work_item_projections(queue_id, status, priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_work_item_projections_company
  ON work_item_projections(company_id);

CREATE INDEX IF NOT EXISTS idx_work_item_projections_status_priority
  ON work_item_projections(status, priority_score DESC, created_at);

-- ============================================================================
-- WORK QUEUE PROJECTION
-- ============================================================================
-- Composite key: user_id + focus_lens + queue_id
-- Aggregated queue summary for fast dashboard loading

CREATE TABLE IF NOT EXISTS work_queue_projections (
  user_id UUID NOT NULL REFERENCES users(id),
  focus_lens TEXT NOT NULL CHECK (focus_lens IN ('sales', 'onboarding', 'customer_success', 'support')),
  queue_id TEXT NOT NULL,

  -- Queue summary counts
  total_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,

  -- Ordered item IDs (for quick list rendering)
  item_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],

  -- Projection metadata
  last_event_sequence INTEGER NOT NULL DEFAULT 0,
  last_projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite primary key
  PRIMARY KEY (user_id, focus_lens, queue_id)
);

-- Index for fetching all queues for a user/lens
CREATE INDEX IF NOT EXISTS idx_work_queue_projections_user_lens
  ON work_queue_projections(user_id, focus_lens);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE work_item_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_queue_projections ENABLE ROW LEVEL SECURITY;

-- Users can see work items assigned to them or their team
CREATE POLICY "Users can view their assigned work items"
  ON work_item_projections
  FOR SELECT
  USING (
    assigned_to_user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
    OR
    -- Allow viewing items for companies they own products for
    company_id IN (
      SELECT cp.company_id
      FROM company_products cp
      JOIN users u ON cp.owner_user_id = u.id
      WHERE u.auth_id = auth.uid()
    )
  );

-- Users can only update their own assigned items
CREATE POLICY "Users can update their assigned work items"
  ON work_item_projections
  FOR UPDATE
  USING (
    assigned_to_user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Service role can manage all work items (for projector)
CREATE POLICY "Service role can manage all work items"
  ON work_item_projections
  FOR ALL
  USING (auth.role() = 'service_role');

-- Users can view their queue projections
CREATE POLICY "Users can view their queue projections"
  ON work_queue_projections
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Service role can manage all queue projections
CREATE POLICY "Service role can manage all queue projections"
  ON work_queue_projections
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_work_item_projection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_work_item_projection_updated_at
  BEFORE UPDATE ON work_item_projections
  FOR EACH ROW
  EXECUTE FUNCTION update_work_item_projection_updated_at();
