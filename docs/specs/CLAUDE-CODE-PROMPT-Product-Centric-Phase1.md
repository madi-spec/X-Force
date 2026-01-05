# Product-Centric Redesign: Phase 1 - Foundation

## Context

Read these spec documents first:
- `/docs/specs/X-FORCE-CRM-Project-State.md` - Current state
- `/docs/specs/X-FORCE-Product-Centric-Redesign-Spec.md` - Full redesign spec

**The Goal:** Transform X-FORCE from a deal-centric CRM to a product adoption platform where each company has a status for each product.

---

## Phase 1 Deliverables

1. ✅ Database tables created
2. ✅ Products seeded (X-RAI product catalog)
3. ✅ Default sales stages seeded per product
4. ✅ Companies table updated with customer_type
5. ✅ Basic Products page UI
6. ✅ TypeScript types

---

## Task 1: Create Database Migration

Create the migration SQL. Run this in Supabase Dashboard → SQL Editor:

```sql
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
CREATE POLICY "Products are viewable by authenticated users" ON products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Product tiers are viewable by authenticated users" ON product_tiers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Product stages are viewable by authenticated users" ON product_sales_stages
  FOR SELECT TO authenticated USING (true);

-- Company products: users can see their org's data
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
```

---

## Task 2: Seed Products Data

Run this after the migration:

```sql
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
```

---

## Task 3: Seed Default Sales Stages (Proven Process)

```sql
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
```

---

## Task 4: Create TypeScript Types

Create `src/types/products.ts`:

```typescript
// Product Types for Product-Centric CRM

export type ProductType = 'base' | 'suite' | 'module' | 'addon';

export type ProductStatus = 
  | 'inactive'      // Not started
  | 'in_sales'      // Going through proven process
  | 'in_onboarding' // Sold, being implemented
  | 'active'        // Live customer
  | 'churned'       // Was active, now cancelled
  | 'declined';     // Was in sales, said no

export type CustomerType = 'prospect' | 'vfp_customer' | 'vft_customer';

export type ProspectingStage = 
  | 'lead'
  | 'qualified'
  | 'demo_scheduled'
  | 'demo_complete'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_product_id: string | null;
  product_type: ProductType;
  display_order: number;
  icon: string | null;
  color: string | null;
  base_price_monthly: number | null;
  pricing_model: 'per_seat' | 'flat' | 'tiered' | null;
  is_active: boolean;
  is_sellable: boolean;
  created_at: string;
  updated_at: string;
  
  // Joined data
  parent_product?: Product;
  modules?: Product[];
  tiers?: ProductTier[];
  stages?: ProductSalesStage[];
}

export interface ProductTier {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  display_order: number;
  included_modules: string[] | null;
  features: Record<string, any> | null;
  price_monthly: number | null;
  created_at: string;
}

export interface ProductSalesStage {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  stage_order: number;
  goal: string | null;
  description: string | null;
  ai_sequence_id: string | null;
  ai_actions: Record<string, any> | null;
  pitch_points: PitchPoint[];
  objection_handlers: ObjectionHandler[];
  resources: Resource[];
  exit_criteria: string | null;
  exit_actions: Record<string, any> | null;
  avg_days_in_stage: number | null;
  conversion_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PitchPoint {
  id: string;
  text: string;
  source?: 'manual' | 'ai_suggested';
  effectiveness_score?: number;
}

export interface ObjectionHandler {
  id: string;
  objection: string;
  response: string;
  source?: 'manual' | 'ai_suggested';
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'document' | 'video' | 'link';
}

export interface CompanyProduct {
  id: string;
  company_id: string;
  product_id: string;
  status: ProductStatus;
  tier_id: string | null;
  seats: number | null;
  enabled_modules: string[];
  current_stage_id: string | null;
  stage_entered_at: string | null;
  ai_sequence_active: boolean;
  ai_sequence_paused_reason: string | null;
  sales_started_at: string | null;
  onboarding_started_at: string | null;
  activated_at: string | null;
  churned_at: string | null;
  declined_at: string | null;
  declined_reason: string | null;
  owner_user_id: string | null;
  mrr: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined data
  product?: Product;
  tier?: ProductTier;
  current_stage?: ProductSalesStage;
  company?: {
    id: string;
    name: string;
  };
  owner?: {
    id: string;
    name: string;
  };
}

export interface CompanyProductHistory {
  id: string;
  company_product_id: string;
  event_type: 'status_changed' | 'stage_changed' | 'tier_changed' | 'seats_changed' | 'note_added';
  from_value: string | null;
  to_value: string | null;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProspectingPipelineEntry {
  id: string;
  company_id: string;
  stage: ProspectingStage;
  interested_products: string[];
  owner_user_id: string | null;
  created_at: string;
  qualified_at: string | null;
  demo_at: string | null;
  proposal_sent_at: string | null;
  closed_at: string | null;
  outcome: 'won' | 'lost' | null;
  lost_reason: string | null;
  converted_to_customer_at: string | null;
  notes: string | null;
  updated_at: string;
  
  // Joined data
  company?: {
    id: string;
    name: string;
  };
  owner?: {
    id: string;
    name: string;
  };
}

// API Response Types
export interface ProductWithStats extends Product {
  stats: {
    active_count: number;
    in_sales_count: number;
    in_onboarding_count: number;
    inactive_count: number;
    declined_count: number;
    churned_count: number;
    total_mrr: number;
  };
  pipeline_by_stage: {
    stage_id: string;
    stage_name: string;
    count: number;
  }[];
}
```

