-- Deal Conversion Tracking
-- Adds columns to track legacy deal conversion to company_products

-- Add conversion tracking columns to deals table
ALTER TABLE deals
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS converted_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS conversion_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS converted_to_company_product_ids UUID[] DEFAULT NULL;

-- Add index for finding converted/unconverted deals
CREATE INDEX IF NOT EXISTS idx_deals_conversion_status ON deals(conversion_status) WHERE conversion_status IS NOT NULL;

-- Add converted_from_deal_id to company_products if not exists
ALTER TABLE company_products
ADD COLUMN IF NOT EXISTS converted_from_deal_id UUID REFERENCES deals(id);

-- Create index for finding company_products by source deal
CREATE INDEX IF NOT EXISTS idx_company_products_converted_from ON company_products(converted_from_deal_id) WHERE converted_from_deal_id IS NOT NULL;

-- Optional: Create a dedicated mapping table for detailed tracking
CREATE TABLE IF NOT EXISTS deal_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_deal_id UUID NOT NULL REFERENCES deals(id),
  company_product_id UUID NOT NULL REFERENCES company_products(id),
  product_id UUID NOT NULL REFERENCES products(id),
  converted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_by UUID REFERENCES users(id),
  first_activity_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  activities_count INT DEFAULT 0,
  communications_count INT DEFAULT 0,
  meetings_count INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(legacy_deal_id, product_id)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_deal_conversions_legacy_deal ON deal_conversions(legacy_deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_conversions_company_product ON deal_conversions(company_product_id);

-- Add RLS policies
ALTER TABLE deal_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deal conversions"
  ON deal_conversions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert deal conversions"
  ON deal_conversions FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE deal_conversions IS 'Tracks legacy deal to company_product conversions';
COMMENT ON COLUMN deals.converted_at IS 'Timestamp when deal was converted to new system';
COMMENT ON COLUMN deals.converted_by IS 'User who performed the conversion';
COMMENT ON COLUMN deals.conversion_status IS 'Status: converted, partial, failed';
COMMENT ON COLUMN deals.converted_to_company_product_ids IS 'Array of company_product UUIDs created from this deal';
