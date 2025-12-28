-- Operating Layer: Attention Flags, Company Product Extensions, Triage Decisions
-- This migration adds the operating layer tables for AI-driven sales orchestration
--
-- Core Principle: Intelligence comes from AI analysis → communicationType → sales playbook mapping
-- NO keyword-based logic - the AI analysis provides the semantic understanding

-- ============================================
-- 1. ENUM TYPES
-- ============================================

-- Source of the attention flag
CREATE TYPE attention_flag_source_type AS ENUM (
  'communication',  -- Triggered by communication analysis
  'pipeline',       -- Triggered by pipeline/stage events
  'system'          -- Triggered by system rules (stale data, errors, etc.)
);

-- Types of attention flags
CREATE TYPE attention_flag_type AS ENUM (
  'NEEDS_REPLY',              -- Awaiting response from us
  'BOOK_MEETING_APPROVAL',    -- AI wants to book meeting, needs human approval
  'PROPOSAL_APPROVAL',        -- Proposal ready for review/send
  'PRICING_EXCEPTION',        -- Non-standard pricing needs approval
  'CLOSE_DECISION',           -- Ready to close, human decision needed
  'HIGH_RISK_OBJECTION',      -- Serious objection detected
  'NO_NEXT_STEP_AFTER_MEETING', -- Meeting happened but no next step scheduled
  'STALE_IN_STAGE',           -- Too long in current stage
  'GHOSTING_AFTER_PROPOSAL',  -- No response after proposal sent
  'DATA_MISSING_BLOCKER',     -- Missing critical data blocking progress
  'SYSTEM_ERROR'              -- System/integration error needs attention
);

-- Severity levels for attention flags
CREATE TYPE attention_flag_severity AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Owner of the attention flag resolution
CREATE TYPE attention_flag_owner AS ENUM (
  'human',  -- Human must resolve
  'ai'      -- AI can handle (with approval if needed)
);

-- Status of the attention flag
CREATE TYPE attention_flag_status AS ENUM (
  'open',
  'snoozed',
  'resolved'
);

-- Risk level for company products
CREATE TYPE company_product_risk_level AS ENUM (
  'none',
  'low',
  'med',
  'high'
);

-- Triage decision types
CREATE TYPE triage_decision_type AS ENUM (
  'REJECT',           -- Not a qualified lead, archive
  'NURTURE',          -- Not ready, add to nurture sequence
  'BOOK',             -- Book a meeting
  'ROUTE_TO_PIPELINE' -- Create/update company product pipeline entry
);


-- ============================================
-- 2. ATTENTION FLAGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS attention_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_product_id UUID REFERENCES company_products(id) ON DELETE CASCADE,

  -- Source
  source_type attention_flag_source_type NOT NULL,
  source_id TEXT,  -- Reference to source record (communication_id, stage_history_id, etc.)

  -- Flag Details
  flag_type attention_flag_type NOT NULL,
  severity attention_flag_severity NOT NULL DEFAULT 'medium',
  reason TEXT NOT NULL,  -- Human-readable explanation
  recommended_action TEXT,  -- What should be done

  -- Ownership
  owner attention_flag_owner NOT NULL DEFAULT 'human',

  -- Status
  status attention_flag_status NOT NULL DEFAULT 'open',
  snoozed_until TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_snooze CHECK (
    (status != 'snoozed') OR (snoozed_until IS NOT NULL)
  )
);

-- Indexes for attention_flags
CREATE INDEX idx_attention_flags_company ON attention_flags(company_id, status);
CREATE INDEX idx_attention_flags_company_product ON attention_flags(company_product_id, status)
  WHERE company_product_id IS NOT NULL;
CREATE INDEX idx_attention_flags_open ON attention_flags(status, severity, created_at)
  WHERE status = 'open';
CREATE INDEX idx_attention_flags_snoozed ON attention_flags(snoozed_until)
  WHERE status = 'snoozed';
CREATE INDEX idx_attention_flags_type ON attention_flags(flag_type, status);
CREATE INDEX idx_attention_flags_source ON attention_flags(source_type, source_id)
  WHERE source_id IS NOT NULL;


-- ============================================
-- 3. COMPANY PRODUCTS EXTENSIONS
-- ============================================

-- Add new columns to company_products
ALTER TABLE company_products
  ADD COLUMN IF NOT EXISTS last_stage_moved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_human_touch_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_ai_touch_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS close_confidence INTEGER CHECK (close_confidence >= 0 AND close_confidence <= 100),
  ADD COLUMN IF NOT EXISTS close_ready BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS risk_level company_product_risk_level,
  ADD COLUMN IF NOT EXISTS open_objections JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS next_step_due_at TIMESTAMPTZ;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_company_products_close_ready ON company_products(close_ready)
  WHERE close_ready = TRUE;