---

## Task 5: Create Products API

Create `src/app/api/products/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const includeModules = searchParams.get('include_modules') === 'true';
  const includeStats = searchParams.get('include_stats') === 'true';
  const sellableOnly = searchParams.get('sellable_only') === 'true';
  
  // Get main products (not modules)
  let query = supabase
    .from('products')
    .select(`
      *,
      tiers:product_tiers(*),
      stages:product_sales_stages(*)
    `)
    .is('parent_product_id', null)
    .eq('is_active', true)
    .order('display_order');
  
  if (sellableOnly) {
    query = query.eq('is_sellable', true);
  }
  
  const { data: products, error } = await query;
  
  if (error) {
    console.error('[Products API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  // Get modules if requested
  if (includeModules) {
    const { data: modules } = await supabase
      .from('products')
      .select('*')
      .eq('product_type', 'module')
      .eq('is_active', true)
      .order('display_order');
    
    // Attach modules to parent products
    for (const product of products || []) {
      product.modules = (modules || []).filter(m => m.parent_product_id === product.id);
    }
  }
  
  // Get stats if requested
  if (includeStats) {
    for (const product of products || []) {
      const { data: stats } = await supabase
        .from('company_products')
        .select('status, mrr')
        .eq('product_id', product.id);
      
      const statusCounts = {
        active_count: 0,
        in_sales_count: 0,
        in_onboarding_count: 0,
        inactive_count: 0,
        declined_count: 0,
        churned_count: 0,
        total_mrr: 0,
      };
      
      for (const cp of stats || []) {
        if (cp.status === 'active') statusCounts.active_count++;
        else if (cp.status === 'in_sales') statusCounts.in_sales_count++;
        else if (cp.status === 'in_onboarding') statusCounts.in_onboarding_count++;
        else if (cp.status === 'inactive') statusCounts.inactive_count++;
        else if (cp.status === 'declined') statusCounts.declined_count++;
        else if (cp.status === 'churned') statusCounts.churned_count++;
        
        if (cp.mrr && cp.status === 'active') {
          statusCounts.total_mrr += parseFloat(cp.mrr);
        }
      }
      
      product.stats = statusCounts;
      
      // Pipeline by stage
      if (product.stages) {
        const { data: pipelineStats } = await supabase
          .from('company_products')
          .select('current_stage_id')
          .eq('product_id', product.id)
          .eq('status', 'in_sales');
        
        product.pipeline_by_stage = product.stages
          .sort((a: any, b: any) => a.stage_order - b.stage_order)
          .map((stage: any) => ({
            stage_id: stage.id,
            stage_name: stage.name,
            count: (pipelineStats || []).filter(ps => ps.current_stage_id === stage.id).length,
          }));
      }
    }
  }
  
  return NextResponse.json({ products });
}
```

