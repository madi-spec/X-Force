-- X-FORCE Sales Platform - Schema Refactoring
-- Migration: 00008_schema_refactor
--
-- Major changes:
-- 1. Rename organizations -> companies
-- 2. Add product catalog (product_categories, products)
-- 3. Add company product tracking (company_products, company_product_history)
-- 4. Enhance deals for multiple per company, add deal_type, team, collaborators
-- 5. Add company_watchers for cross-team coordination
-- 6. Add company_signals for AI-detected opportunities
-- 7. Add external_ids to companies
-- 8. Add visible_to_teams to activities

-- ============================================
-- NEW ENUM TYPES
-- ============================================

-- Company status (expanded from organization_type)
CREATE TYPE company_status AS ENUM ('cold_lead', 'prospect', 'customer', 'churned');

-- Deal type
CREATE TYPE deal_type AS ENUM ('new_business', 'upsell', 'cross_sell', 'expansion', 'renewal');

-- Sales team (more granular than team)
CREATE TYPE sales_team AS ENUM ('voice_outside', 'voice_inside', 'xrai');

-- Product category owner
CREATE TYPE product_owner AS ENUM ('voice', 'xrai');

-- Product event types for history tracking
CREATE TYPE product_event_type AS ENUM ('pitched', 'declined', 'purchased', 'churned', 'upgraded', 'downgraded');

-- Company product status
CREATE TYPE company_product_status AS ENUM ('active', 'churned', 'paused');

-- Deal collaborator role
CREATE TYPE collaborator_role AS ENUM ('owner', 'collaborator', 'informed');

-- Signal types for AI-detected opportunities
CREATE TYPE signal_type AS ENUM (
  'voicemail_spike',
  'queue_time_increase',
  'engagement_drop',
  'did_request',
  'expansion_indicator',
  'churn_risk',
  'upsell_opportunity'
);

-- Signal status
CREATE TYPE signal_status AS ENUM ('new', 'acted_on', 'dismissed');

-- ============================================
-- RENAME organizations TO companies
-- ============================================

-- First, drop dependent views if any exist
-- (none in current schema)

-- Rename the table
ALTER TABLE organizations RENAME TO companies;

-- Rename the type column and migrate to new enum
ALTER TABLE companies ADD COLUMN status company_status;

-- Migrate existing data
UPDATE companies SET status = 'cold_lead' WHERE type::text = 'prospect';
UPDATE companies SET status = 'customer' WHERE type::text = 'customer';
UPDATE companies SET status = 'churned' WHERE type::text = 'churned';
-- Default any NULLs to cold_lead
UPDATE companies SET status = 'cold_lead' WHERE status IS NULL;

-- Make status NOT NULL and drop old type column
ALTER TABLE companies ALTER COLUMN status SET NOT NULL;
ALTER TABLE companies DROP COLUMN type;

-- Add external_ids JSONB column
ALTER TABLE companies ADD COLUMN external_ids JSONB DEFAULT '{}';

-- Rename foreign key columns in dependent tables
ALTER TABLE contacts RENAME COLUMN organization_id TO company_id;
ALTER TABLE deals RENAME COLUMN organization_id TO company_id;
ALTER TABLE activities RENAME COLUMN organization_id TO company_id;
ALTER TABLE tasks RENAME COLUMN organization_id TO company_id;

-- Update foreign key constraints (need to drop and recreate)
ALTER TABLE contacts DROP CONSTRAINT contacts_organization_id_fkey;
ALTER TABLE contacts ADD CONSTRAINT contacts_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE deals DROP CONSTRAINT deals_organization_id_fkey;
ALTER TABLE deals ADD CONSTRAINT deals_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE activities DROP CONSTRAINT activities_organization_id_fkey;
ALTER TABLE activities ADD CONSTRAINT activities_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_organization_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- Rename indexes
ALTER INDEX IF EXISTS idx_contacts_organization RENAME TO idx_contacts_company;
ALTER INDEX IF EXISTS idx_deals_organization RENAME TO idx_deals_company;
ALTER INDEX IF EXISTS idx_activities_organization RENAME TO idx_activities_company;

-- Update trigger
DROP TRIGGER IF EXISTS organizations_updated_at ON companies;
CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- PRODUCT CATALOG TABLES
-- ============================================

