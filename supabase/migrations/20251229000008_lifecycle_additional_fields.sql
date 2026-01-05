-- ============================================================================
-- LIFECYCLE ADDITIONAL FIELDS
-- ============================================================================
-- Adds owner, tier, MRR, seats, and next step tracking to the read model.
-- These fields are set via command events and projected to the read model.
-- ============================================================================

-- Add owner tracking
ALTER TABLE company_product_read_model
  ADD COLUMN IF NOT EXISTS owner_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_name TEXT;

-- Add tier tracking (1-5 priority)
ALTER TABLE company_product_read_model
  ADD COLUMN IF NOT EXISTS tier INTEGER CHECK (tier IS NULL OR (tier >= 1 AND tier <= 5));

-- Add MRR tracking
ALTER TABLE company_product_read_model
  ADD COLUMN IF NOT EXISTS mrr NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS mrr_currency TEXT DEFAULT 'USD';

-- Add seats tracking
ALTER TABLE company_product_read_model
  ADD COLUMN IF NOT EXISTS seats INTEGER CHECK (seats IS NULL OR seats >= 0);

-- Add next step tracking
ALTER TABLE company_product_read_model
  ADD COLUMN IF NOT EXISTS next_step TEXT,
  ADD COLUMN IF NOT EXISTS next_step_due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_next_step_overdue BOOLEAN DEFAULT FALSE;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cprm_owner
  ON company_product_read_model (owner_id)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cprm_tier
  ON company_product_read_model (tier)
  WHERE tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cprm_next_step_overdue
  ON company_product_read_model (is_next_step_overdue)
  WHERE is_next_step_overdue = TRUE;

-- Comments
COMMENT ON COLUMN company_product_read_model.owner_id IS 'Current owner/rep ID';
COMMENT ON COLUMN company_product_read_model.owner_name IS 'Current owner/rep name for display';
COMMENT ON COLUMN company_product_read_model.tier IS 'Priority tier (1=highest, 5=lowest)';
COMMENT ON COLUMN company_product_read_model.mrr IS 'Monthly recurring revenue in currency units';
COMMENT ON COLUMN company_product_read_model.mrr_currency IS 'Currency code for MRR (default USD)';
COMMENT ON COLUMN company_product_read_model.seats IS 'Number of seats/licenses';
COMMENT ON COLUMN company_product_read_model.next_step IS 'Next action to take';
COMMENT ON COLUMN company_product_read_model.next_step_due_date IS 'When next step is due';
COMMENT ON COLUMN company_product_read_model.is_next_step_overdue IS 'True if next step is past due';
