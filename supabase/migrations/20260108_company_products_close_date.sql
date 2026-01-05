-- ============================================================================
-- PHASE 4.3: Add expected_close_date to company_products
-- ============================================================================
-- This migration adds the expected_close_date column to support deals migration.
-- ============================================================================

-- Add expected_close_date to company_products
ALTER TABLE company_products
ADD COLUMN IF NOT EXISTS expected_close_date DATE;

-- Add close_confidence to company_products (from deals)
ALTER TABLE company_products
ADD COLUMN IF NOT EXISTS close_confidence INTEGER;

-- Add last_human_touch_at for tracking engagement
ALTER TABLE company_products
ADD COLUMN IF NOT EXISTS last_human_touch_at TIMESTAMPTZ;

-- Add metadata for additional deal information during migration
ALTER TABLE company_products
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Document the columns
COMMENT ON COLUMN company_products.expected_close_date IS 'Expected close date for sales opportunities';
COMMENT ON COLUMN company_products.close_confidence IS 'Confidence level 0-100 for closing the deal';
COMMENT ON COLUMN company_products.last_human_touch_at IS 'Last time a human interacted with this opportunity';
COMMENT ON COLUMN company_products.metadata IS 'Additional metadata, including migration info from deals table';
