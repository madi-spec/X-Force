-- ============================================
-- SEED: X-RAI PRODUCT CATALOG
-- ============================================

-- BASE PRODUCTS (determines customer type)
INSERT INTO products (name, slug, product_type, description, is_sellable, display_order, icon, color) VALUES
  ('Voice for Pest', 'vfp', 'base', 'Phone system for pest control companies', false, 1, '📞', '#10B981'),
  ('Voice for Turf', 'vft', 'base', 'Phone system for lawn care companies', false, 2, '📞', '#10B981')
ON CONFLICT (slug) DO NOTHING;

-- MAIN SELLABLE PRODUCTS
INSERT INTO products (name, slug, product_type, description, is_sellable, display_order, icon, color, pricing_model) VALUES
  ('Summary Note', 'summary-note', 'suite', 'AI-powered call summaries', true, 10, '📝', '#6366F1', 'flat'),
  ('Smart Data Plus', 'smart-data-plus', 'suite', 'Enhanced data analytics', true, 20, '📊', '#8B5CF6', 'flat'),
  ('X-RAI 1.0', 'xrai-1', 'suite', 'First generation X-RAI platform', true, 30, '🤖', '#3B82F6', 'tiered'),
  ('X-RAI 2.0', 'xrai-2', 'suite', 'Next generation AI platform with Performance Center, Action Hub, and Accountability Hub', true, 40, '🚀', '#EC4899', 'per_seat'),
  ('AI Agents', 'ai-agents', 'suite', 'AI-powered voice agents for reception, scheduling, sales, and billing', true, 50, '🤖', '#F59E0B', 'per_seat')
ON CONFLICT (slug) DO NOTHING;

-- X-RAI 2.0 MODULES
INSERT INTO products (name, slug, product_type, parent_product_id, description, is_sellable, display_order, icon) VALUES
  ('Performance Center', 'performance-center', 'module', (SELECT id FROM products WHERE slug = 'xrai-2'), 'Analytics and performance tracking', false, 1, '📈'),
  ('Action Hub', 'action-hub', 'module', (SELECT id FROM products WHERE slug = 'xrai-2'), 'Task management and automation', false, 2, '⚡'),
  ('Accountability Hub', 'accountability-hub', 'module', (SELECT id FROM products WHERE slug = 'xrai-2'), 'Team accountability and tracking', false, 3, '✅')
ON CONFLICT (slug) DO NOTHING;

-- AI AGENTS MODULES
INSERT INTO products (name, slug, product_type, parent_product_id, description, is_sellable, display_order, icon) VALUES
  ('Receptionist Agent', 'receptionist-agent', 'module', (SELECT id FROM products WHERE slug = 'ai-agents'), 'AI-powered phone reception', false, 1, '📱'),
  ('Integrated Scheduling', 'integrated-scheduling', 'module', (SELECT id FROM products WHERE slug = 'ai-agents'), 'Automated appointment scheduling', false, 2, '📅'),
  ('Sales Agent', 'sales-agent', 'module', (SELECT id FROM products WHERE slug = 'ai-agents'), 'AI sales assistance', false, 3, '💰'),
  ('Billing Agent', 'billing-agent', 'module', (SELECT id FROM products WHERE slug = 'ai-agents'), 'Automated billing inquiries', false, 4, '💳'),
  ('Outbound SMS', 'outbound-sms', 'module', (SELECT id FROM products WHERE slug = 'ai-agents'), 'Automated SMS campaigns', false, 5, '💬')
ON CONFLICT (slug) DO NOTHING;

-- X-RAI 1.0 TIERS
INSERT INTO product_tiers (product_id, name, slug, display_order, price_monthly) VALUES
  ((SELECT id FROM products WHERE slug = 'xrai-1'), 'Silver', 'silver', 1, 499),
  ((SELECT id FROM products WHERE slug = 'xrai-1'), 'Gold', 'gold', 2, 999),
  ((SELECT id FROM products WHERE slug = 'xrai-1'), 'Platinum', 'platinum', 3, 1999)
ON CONFLICT (product_id, slug) DO NOTHING;

-- ============================================
-- SEED: DEFAULT SALES STAGES (PROVEN PROCESS)
-- ============================================