---

## Task 6: Create Product Detail API

Create `src/app/api/products/[slug]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const supabase = await createClient();
  const { slug } = params;
  
  // Get product with all related data
  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      tiers:product_tiers(*),
      stages:product_sales_stages(*),
      modules:products!parent_product_id(*)
    `)
    .eq('slug', slug)
    .single();
  
  if (error || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  
  // Sort stages by order
  if (product.stages) {
    product.stages.sort((a: any, b: any) => a.stage_order - b.stage_order);
  }
  
  // Get pipeline (companies in sales for this product)
  const { data: pipeline } = await supabase
    .from('company_products')
    .select(`
      *,
      company:companies(id, name, domain),
      current_stage:product_sales_stages(id, name, slug, stage_order),
      owner:users(id, name)
    `)
    .eq('product_id', product.id)
    .eq('status', 'in_sales')
    .order('stage_entered_at', { ascending: true });
  
  // Get active customers
  const { data: activeCustomers } = await supabase
    .from('company_products')
    .select(`
      *,
      company:companies(id, name),
      tier:product_tiers(id, name)
    `)
    .eq('product_id', product.id)
    .eq('status', 'active')
    .order('activated_at', { ascending: false })
    .limit(10);
  
  // Get stats
  const { data: allCompanyProducts } = await supabase
    .from('company_products')
    .select('status, mrr')
    .eq('product_id', product.id);
  
  const stats = {
    active: 0,
    in_sales: 0,
    in_onboarding: 0,
    declined: 0,
    churned: 0,
    total_mrr: 0,
  };
  
  for (const cp of allCompanyProducts || []) {
    if (cp.status === 'active') {
      stats.active++;
      if (cp.mrr) stats.total_mrr += parseFloat(cp.mrr);
    }
    else if (cp.status === 'in_sales') stats.in_sales++;
    else if (cp.status === 'in_onboarding') stats.in_onboarding++;
    else if (cp.status === 'declined') stats.declined++;
    else if (cp.status === 'churned') stats.churned++;
  }
  
  return NextResponse.json({
    product,
    pipeline,
    activeCustomers,
    stats,
  });
}
```

---

## Task 7: Create Products Page

Create `src/app/(dashboard)/products/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/products/ProductCard';
import { Package } from 'lucide-react';