-- Product Categories
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- 'voice_phone_system', 'voice_addons', etc.
  display_name TEXT NOT NULL,
  owner product_owner NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE, -- 'basic_phone', 'zema_contact_center', etc.
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  typical_mrr_low NUMERIC(10, 2),
  typical_mrr_high NUMERIC(10, 2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);

-- ============================================
-- COMPANY PRODUCT TRACKING
-- ============================================

-- What products a company currently has
CREATE TABLE company_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status company_product_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  churn_reason TEXT,
  mrr NUMERIC(10, 2),
  configuration_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, product_id)
);

CREATE INDEX idx_company_products_company ON company_products(company_id);
CREATE INDEX idx_company_products_product ON company_products(product_id);
CREATE INDEX idx_company_products_status ON company_products(status);

-- Trigger to update updated_at
CREATE TRIGGER company_products_updated_at
  BEFORE UPDATE ON company_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Product history (every pitch, every outcome)
CREATE TABLE company_product_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  event_type product_event_type NOT NULL,
  event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  decline_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_company_product_history_company ON company_product_history(company_id);
CREATE INDEX idx_company_product_history_product ON company_product_history(product_id);
CREATE INDEX idx_company_product_history_event_date ON company_product_history(event_date);
CREATE INDEX idx_company_product_history_deal ON company_product_history(deal_id);

-- ============================================
-- DEALS TABLE ENHANCEMENTS
-- ============================================

-- Add new columns to deals
ALTER TABLE deals ADD COLUMN deal_type deal_type NOT NULL DEFAULT 'new_business';
ALTER TABLE deals ADD COLUMN sales_team sales_team;
ALTER TABLE deals ADD COLUMN primary_product_category_id UUID REFERENCES product_categories(id);
ALTER TABLE deals ADD COLUMN quoted_products JSONB DEFAULT '[]'; -- array of product IDs

-- Create index for new columns
CREATE INDEX idx_deals_deal_type ON deals(deal_type);
CREATE INDEX idx_deals_sales_team ON deals(sales_team);
CREATE INDEX idx_deals_primary_category ON deals(primary_product_category_id);

-- ============================================
-- DEAL COLLABORATORS
-- ============================================

CREATE TABLE deal_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role collaborator_role NOT NULL DEFAULT 'collaborator',
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES users(id),
  UNIQUE(deal_id, user_id)
);

CREATE INDEX idx_deal_collaborators_deal ON deal_collaborators(deal_id);
CREATE INDEX idx_deal_collaborators_user ON deal_collaborators(user_id);

-- ============================================
-- COMPANY WATCHERS
-- ============================================

CREATE TABLE company_watchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT, -- "Voice account manager", "X-RAI active deal", etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

CREATE INDEX idx_company_watchers_company ON company_watchers(company_id);
CREATE INDEX idx_company_watchers_user ON company_watchers(user_id);

-- ============================================
-- COMPANY SIGNALS (AI-DETECTED OPPORTUNITIES)
-- ============================================

CREATE TABLE company_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  signal_type signal_type NOT NULL,
  signal_data JSONB NOT NULL DEFAULT '{}', -- the actual metrics
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recommended_action TEXT,
  recommended_product_id UUID REFERENCES products(id),
  status signal_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES users(id),
  acted_on_at TIMESTAMPTZ,
  acted_on_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_company_signals_company ON company_signals(company_id);
CREATE INDEX idx_company_signals_type ON company_signals(signal_type);
CREATE INDEX idx_company_signals_status ON company_signals(status);
CREATE INDEX idx_company_signals_detected_at ON company_signals(detected_at);

-- ============================================
-- ACTIVITIES ENHANCEMENTS
-- ============================================

-- Add visible_to_teams column (array of team names)
ALTER TABLE activities ADD COLUMN visible_to_teams TEXT[] DEFAULT ARRAY['voice', 'xrai'];

CREATE INDEX idx_activities_visible_to_teams ON activities USING GIN(visible_to_teams);

-- ============================================
-- SEED DATA: Product Catalog
-- ============================================

