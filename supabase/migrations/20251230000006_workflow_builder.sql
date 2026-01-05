-- ============================================================================
-- VISUAL WORKFLOW BUILDER - DATABASE SCHEMA
-- ============================================================================
-- This migration creates tables for the visual workflow builder that allows
-- designing process flows with nodes and connections.
--
-- Tables:
-- - processes: Workflow definitions tied to a product/process type
-- - process_nodes: Visual nodes on the canvas (stages, triggers, actions, etc.)
-- - process_connections: Bezier curves connecting nodes
-- ============================================================================

-- ============================================================================
-- 1. PROCESSES - Workflow definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  process_type process_type NOT NULL,

  -- Metadata
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),

  -- Canvas state (optional, for restoring view)
  canvas_zoom NUMERIC(4,2) DEFAULT 1.0,
  canvas_pan_x INTEGER DEFAULT 0,
  canvas_pan_y INTEGER DEFAULT 0,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Only one active workflow per product/process_type (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_processes_unique_active
  ON processes (product_id, process_type)
  WHERE (status = 'active');

CREATE INDEX IF NOT EXISTS idx_processes_product ON processes (product_id);
CREATE INDEX IF NOT EXISTS idx_processes_type ON processes (process_type);

COMMENT ON TABLE processes IS 'Visual workflow definitions for the process builder';

-- ============================================================================
-- 2. PROCESS NODES - Visual nodes on the canvas
-- ============================================================================
CREATE TABLE IF NOT EXISTS process_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent workflow
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,

  -- Node type and identity
  type TEXT NOT NULL CHECK (type IN ('trigger', 'stage', 'condition', 'aiAction', 'humanAction', 'exit')),
  item_id TEXT NOT NULL,  -- Identifier for the specific node type (e.g., 'new_lead', 'qualifying')

  -- Display
  label TEXT NOT NULL,
  icon TEXT,
  color TEXT,

  -- Position on canvas
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,

  -- Node-specific configuration
  config JSONB DEFAULT '{}',

  -- For stage nodes: link to the actual process stage
  stage_id UUID REFERENCES product_process_stages(id),

  -- Ordering (for non-visual representations)
  node_order INTEGER,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_nodes_process ON process_nodes (process_id);
CREATE INDEX IF NOT EXISTS idx_process_nodes_type ON process_nodes (type);
CREATE INDEX IF NOT EXISTS idx_process_nodes_stage ON process_nodes (stage_id);

COMMENT ON TABLE process_nodes IS 'Visual nodes (stages, triggers, actions) on the workflow canvas';
COMMENT ON COLUMN process_nodes.item_id IS 'Identifier for the node template (e.g., new_lead, send_email)';
COMMENT ON COLUMN process_nodes.config IS 'Node-specific settings (e.g., email template, condition logic)';

-- ============================================================================
-- 3. PROCESS CONNECTIONS - Lines between nodes
-- ============================================================================
CREATE TABLE IF NOT EXISTS process_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent workflow
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,

  -- Connection endpoints
  from_node_id UUID NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  from_port TEXT NOT NULL DEFAULT 'default',  -- Output port identifier
  to_node_id UUID NOT NULL REFERENCES process_nodes(id) ON DELETE CASCADE,
  to_port TEXT NOT NULL DEFAULT 'input',  -- Input port identifier

  -- Visual styling
  label TEXT,  -- Optional label on the connection
  color TEXT,
  style TEXT NOT NULL DEFAULT 'solid' CHECK (style IN ('solid', 'dashed')),

  -- Condition (for conditional branching)
  condition JSONB,  -- e.g., { "type": "expression", "value": "score > 80" }

  -- Ordering (for execution priority when multiple connections)
  connection_order INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate connections
  CONSTRAINT process_connections_unique
    UNIQUE (process_id, from_node_id, from_port, to_node_id, to_port)
);

CREATE INDEX IF NOT EXISTS idx_process_connections_process ON process_connections (process_id);
CREATE INDEX IF NOT EXISTS idx_process_connections_from ON process_connections (from_node_id);
CREATE INDEX IF NOT EXISTS idx_process_connections_to ON process_connections (to_node_id);

COMMENT ON TABLE process_connections IS 'Connections (edges) between workflow nodes';
COMMENT ON COLUMN process_connections.from_port IS 'Output port on source node (e.g., default, yes, no)';
COMMENT ON COLUMN process_connections.to_port IS 'Input port on target node (usually input)';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_connections ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on processes"
  ON processes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on process_nodes"
  ON process_nodes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on process_connections"
  ON process_connections FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can read all
CREATE POLICY "Authenticated users can read processes"
  ON processes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read process_nodes"
  ON process_nodes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read process_connections"
  ON process_connections FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can manage workflows
CREATE POLICY "Authenticated users can insert processes"
  ON processes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update processes"
  ON processes FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete processes"
  ON processes FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert process_nodes"
  ON process_nodes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update process_nodes"
  ON process_nodes FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete process_nodes"
  ON process_nodes FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert process_connections"
  ON process_connections FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update process_connections"
  ON process_connections FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete process_connections"
  ON process_connections FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER processes_updated_at
  BEFORE UPDATE ON processes
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();

CREATE TRIGGER process_nodes_updated_at
  BEFORE UPDATE ON process_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();

CREATE TRIGGER process_connections_updated_at
  BEFORE UPDATE ON process_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();
