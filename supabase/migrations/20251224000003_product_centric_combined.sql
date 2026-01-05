-- ============================================
-- PRODUCT-CENTRIC REDESIGN: PHASE 1 - COMBINED
-- Run this single file in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 0: DROP EXISTING TABLES (if they exist)
-- ============================================
DROP TABLE IF EXISTS company_product_history CASCADE;
DROP TABLE IF EXISTS company_products CASCADE;
DROP TABLE IF EXISTS product_sales_stages CASCADE;
DROP TABLE IF EXISTS product_tiers CASCADE;
DROP TABLE IF EXISTS prospecting_pipeline CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- ============================================
-- PART 1: CREATE TABLES
-- ============================================

-- 1. PRODUCTS TABLE
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_product_id UUID REFERENCES products(id),
  product_type TEXT NOT NULL DEFAULT 'suite',
  display_order INTEGER DEFAULT 0,
  icon TEXT,
  color TEXT,
  base_price_monthly DECIMAL(10,2),
  pricing_model TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_sellable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PRODUCT TIERS TABLE
CREATE TABLE product_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  included_modules TEXT[],
  features JSONB,
  price_monthly DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, slug)
);

-- 3. PRODUCT SALES STAGES TABLE
CREATE TABLE product_sales_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  goal TEXT,
  description TEXT,
  ai_sequence_id UUID,
  ai_actions JSONB,
  pitch_points JSONB DEFAULT '[]'::jsonb,
  objection_handlers JSONB DEFAULT '[]'::jsonb,
  resources JSONB DEFAULT '[]'::jsonb,
  exit_criteria TEXT,
  exit_actions JSONB,
  avg_days_in_stage DECIMAL(5,1),
  conversion_rate DECIMAL(5,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, slug)
);

-- 4. COMPANY PRODUCTS TABLE
CREATE TABLE company_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'inactive',
  tier_id UUID REFERENCES product_tiers(id),
  seats INTEGER,
  enabled_modules TEXT[] DEFAULT '{}',
  current_stage_id UUID REFERENCES product_sales_stages(id),
  stage_entered_at TIMESTAMPTZ,
  ai_sequence_active BOOLEAN DEFAULT FALSE,
  ai_sequence_paused_reason TEXT,
  sales_started_at TIMESTAMPTZ,
  onboarding_started_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  churned_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  declined_reason TEXT,
  owner_user_id UUID REFERENCES users(id),
  mrr DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, product_id)
);

-- 5. COMPANY PRODUCT HISTORY TABLE
CREATE TABLE company_product_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_product_id UUID NOT NULL REFERENCES company_products(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  changed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PROSPECTING PIPELINE TABLE
CREATE TABLE prospecting_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'lead',
  interested_products TEXT[] DEFAULT '{}',
  owner_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  demo_at TIMESTAMPTZ,
  proposal_sent_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  outcome TEXT,
  lost_reason TEXT,
  converted_to_customer_at TIMESTAMPTZ,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. UPDATE COMPANIES TABLE
ALTER TABLE companies ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'prospect';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS vfp_customer_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS vfp_support_contact TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS became_customer_at TIMESTAMPTZ;

-- ============================================
-- PART 2: INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_product_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_product_sales_stages_product ON product_sales_stages(product_id);
CREATE INDEX IF NOT EXISTS idx_product_sales_stages_order ON product_sales_stages(product_id, stage_order);
CREATE INDEX IF NOT EXISTS idx_company_products_company ON company_products(company_id);
CREATE INDEX IF NOT EXISTS idx_company_products_product ON company_products(product_id);
CREATE INDEX IF NOT EXISTS idx_company_products_status ON company_products(status);
CREATE INDEX IF NOT EXISTS idx_company_products_stage ON company_products(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_company_products_owner ON company_products(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_company_product_history_cp ON company_product_history(company_product_id);
CREATE INDEX IF NOT EXISTS idx_prospecting_pipeline_stage ON prospecting_pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_prospecting_pipeline_owner ON prospecting_pipeline(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_companies_customer_type ON companies(customer_type);

-- ============================================
-- PART 3: TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS product_sales_stages_updated_at ON product_sales_stages;
CREATE TRIGGER product_sales_stages_updated_at BEFORE UPDATE ON product_sales_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS company_products_updated_at ON company_products;
CREATE TRIGGER company_products_updated_at BEFORE UPDATE ON company_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS prospecting_pipeline_updated_at ON prospecting_pipeline;
CREATE TRIGGER prospecting_pipeline_updated_at BEFORE UPDATE ON prospecting_pipeline
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 4: RLS POLICIES
-- ============================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sales_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_product_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_pipeline ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON products;
DROP POLICY IF EXISTS "Product tiers are viewable by authenticated users" ON product_tiers;
DROP POLICY IF EXISTS "Product stages are viewable by authenticated users" ON product_sales_stages;
DROP POLICY IF EXISTS "Company products viewable by org members" ON company_products;
DROP POLICY IF EXISTS "Company products insertable by org members" ON company_products;
DROP POLICY IF EXISTS "Company products updatable by org members" ON company_products;
DROP POLICY IF EXISTS "Company product history viewable" ON company_product_history;
DROP POLICY IF EXISTS "Company product history insertable" ON company_product_history;
DROP POLICY IF EXISTS "Prospecting pipeline viewable" ON prospecting_pipeline;
DROP POLICY IF EXISTS "Prospecting pipeline insertable" ON prospecting_pipeline;
DROP POLICY IF EXISTS "Prospecting pipeline updatable" ON prospecting_pipeline;

CREATE POLICY "Products are viewable by authenticated users" ON products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Product tiers are viewable by authenticated users" ON product_tiers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Product stages are viewable by authenticated users" ON product_sales_stages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Company products viewable by org members" ON company_products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Company products insertable by org members" ON company_products
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Company products updatable by org members" ON company_products
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Company product history viewable" ON company_product_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Company product history insertable" ON company_product_history
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Prospecting pipeline viewable" ON prospecting_pipeline
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Prospecting pipeline insertable" ON prospecting_pipeline
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Prospecting pipeline updatable" ON prospecting_pipeline
  FOR UPDATE TO authenticated USING (true);

-- ============================================
-- PART 5: SEED PRODUCTS
-- ============================================

-- BASE PRODUCTS
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
-- PART 6: SEED SALES STAGES (PROVEN PROCESS)
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

-- SMART DATA PLUS STAGES
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

-- SUMMARY NOTE STAGES
INSERT INTO product_sales_stages (product_id, name, slug, stage_order, goal, exit_criteria) VALUES
  ((SELECT id FROM products WHERE slug = 'summary-note'), 'Actively Engaging', 'engaging', 1,
   'Explain AI summary value', 'Demo scheduled'),
  ((SELECT id FROM products WHERE slug = 'summary-note'), 'Demo', 'demo', 2,
   'Show sample summaries', 'Ready to buy'),
  ((SELECT id FROM products WHERE slug = 'summary-note'), 'Closing', 'closing', 3,
   'Close the deal', 'Won or Declined')
ON CONFLICT (product_id, slug) DO NOTHING;

-- ============================================
-- DONE!
-- ============================================
-- Verify with:
-- SELECT name, slug, product_type FROM products ORDER BY display_order;
-- SELECT p.name, s.name, s.stage_order FROM product_sales_stages s JOIN products p ON s.product_id = p.id ORDER BY p.name, s.stage_order;