-- Product Categories
INSERT INTO product_categories (name, display_name, owner, sort_order) VALUES
  ('voice_phone_system', 'Voice Phone System', 'voice', 1),
  ('voice_addons', 'Voice Add-ons', 'voice', 2),
  ('xrai_platform', 'X-RAI Platform', 'xrai', 3),
  ('xrai_ai_agents', 'AI Agents', 'xrai', 4);

-- Voice Phone System Products
INSERT INTO products (category_id, name, display_name, description, typical_mrr_low, typical_mrr_high, sort_order)
SELECT
  pc.id,
  p.name,
  p.display_name,
  p.description,
  p.mrr_low,
  p.mrr_high,
  p.sort_order
FROM product_categories pc
CROSS JOIN (VALUES
  ('basic_phone', 'Basic Phone System', 'Standard VoIP phone system with call routing and voicemail', 500, 2000, 1),
  ('zema_contact_center', 'Contact Center (Zema)', 'Full contact center solution with queues, reporting, and omnichannel', 2000, 10000, 2)
) AS p(name, display_name, description, mrr_low, mrr_high, sort_order)
WHERE pc.name = 'voice_phone_system';

-- Voice Add-ons Products
INSERT INTO products (category_id, name, display_name, description, typical_mrr_low, typical_mrr_high, sort_order)
SELECT
  pc.id,
  p.name,
  p.display_name,
  p.description,
  p.mrr_low,
  p.mrr_high,
  p.sort_order
FROM product_categories pc
CROSS JOIN (VALUES
  ('texting', 'Texting', 'SMS/MMS messaging for customer communication', 100, 500, 1),
  ('technician_cell_phones', 'Technician Cell Phones', 'Mobile devices and service for field technicians', 200, 1000, 2),
  ('did_numbers', 'DID Numbers', 'Additional direct inward dial phone numbers', 50, 300, 3),
  ('noise_canceling', 'Noise Canceling', 'AI-powered background noise reduction', 100, 400, 4),
  ('ai_summary_notes', 'AI Summary Notes', 'Automatic call summarization and note generation', 150, 600, 5),
  ('smart_data', 'Smart Data', 'Advanced call analytics and reporting', 200, 800, 6),
  ('pricing_integration', 'Pricing Integration', 'Integration with pricing/quoting systems', 100, 500, 7)
) AS p(name, display_name, description, mrr_low, mrr_high, sort_order)
WHERE pc.name = 'voice_addons';

-- X-RAI Platform Products
INSERT INTO products (category_id, name, display_name, description, typical_mrr_low, typical_mrr_high, sort_order)
SELECT
  pc.id,
  p.name,
  p.display_name,
  p.description,
  p.mrr_low,
  p.mrr_high,
  p.sort_order
FROM product_categories pc
CROSS JOIN (VALUES
  ('performance_center', 'Performance Center', 'Real-time performance dashboards and KPI tracking', 500, 2000, 1),
  ('action_hub', 'Action Hub', 'Task management and workflow automation', 400, 1500, 2),
  ('accountability_hub', 'Accountability Hub', 'Team accountability and goal tracking', 400, 1500, 3),
  ('strategy_hub', 'Strategy Hub', 'Strategic planning and forecasting tools', 500, 2000, 4)
) AS p(name, display_name, description, mrr_low, mrr_high, sort_order)
WHERE pc.name = 'xrai_platform';

-- X-RAI AI Agents Products
INSERT INTO products (category_id, name, display_name, description, typical_mrr_low, typical_mrr_high, sort_order)
SELECT
  pc.id,
  p.name,
  p.display_name,
  p.description,
  p.mrr_low,
  p.mrr_high,
  p.sort_order
FROM product_categories pc
CROSS JOIN (VALUES
  ('basic_routing_agent', 'Basic Routing Agent', 'AI agent for intelligent call routing', 300, 1000, 1),
  ('dispatch_agent', 'Dispatch Agent', 'AI agent for scheduling and dispatch optimization', 500, 2000, 2),
  ('receptionist_agent', 'Receptionist Agent', 'AI-powered virtual receptionist', 400, 1500, 3),
  ('outbound_sales_agent', 'Outbound Sales Agent', 'AI agent for outbound calling campaigns', 600, 2500, 4),
  ('billing_agent', 'Billing Agent', 'AI agent for payment collection and billing inquiries', 400, 1500, 5)
) AS p(name, display_name, description, mrr_low, mrr_high, sort_order)
WHERE pc.name = 'xrai_ai_agents';