export default async function ProductsPage() {
  const supabase = await createClient();
  
  // Get products with stats
  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      stages:product_sales_stages(id, name, stage_order)
    `)
    .is('parent_product_id', null)
    .eq('is_active', true)
    .eq('is_sellable', true)
    .order('display_order');
  
  // Get stats for each product
  const productsWithStats = await Promise.all(
    (products || []).map(async (product) => {
      const { data: companyProducts } = await supabase
        .from('company_products')
        .select('status, mrr, current_stage_id')
        .eq('product_id', product.id);
      
      const stats = {
        active: 0,
        in_sales: 0,
        in_onboarding: 0,
        inactive: 0,
        total_mrr: 0,
      };
      
      const pipelineByStage: Record<string, number> = {};
      
      for (const cp of companyProducts || []) {
        if (cp.status === 'active') {
          stats.active++;
          if (cp.mrr) stats.total_mrr += parseFloat(cp.mrr);
        }
        else if (cp.status === 'in_sales') {
          stats.in_sales++;
          if (cp.current_stage_id) {
            pipelineByStage[cp.current_stage_id] = (pipelineByStage[cp.current_stage_id] || 0) + 1;
          }
        }
        else if (cp.status === 'in_onboarding') stats.in_onboarding++;
      }
      
      // Get inactive count (VFP customers without this product)
      const { count: vfpCount } = await supabase
        .from('companies')
        .select('id', { count: 'exact' })
        .eq('customer_type', 'vfp_customer');
      
      stats.inactive = (vfpCount || 0) - stats.active - stats.in_sales - stats.in_onboarding;
      
      return {
        ...product,
        stats,
        pipelineByStage,
      };
    })
  );
  
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500">Manage your product catalog and sales pipelines</p>
        </div>
      </div>
      
      {/* Products Grid */}
      <div className="space-y-6">
        {productsWithStats.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No products found</p>
          </div>
        ) : (
          productsWithStats.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        )}
      </div>
    </div>
  );
}
```

---

## Task 8: Create ProductCard Component

Create `src/components/products/ProductCard.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { 
  TrendingUp, 
  Users, 
  DollarSign,
  ChevronRight,
  Settings
} from 'lucide-react';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    stages: { id: string; name: string; stage_order: number }[];
    stats: {
      active: number;
      in_sales: number;
      in_onboarding: number;
      inactive: number;
      total_mrr: number;
    };
    pipelineByStage: Record<string, number>;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const sortedStages = [...(product.stages || [])].sort((a, b) => a.stage_order - b.stage_order);
  
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: `${product.color}20`, color: product.color }}
            >
              {product.icon || '📦'}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
              {product.description && (
                <p className="text-sm text-gray-500">{product.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link
              href={`/products/${product.slug}/process`}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Proven Process
            </Link>
            <Link
              href={`/products/${product.slug}`}
              className="px-3 py-1.5 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-1"
              style={{ backgroundColor: product.color || '#3B82F6' }}
            >
              View Pipeline
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
      
      {/* Stats Row */}
      <div className="p-4 border-b bg-gray-50">
        <div className="grid grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{product.stats.active}</div>
            <div className="text-xs text-gray-500">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{product.stats.in_sales}</div>
            <div className="text-xs text-gray-500">In Sales</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{product.stats.in_onboarding}</div>
            <div className="text-xs text-gray-500">Onboarding</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-400">{product.stats.inactive}</div>
            <div className="text-xs text-gray-500">Inactive</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ${product.stats.total_mrr.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">MRR</div>
          </div>
        </div>
      </div>
      
      {/* Pipeline Mini-View */}
      {sortedStages.length > 0 && product.stats.in_sales > 0 && (
        <div className="p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-3">Sales Pipeline</div>
          <div className="flex items-center gap-2">
            {sortedStages.map((stage, index) => {
              const count = product.pipelineByStage[stage.id] || 0;
              return (
                <div key={stage.id} className="flex items-center">
                  <div className="text-center">
                    <div 
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        count > 0 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {stage.name} ({count})
                    </div>
                  </div>
                  {index < sortedStages.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Task 9: Create Component Index

Create `src/components/products/index.ts`:

```typescript
export { ProductCard } from './ProductCard';
```

---

## Task 10: Add Navigation Link

Find your sidebar/navigation component and add Products link:

```tsx
// Add to navigation items
{
  name: 'Products',
  href: '/products',
  icon: Package, // from lucide-react
}
```

Place it prominently - this is now a core page.

---

## Verification

After completing all tasks:

1. **Check tables exist:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('products', 'product_tiers', 'product_sales_stages', 'company_products', 'prospecting_pipeline');
```

2. **Check products seeded:**
```sql
SELECT name, slug, product_type FROM products ORDER BY display_order;
```

3. **Check stages seeded:**
```sql
SELECT p.name as product, s.name as stage, s.stage_order 
FROM product_sales_stages s 
JOIN products p ON s.product_id = p.id 
ORDER BY p.name, s.stage_order;
```

4. **Check companies table updated:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'companies' 
AND column_name IN ('customer_type', 'vfp_customer_id', 'vfp_support_contact');
```

5. **Visit /products page** - Should show product cards with stats

6. **TypeScript compiles clean:** `npx tsc --noEmit`

---

## Success Criteria

- [ ] 6 database tables created
- [ ] Products seeded (VFP, X-RAI 2.0, AI Agents, etc.)
- [ ] Stages seeded for each product
- [ ] Companies table has customer_type column
- [ ] TypeScript types created
- [ ] Products API endpoints working
- [ ] /products page renders with cards
- [ ] Navigation link added
- [ ] TypeScript compiles clean