-- X-RAI 2.0 STAGES
INSERT INTO product_sales_stages (product_id, name, slug, stage_order, goal, exit_criteria) VALUES
  ((SELECT id FROM products WHERE slug = 'xrai-2'), 'Actively Engaging', 'engaging', 1,
   'Get their attention and schedule a demo', 'Demo scheduled'),
  ((SELECT id FROM products WHERE slug = 'xrai-2'), 'Demo Scheduled', 'demo-scheduled', 2,
   'Show platform capabilities and get preview approval', 'Preview approved'),
  ((SELECT id FROM products WHERE slug = 'xrai-2'), 'Preview Approved', 'preview-approved', 3,
   'Get approval to run their data through X-RAI', 'Data loaded'),
  ((SELECT id FROM products WHERE slug = 'xrai-2'), 'Preview Ready', 'preview-ready', 4,
   'X-RAI populated with their data, ready to show', 'Follow-up scheduled'),
  ((SELECT id FROM products WHERE slug = 'xrai-2'), 'Follow-up Call', 'followup', 5,
   'Review their data together, demonstrate value', 'Trial started'),
  ((SELECT id FROM products WHERE slug = 'xrai-2'), 'Trial', 'trial', 6,
   '7 days hands-on access to explore the platform', 'Proposal requested or trial ended'),
  ((SELECT id FROM products WHERE slug = 'xrai-2'), 'Proposal', 'proposal', 7,
   'Negotiate terms and close the deal', 'Won or Declined')
ON CONFLICT (product_id, slug) DO NOTHING;

-- AI AGENTS STAGES
INSERT INTO product_sales_stages (product_id, name, slug, stage_order, goal, exit_criteria) VALUES
  ((SELECT id FROM products WHERE slug = 'ai-agents'), 'Actively Engaging', 'engaging', 1,
   'Identify pain points and schedule discovery call', 'Discovery scheduled'),
  ((SELECT id FROM products WHERE slug = 'ai-agents'), 'Discovery Call', 'discovery', 2,
   'Understand their call volume, pain points, current process', 'Demo scheduled'),
  ((SELECT id FROM products WHERE slug = 'ai-agents'), 'Demo Scheduled', 'demo-scheduled', 3,
   'Show AI agents in action with sample scenarios', 'Trial approved'),
  ((SELECT id FROM products WHERE slug = 'ai-agents'), 'Trial Setup', 'trial-setup', 4,
   'Configure agents for their specific use case', 'Agents live'),
  ((SELECT id FROM products WHERE slug = 'ai-agents'), 'Trial Active', 'trial-active', 5,
   '14 days of live agent operation', 'Trial review scheduled'),
  ((SELECT id FROM products WHERE slug = 'ai-agents'), 'Trial Review', 'trial-review', 6,
   'Review results, discuss ROI, handle objections', 'Proposal requested'),
  ((SELECT id FROM products WHERE slug = 'ai-agents'), 'Proposal', 'proposal', 7,
   'Negotiate and close', 'Won or Declined')
ON CONFLICT (product_id, slug) DO NOTHING;

-- SMART DATA PLUS STAGES (simpler process)
INSERT INTO product_sales_stages (product_id, name, slug, stage_order, goal, exit_criteria) VALUES
  ((SELECT id FROM products WHERE slug = 'smart-data-plus'), 'Actively Engaging', 'engaging', 1,
   'Explain data enhancement value', 'Demo scheduled'),
  ((SELECT id FROM products WHERE slug = 'smart-data-plus'), 'Demo', 'demo', 2,
   'Show sample enhanced data', 'Trial started'),
  ((SELECT id FROM products WHERE slug = 'smart-data-plus'), 'Trial', 'trial', 3,
   'Process sample of their data', 'Proposal requested'),
  ((SELECT id FROM products WHERE slug = 'smart-data-plus'), 'Proposal', 'proposal', 4,
   'Close the deal', 'Won or Declined')
ON CONFLICT (product_id, slug) DO NOTHING;

-- SUMMARY NOTE STAGES (simplest)
INSERT INTO product_sales_stages (product_id, name, slug, stage_order, goal, exit_criteria) VALUES
  ((SELECT id FROM products WHERE slug = 'summary-note'), 'Actively Engaging', 'engaging', 1,
   'Explain AI summary value', 'Demo scheduled'),
  ((SELECT id FROM products WHERE slug = 'summary-note'), 'Demo', 'demo', 2,
   'Show sample summaries', 'Ready to buy'),
  ((SELECT id FROM products WHERE slug = 'summary-note'), 'Closing', 'closing', 3,
   'Close the deal', 'Won or Declined')
ON CONFLICT (product_id, slug) DO NOTHING;
