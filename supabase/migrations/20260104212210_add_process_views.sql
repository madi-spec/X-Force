-- Add tracking fields to company_products if not exist
ALTER TABLE company_products
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Ensure last_stage_moved_at has a default
ALTER TABLE company_products
ALTER COLUMN last_stage_moved_at SET DEFAULT NOW();

-- Create index for process queries
CREATE INDEX IF NOT EXISTS idx_cp_process_query
ON company_products(product_id, status, owner_user_id)
WHERE status IN ('in_sales', 'in_onboarding', 'active');

-- Create view for pipeline items with computed health
CREATE OR REPLACE VIEW product_pipeline_items AS
SELECT
  cp.id,
  cp.company_id,
  c.name as company_name,
  c.customer_type as company_type,
  cp.product_id,
  p.name as product_name,
  p.color as product_color,
  p.icon as product_icon,
  cp.status,
  cp.current_stage_id,
  ps.name as stage_name,
  ps.stage_order as stage_order,
  cp.owner_user_id as owner_id,
  u.name as owner_name,
  UPPER(LEFT(SPLIT_PART(u.name, ' ', 1), 1) || LEFT(SPLIT_PART(u.name, ' ', 2), 1)) as owner_initials,
  cp.mrr,
  cp.created_at,
  cp.updated_at,
  cp.last_activity_at,
  cp.last_stage_moved_at,
  EXTRACT(DAY FROM NOW() - COALESCE(cp.last_stage_moved_at, cp.stage_entered_at, cp.created_at))::INTEGER as days_in_stage,
  CASE
    WHEN EXTRACT(DAY FROM NOW() - COALESCE(cp.last_activity_at, cp.last_human_touch_at, cp.created_at)) > 14 THEN 'attention'
    WHEN EXTRACT(DAY FROM NOW() - COALESCE(cp.last_stage_moved_at, cp.stage_entered_at, cp.created_at)) >= 30 THEN 'stalled'
    ELSE 'healthy'
  END as health_status,
  CASE
    WHEN EXTRACT(DAY FROM NOW() - COALESCE(cp.last_activity_at, cp.last_human_touch_at, cp.created_at)) > 14
      THEN 'No activity ' || EXTRACT(DAY FROM NOW() - COALESCE(cp.last_activity_at, cp.last_human_touch_at, cp.created_at))::INTEGER || 'd'
    WHEN EXTRACT(DAY FROM NOW() - COALESCE(cp.last_stage_moved_at, cp.stage_entered_at, cp.created_at)) >= 30
      THEN 'Stalled ' || EXTRACT(DAY FROM NOW() - COALESCE(cp.last_stage_moved_at, cp.stage_entered_at, cp.created_at))::INTEGER || 'd'
    ELSE NULL
  END as health_reason
FROM company_products cp
JOIN companies c ON c.id = cp.company_id
JOIN products p ON p.id = cp.product_id
LEFT JOIN product_sales_stages ps ON ps.id = cp.current_stage_id
LEFT JOIN users u ON u.id = cp.owner_user_id
WHERE cp.status IN ('in_sales', 'in_onboarding', 'active');

-- Grant access to the view
GRANT SELECT ON product_pipeline_items TO authenticated;
GRANT SELECT ON product_pipeline_items TO service_role;
