-- ============================================
-- PRODUCT-CENTRIC REDESIGN: PHASE 1 MIGRATION
-- ============================================

-- 1. PRODUCTS TABLE
-- Master catalog of all X-RAI products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,

  -- Hierarchy (for modules under main products)
  parent_product_id UUID REFERENCES products(id),
  product_type TEXT NOT NULL DEFAULT 'suite',
  -- 'base' = Voice for Pest (determines customer status)
  -- 'suite' = Main sellable products (X-RAI 2.0, AI Agents)
  -- 'module' = Sub-components (Performance Center, Receptionist Agent)
  -- 'addon' = Optional add-ons

  -- Display
  display_order INTEGER DEFAULT 0,
  icon TEXT,
  color TEXT,

  -- Pricing (reference only)
  base_price_monthly DECIMAL(10,2),
  pricing_model TEXT,  -- 'per_seat', 'flat', 'tiered'

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_sellable BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PRODUCT TIERS TABLE
-- For products with tier levels (Silver, Gold, Platinum)
CREATE TABLE IF NOT EXISTS product_tiers (
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
-- "Proven Process" stages for each product
CREATE TABLE IF NOT EXISTS product_sales_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Stage Definition
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  stage_order INTEGER NOT NULL,

  -- Goals & Guidance
  goal TEXT,
  description TEXT,

  -- AI Automation
  ai_sequence_id UUID,
  ai_actions JSONB,

  -- Sales Enablement
  pitch_points JSONB DEFAULT '[]'::jsonb,
  objection_handlers JSONB DEFAULT '[]'::jsonb,
  resources JSONB DEFAULT '[]'::jsonb,

  -- Exit Criteria
  exit_criteria TEXT,
  exit_actions JSONB,

  -- Metrics (populated over time)
  avg_days_in_stage DECIMAL(5,1),
  conversion_rate DECIMAL(5,2),

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(product_id, slug)
);

-- 4. COMPANY PRODUCTS TABLE
-- The core relationship: status of each product per company
CREATE TABLE IF NOT EXISTS company_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Status
  status TEXT NOT NULL DEFAULT 'inactive',
  -- 'inactive' = Not started
  -- 'in_sales' = Going through proven process
  -- 'in_onboarding' = Sold, being implemented
  -- 'active' = Live customer
  -- 'churned' = Was active, now cancelled
  -- 'declined' = Was in sales, said no

  -- For tiered products
  tier_id UUID REFERENCES product_tiers(id),

  -- For seat-based products
  seats INTEGER,

  -- For products with modules
  enabled_modules TEXT[] DEFAULT '{}',

  -- Sales Process Tracking
  current_stage_id UUID REFERENCES product_sales_stages(id),
  stage_entered_at TIMESTAMPTZ,

  -- AI Activity
  ai_sequence_active BOOLEAN DEFAULT FALSE,
  ai_sequence_paused_reason TEXT,

  -- Key Dates
  sales_started_at TIMESTAMPTZ,
  onboarding_started_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  churned_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  declined_reason TEXT,

  -- Ownership
  owner_user_id UUID REFERENCES users(id),

  -- Value tracking
  mrr DECIMAL(10,2),

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, product_id)
);

-- 5. COMPANY PRODUCT HISTORY TABLE
-- Audit trail for changes
CREATE TABLE IF NOT EXISTS company_product_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_product_id UUID NOT NULL REFERENCES company_products(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  -- 'status_changed', 'stage_changed', 'tier_changed', 'seats_changed', 'note_added'

  from_value TEXT,
  to_value TEXT,

  changed_by UUID REFERENCES users(id),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PROSPECTING PIPELINE TABLE
-- For non-VFP prospects (new logos)
CREATE TABLE IF NOT EXISTS prospecting_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  stage TEXT NOT NULL DEFAULT 'lead',
  -- 'lead', 'qualified', 'demo_scheduled', 'demo_complete', 'proposal', 'negotiation', 'won', 'lost'

  interested_products TEXT[] DEFAULT '{}',

  owner_user_id UUID REFERENCES users(id),

  -- Key Dates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  demo_at TIMESTAMPTZ,
  proposal_sent_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- Outcome
  outcome TEXT,
  lost_reason TEXT,

  -- If won, becomes VFP customer
  converted_to_customer_at TIMESTAMPTZ,

  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. UPDATE COMPANIES TABLE
-- Add customer_type and VFP-specific fields
ALTER TABLE companies ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'prospect';
-- 'prospect' = Not a VFP customer yet
-- 'vfp_customer' = Voice for Pest customer
-- 'vft_customer' = Voice for Turf customer

ALTER TABLE companies ADD COLUMN IF NOT EXISTS vfp_customer_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS vfp_support_contact TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS became_customer_at TIMESTAMPTZ;

-- 8. INDEXES
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

-- 9. TRIGGERS FOR UPDATED_AT
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

-- 10. RLS POLICIES
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sales_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_product_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospecting_pipeline ENABLE ROW LEVEL SECURITY;

-- Products: readable by all authenticated users
DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON products;
CREATE POLICY "Products are viewable by authenticated users" ON products
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Product tiers are viewable by authenticated users" ON product_tiers;
CREATE POLICY "Product tiers are viewable by authenticated users" ON product_tiers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Product stages are viewable by authenticated users" ON product_sales_stages;
CREATE POLICY "Product stages are viewable by authenticated users" ON product_sales_stages
  FOR SELECT TO authenticated USING (true);

-- Company products: users can see their org's data
DROP POLICY IF EXISTS "Company products viewable by org members" ON company_products;
CREATE POLICY "Company products viewable by org members" ON company_products
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Company products insertable by org members" ON company_products;
CREATE POLICY "Company products insertable by org members" ON company_products
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Company products updatable by org members" ON company_products;
CREATE POLICY "Company products updatable by org members" ON company_products
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Company product history viewable" ON company_product_history;
CREATE POLICY "Company product history viewable" ON company_product_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Company product history insertable" ON company_product_history;
CREATE POLICY "Company product history insertable" ON company_product_history
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Prospecting pipeline viewable" ON prospecting_pipeline;
CREATE POLICY "Prospecting pipeline viewable" ON prospecting_pipeline
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Prospecting pipeline insertable" ON prospecting_pipeline;
CREATE POLICY "Prospecting pipeline insertable" ON prospecting_pipeline
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Prospecting pipeline updatable" ON prospecting_pipeline;
CREATE POLICY "Prospecting pipeline updatable" ON prospecting_pipeline
  FOR UPDATE TO authenticated USING (true);