-- ============================================
-- UPDATE RLS POLICIES
-- ============================================

-- Drop old policies that reference organizations
DROP POLICY IF EXISTS organizations_select ON companies;
DROP POLICY IF EXISTS organizations_all ON companies;

-- Create new policies for companies
CREATE POLICY companies_select ON companies
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY companies_insert ON companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY companies_update ON companies
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY companies_delete ON companies
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Policies for new tables
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_categories_select ON product_categories
  FOR SELECT USING (true); -- Reference data, viewable by all

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_select ON products
  FOR SELECT USING (true); -- Reference data, viewable by all

ALTER TABLE company_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_products_select ON company_products
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY company_products_insert ON company_products
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY company_products_update ON company_products
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY company_products_delete ON company_products
  FOR DELETE USING (auth.uid() IS NOT NULL);

ALTER TABLE company_product_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_product_history_select ON company_product_history
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY company_product_history_insert ON company_product_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE deal_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_collaborators_select ON deal_collaborators
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY deal_collaborators_insert ON deal_collaborators
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY deal_collaborators_update ON deal_collaborators
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY deal_collaborators_delete ON deal_collaborators
  FOR DELETE USING (auth.uid() IS NOT NULL);

ALTER TABLE company_watchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_watchers_select ON company_watchers
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY company_watchers_insert ON company_watchers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY company_watchers_delete ON company_watchers
  FOR DELETE USING (auth.uid() IS NOT NULL);

ALTER TABLE company_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_signals_select ON company_signals
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY company_signals_insert ON company_signals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY company_signals_update ON company_signals
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================
-- HELPER FUNCTION: Update company status based on products
-- ============================================

CREATE OR REPLACE FUNCTION update_company_status_from_products()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if company has any active products
  IF EXISTS (
    SELECT 1 FROM company_products
    WHERE company_id = COALESCE(NEW.company_id, OLD.company_id)
    AND status = 'active'
  ) THEN
    UPDATE companies SET status = 'customer'
    WHERE id = COALESCE(NEW.company_id, OLD.company_id)
    AND status != 'customer';
  ELSE
    -- Check if they ever had products (churned) vs never (prospect/cold_lead)
    IF EXISTS (
      SELECT 1 FROM company_products
      WHERE company_id = COALESCE(NEW.company_id, OLD.company_id)
    ) THEN
      UPDATE companies SET status = 'churned'
      WHERE id = COALESCE(NEW.company_id, OLD.company_id)
      AND status = 'customer';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_products_status_change
  AFTER INSERT OR UPDATE OR DELETE ON company_products
  FOR EACH ROW EXECUTE FUNCTION update_company_status_from_products();

-- ============================================
-- HELPER FUNCTION: Auto-add deal owner as watcher
-- ============================================

CREATE OR REPLACE FUNCTION auto_add_deal_owner_as_watcher()
RETURNS TRIGGER AS $$
BEGIN
  -- Add deal owner as company watcher if not already watching
  INSERT INTO company_watchers (company_id, user_id, reason)
  VALUES (NEW.company_id, NEW.owner_id, 'Active deal owner')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deals_auto_watch
  AFTER INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION auto_add_deal_owner_as_watcher();

-- ============================================
-- VIEW: Company Summary with Product Counts
-- ============================================

CREATE OR REPLACE VIEW company_summary AS
SELECT
  c.id,
  c.name,
  c.status,
  c.segment,
  c.industry,
  c.agent_count,
  c.crm_platform,
  c.voice_customer,
  c.created_at,
  COALESCE(
    (SELECT SUM(cp.mrr) FROM company_products cp WHERE cp.company_id = c.id AND cp.status = 'active'),
    0
  ) as total_mrr,
  (SELECT COUNT(*) FROM company_products cp WHERE cp.company_id = c.id AND cp.status = 'active') as active_product_count,
  (SELECT COUNT(*) FROM deals d WHERE d.company_id = c.id AND d.stage NOT IN ('closed_won', 'closed_lost')) as open_deal_count,
  (SELECT COUNT(*) FROM company_signals cs WHERE cs.company_id = c.id AND cs.status = 'new') as new_signal_count
FROM companies c;
