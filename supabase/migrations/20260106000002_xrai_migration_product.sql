-- X-RAI 1.0 to 2.0 Migration Product
-- Creates a dedicated pipeline for migrating existing X-RAI 1.0 customers to 2.0

-- ============================================================================
-- 1. CREATE MIGRATION PRODUCT
-- ============================================================================

INSERT INTO products (
  name,
  slug,
  description,
  product_type,
  is_active,
  is_sellable,
  display_order,
  color,
  icon
) VALUES (
  'X-RAI 1.0 → 2.0 Migration',
  'xrai-migration',
  'Migration pipeline for converting X-RAI 1.0 customers to X-RAI 2.0',
  'suite',
  true,
  true,
  15, -- After X-RAI 2.0 but visible
  '#F97316', -- Orange to indicate migration/transition
  '🔄'
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  is_sellable = EXCLUDED.is_sellable,
  display_order = EXCLUDED.display_order,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon;

-- ============================================================================
-- 2. CREATE MIGRATION SALES STAGES (using product_sales_stages for consistency)
-- ============================================================================

-- Get the migration product ID
DO $$
DECLARE
  v_product_id UUID;
BEGIN
  SELECT id INTO v_product_id FROM products WHERE slug = 'xrai-migration';

  -- Delete existing stages for clean insert
  DELETE FROM product_sales_stages WHERE product_id = v_product_id;

  -- Insert migration stages
  INSERT INTO product_sales_stages (product_id, name, slug, stage_order, goal) VALUES
    (v_product_id, 'Engaging', 'engaging', 1, 'Initial contact about upgrade opportunity'),
    (v_product_id, 'Demo', 'demo', 2, 'Show X-RAI 2.0 platform and discuss advantages'),
    (v_product_id, 'Scheduled', 'scheduled', 3, 'Transition date confirmed');
END $$;

-- ============================================================================
-- 3. CREATE COMPANY_PRODUCTS FOR ALL ACTIVE X-RAI 1.0 CUSTOMERS
-- ============================================================================

-- Insert migration records for all active X-RAI 1.0 customers
-- who don't already have an X-RAI 2.0 record (active or in progress)
INSERT INTO company_products (
  company_id,
  product_id,
  status,
  current_stage_id,
  stage_entered_at,
  activated_at,
  mrr,
  notes
)
SELECT
  cp1.company_id,
  (SELECT id FROM products WHERE slug = 'xrai-migration'),
  'active',  -- Start as active (not in pipeline yet)
  NULL,      -- No stage until outreach begins
  NULL,
  NOW(),
  cp1.mrr,
  'X-RAI 1.0 customer - pending migration outreach'
FROM company_products cp1
WHERE cp1.product_id = (SELECT id FROM products WHERE slug = 'xrai-1')
  AND cp1.status = 'active'
  -- Exclude companies that already have X-RAI 2.0 (any status except declined)
  AND NOT EXISTS (
    SELECT 1 FROM company_products cp2
    WHERE cp2.company_id = cp1.company_id
      AND cp2.product_id = (SELECT id FROM products WHERE slug = 'xrai-2')
      AND cp2.status NOT IN ('declined', 'churned')
  )
  -- Exclude companies that already have a migration record
  AND NOT EXISTS (
    SELECT 1 FROM company_products cp3
    WHERE cp3.company_id = cp1.company_id
      AND cp3.product_id = (SELECT id FROM products WHERE slug = 'xrai-migration')
  )
ON CONFLICT (company_id, product_id) DO NOTHING;