CREATE INDEX IF NOT EXISTS idx_company_products_risk ON company_products(risk_level)
  WHERE risk_level IS NOT NULL AND risk_level != 'none';
CREATE INDEX IF NOT EXISTS idx_company_products_next_step ON company_products(next_step_due_at)
  WHERE next_step_due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_products_stale ON company_products(last_stage_moved_at)
  WHERE status = 'in_sales';


-- ============================================
-- 4. TRIAGE DECISIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS triage_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships (at least one must be set)
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,

  -- Decision
  decision triage_decision_type NOT NULL,
  product_slug TEXT,  -- Which product this relates to (for ROUTE_TO_PIPELINE)
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  reason TEXT NOT NULL,  -- AI's explanation for the decision

  -- Playbook Reference
  playbook_type TEXT NOT NULL,  -- Maps to communicationType from analysis

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_context CHECK (
    company_id IS NOT NULL OR contact_id IS NOT NULL
  ),
  CONSTRAINT valid_product_routing CHECK (
    (decision != 'ROUTE_TO_PIPELINE') OR (product_slug IS NOT NULL)
  )
);

-- Indexes for triage_decisions
CREATE INDEX idx_triage_decisions_company ON triage_decisions(company_id, created_at DESC)
  WHERE company_id IS NOT NULL;
CREATE INDEX idx_triage_decisions_contact ON triage_decisions(contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;
CREATE INDEX idx_triage_decisions_communication ON triage_decisions(communication_id);
CREATE INDEX idx_triage_decisions_decision ON triage_decisions(decision, created_at DESC);
CREATE INDEX idx_triage_decisions_playbook ON triage_decisions(playbook_type, decision);


-- ============================================
-- 5. TRIGGERS
-- ============================================

-- Auto-update timestamps for attention_flags
CREATE OR REPLACE FUNCTION update_attention_flags_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Auto-set resolved_at when status changes to resolved
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attention_flags_updated_at ON attention_flags;
CREATE TRIGGER attention_flags_updated_at
  BEFORE UPDATE ON attention_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_attention_flags_timestamp();

-- Auto-update last_stage_moved_at when stage changes
CREATE OR REPLACE FUNCTION update_company_product_stage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    NEW.last_stage_moved_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS company_products_stage_moved ON company_products;
CREATE TRIGGER company_products_stage_moved
  BEFORE UPDATE ON company_products
  FOR EACH ROW
  EXECUTE FUNCTION update_company_product_stage_timestamp();


-- ============================================
-- 6. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new tables
ALTER TABLE attention_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_decisions ENABLE ROW LEVEL SECURITY;

-- Attention Flags policies
CREATE POLICY "Users can view attention flags for their companies" ON attention_flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_products cp
      WHERE cp.id = attention_flags.company_product_id
      AND cp.owner_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can update their attention flags" ON attention_flags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_products cp
      WHERE cp.id = attention_flags.company_product_id
      AND cp.owner_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "System can insert attention flags" ON attention_flags
  FOR INSERT WITH CHECK (TRUE);

-- Triage Decisions policies
CREATE POLICY "Users can view triage decisions" ON triage_decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
    )
  );

CREATE POLICY "System can insert triage decisions" ON triage_decisions
  FOR INSERT WITH CHECK (TRUE);


-- ============================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE attention_flags IS
  'Flags items that need human attention. Source from AI analysis, pipeline events, or system rules.';

COMMENT ON COLUMN attention_flags.source_type IS
  'Where the flag originated: communication (AI analysis), pipeline (stage events), or system (rules/errors)';

COMMENT ON COLUMN attention_flags.flag_type IS
  'The type of attention needed. Maps to specific workflows and UI treatments.';

COMMENT ON COLUMN attention_flags.owner IS
  'Whether a human must resolve this (human) or AI can handle it with approval (ai)';

COMMENT ON TABLE triage_decisions IS
  'Records AI decisions about how to handle incoming communications. Intelligence comes from AI analysis.';

COMMENT ON COLUMN triage_decisions.playbook_type IS
  'Maps to communicationType from communication_analysis. Determines which sales playbook/sequence to use.';

COMMENT ON COLUMN triage_decisions.product_slug IS
  'For ROUTE_TO_PIPELINE decisions, which product pipeline to route to.';

COMMENT ON COLUMN company_products.close_confidence IS
  'AI-calculated confidence (0-100) that this deal will close successfully.';

COMMENT ON COLUMN company_products.close_ready IS
  'True when deal is ready for closing - all criteria met, awaiting final signature/commitment.';

COMMENT ON COLUMN company_products.risk_level IS
  'Current risk assessment for this opportunity: none, low, med, high.';

COMMENT ON COLUMN company_products.open_objections IS
  'JSONB array of unresolved objections. Each: {objection: string, detected_at: timestamp, severity: string}';

COMMENT ON COLUMN company_products.next_step_due_at IS
  'When the next scheduled action is due for this opportunity.';
