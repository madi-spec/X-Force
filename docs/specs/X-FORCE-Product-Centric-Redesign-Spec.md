# X-FORCE CRM: Product-Centric Redesign Specification

## Executive Summary

Transform X-FORCE from a deal-centric CRM to a **product-centric customer expansion platform**. This reflects X-RAI's actual business: expanding relationships with existing Voice for Pest customers by selling AI products.

---

## Core Concepts

### Two Customer Types

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  PROSPECTS                          VFP CUSTOMERS                           │
│  (Non-Voice for Pest)               (Voice for Pest/Turf customers)         │
│  ─────────────────────              ─────────────────────────────           │
│                                                                             │
│  Go through:                        Go through:                             │
│  PROSPECTING PIPELINE               PRODUCT EXPANSION                       │
│  (Traditional deal stages)          (Product-specific journeys)             │
│                                                                             │
│  Goal: Convert to VFP Customer      Goal: Adopt more AI products            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Product Status Model

Every company has a **status for each product**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PRODUCT STATUS LIFECYCLE                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⚫ INACTIVE                                                                │
│       │                                                                     │
│       ▼                                                                     │
│  🟡 IN SALES ──────────────────────────────────┐                           │
│       │ (going through proven process)          │                           │
│       ▼                                         ▼                           │
│  🟠 IN ONBOARDING                          🔴 DECLINED                      │
│       │                                                                     │
│       ▼                                                                     │
│  🟢 ACTIVE CUSTOMER ───────────────────────────┐                           │
│       │                                         │                           │
│       ▼                                         ▼                           │
│  ⚪ CHURNED                                 (upsell to next tier)           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Proven Process (per product)

Each product has defined sales stages with:
- Stage name & order
- Goal of the stage
- AI actions (automated sequences)
- Key pitch points
- Exit criteria
- Objection handlers

The CRM **learns from transcripts** to suggest improvements.

---

## Product Hierarchy

```
PRODUCTS
├── Voice for Pest / Voice for Turf
│   └── (Base phone system - determines if VFP Customer)
│
├── AI Product Suite (AOS)
│   ├── Summary Note
│   ├── Smart Data Plus
│   ├── X-RAI 1.0
│   └── Tiers: [Silver, Gold, Platinum]
│
├── X-RAI 2.0
│   ├── Performance Center (module)
│   ├── Action Hub (module)
│   ├── Accountability Hub (module)
│   └── Configuration: seats (number)
│
└── AI Agents
    ├── Receptionist Agent (module)
    ├── Integrated Scheduling (module)
    ├── Sales Agent (module)
    ├── Billing Agent (module)
    ├── Outbound SMS (module)
    └── (more coming)
```

---

## Database Schema

### Table: `products`

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,  -- 'xrai-2', 'ai-agents', 'vfp'
  description TEXT,
  
  -- Hierarchy
  parent_product_id UUID REFERENCES products(id),  -- For modules under main products
  product_type TEXT NOT NULL,  -- 'base', 'suite', 'module', 'addon'
  
  -- Display
  display_order INTEGER DEFAULT 0,
  icon TEXT,  -- Icon name or emoji
  color TEXT,  -- Hex color for UI
  
  -- Pricing (optional, for reference)
  base_price_monthly DECIMAL(10,2),
  pricing_model TEXT,  -- 'per_seat', 'flat', 'tiered'
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_sellable BOOLEAN DEFAULT TRUE,  -- Can be sold independently
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed core products
INSERT INTO products (name, slug, product_type, is_sellable) VALUES
  ('Voice for Pest', 'vfp', 'base', false),
  ('Voice for Turf', 'vft', 'base', false),
  ('Summary Note', 'summary-note', 'suite', true),
  ('Smart Data Plus', 'smart-data-plus', 'suite', true),
  ('X-RAI 1.0', 'xrai-1', 'suite', true),
  ('X-RAI 2.0', 'xrai-2', 'suite', true),
  ('AI Agents', 'ai-agents', 'suite', true);

-- X-RAI 2.0 modules
INSERT INTO products (name, slug, product_type, parent_product_id, is_sellable) VALUES
  ('Performance Center', 'performance-center', 'module', (SELECT id FROM products WHERE slug='xrai-2'), false),
  ('Action Hub', 'action-hub', 'module', (SELECT id FROM products WHERE slug='xrai-2'), false),
  ('Accountability Hub', 'accountability-hub', 'module', (SELECT id FROM products WHERE slug='xrai-2'), false);

-- AI Agent modules
INSERT INTO products (name, slug, product_type, parent_product_id, is_sellable) VALUES
  ('Receptionist Agent', 'receptionist-agent', 'module', (SELECT id FROM products WHERE slug='ai-agents'), false),
  ('Integrated Scheduling', 'integrated-scheduling', 'module', (SELECT id FROM products WHERE slug='ai-agents'), false),
  ('Sales Agent', 'sales-agent', 'module', (SELECT id FROM products WHERE slug='ai-agents'), false),
  ('Billing Agent', 'billing-agent', 'module', (SELECT id FROM products WHERE slug='ai-agents'), false),
  ('Outbound SMS', 'outbound-sms', 'module', (SELECT id FROM products WHERE slug='ai-agents'), false);
```

### Table: `product_tiers`

```sql
CREATE TABLE product_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  
  name TEXT NOT NULL,  -- 'Silver', 'Gold', 'Platinum'
  slug TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  
  -- What's included
  included_modules TEXT[],  -- Array of module slugs
  features JSONB,  -- Feature flags/limits
  
  price_monthly DECIMAL(10,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `company_products` (The Core Relationship)

```sql
CREATE TABLE company_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'inactive',
  -- 'inactive', 'in_sales', 'in_onboarding', 'active', 'churned', 'declined'
  
  -- For products with tiers
  tier_id UUID REFERENCES product_tiers(id),
  
  -- For products with seats
  seats INTEGER,
  
  -- For products with modules (which modules are enabled)
  enabled_modules TEXT[] DEFAULT '{}',
  
  -- Sales Process Tracking (when in_sales)
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
  
  -- Metadata
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, product_id)
);

-- Index for quick lookups
CREATE INDEX idx_company_products_company ON company_products(company_id);
CREATE INDEX idx_company_products_product ON company_products(product_id);
CREATE INDEX idx_company_products_status ON company_products(status);
CREATE INDEX idx_company_products_stage ON company_products(current_stage_id);
```

### Table: `product_sales_stages` (Proven Process)

```sql
CREATE TABLE product_sales_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  
  -- Stage Definition
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  
  -- Goals & Guidance
  goal TEXT,  -- "Get them to schedule a demo"
  description TEXT,  -- Longer explanation
  
  -- AI Automation
  ai_sequence_id UUID,  -- Reference to AI sequence for this stage
  ai_actions JSONB,  -- What AI should do at this stage
  -- Example: { "emails": 3, "sms": 1, "wait_days_between": 2 }
  
  -- Sales Enablement
  pitch_points JSONB,  -- Array of key talking points
  -- Example: ["See your own data", "5-10x ROI", "Not just software"]
  
  objection_handlers JSONB,  -- Common objections and responses
  -- Example: [{ "objection": "Too expensive", "response": "..." }]
  
  resources JSONB,  -- Links to collateral, videos, etc.
  
  -- Exit Criteria
  exit_criteria TEXT,  -- "Demo scheduled" or "Preview approved"
  exit_actions JSONB,  -- What happens when stage completes
  
  -- Metrics (for optimization)
  avg_days_in_stage DECIMAL(5,1),
  conversion_rate DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(product_id, slug)
);

-- Example stages for X-RAI 2.0
INSERT INTO product_sales_stages (product_id, name, slug, stage_order, goal, exit_criteria) VALUES
  ((SELECT id FROM products WHERE slug='xrai-2'), 'Actively Engaging', 'engaging', 1, 'Get their attention and interest', 'Demo scheduled'),
  ((SELECT id FROM products WHERE slug='xrai-2'), 'Demo Scheduled', 'demo-scheduled', 2, 'Show platform capabilities', 'Preview approved'),
  ((SELECT id FROM products WHERE slug='xrai-2'), 'Preview Approved', 'preview-approved', 3, 'Get approval to run their data', 'Data loaded'),
  ((SELECT id FROM products WHERE slug='xrai-2'), 'Preview Ready', 'preview-ready', 4, 'X-RAI populated with their data', 'Follow-up scheduled'),
  ((SELECT id FROM products WHERE slug='xrai-2'), 'Follow-up Call', 'followup', 5, 'Review their data together', 'Trial started'),
  ((SELECT id FROM products WHERE slug='xrai-2'), 'Trial', 'trial', 6, '7 days hands-on access', 'Proposal requested'),
  ((SELECT id FROM products WHERE slug='xrai-2'), 'Proposal', 'proposal', 7, 'Negotiate and close', 'Won or Declined');
```

### Table: `company_product_history`

```sql
CREATE TABLE company_product_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_product_id UUID NOT NULL REFERENCES company_products(id) ON DELETE CASCADE,
  
  -- What changed
  event_type TEXT NOT NULL,
  -- 'status_changed', 'stage_changed', 'tier_changed', 'seats_changed', 'note_added'
  
  from_value TEXT,
  to_value TEXT,
  
  -- Context
  changed_by UUID REFERENCES users(id),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Update: `companies` table

Add fields to the companies table:

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'prospect';
-- 'prospect' = not a VFP customer yet
-- 'vfp_customer' = Voice for Pest customer
-- 'vft_customer' = Voice for Turf customer

ALTER TABLE companies ADD COLUMN IF NOT EXISTS vfp_customer_id TEXT;  -- Their ID in VFP system
ALTER TABLE companies ADD COLUMN IF NOT EXISTS vfp_support_contact TEXT;  -- Internal support person
ALTER TABLE companies ADD COLUMN IF NOT EXISTS became_customer_at TIMESTAMPTZ;
```

### Table: `prospecting_pipeline` (For Non-VFP)

```sql
CREATE TABLE prospecting_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Stage
  stage TEXT NOT NULL DEFAULT 'lead',
  -- 'lead', 'qualified', 'demo_scheduled', 'demo_complete', 'proposal', 'negotiation', 'won', 'lost'
  
  -- Interest
  interested_products TEXT[] DEFAULT '{}',  -- Which products they're interested in
  
  -- Ownership
  owner_user_id UUID REFERENCES users(id),
  
  -- Key Dates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  demo_at TIMESTAMPTZ,
  proposal_sent_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- Outcome
  outcome TEXT,  -- 'won', 'lost'
  lost_reason TEXT,
  
  -- If won, they become VFP customer
  converted_to_customer_at TIMESTAMPTZ,
  
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## UI Pages

### 1. Products Page (`/products`)

Overview of all products with adoption metrics.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PRODUCTS                                                    [+ Add Product] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🚀 X-RAI 2.0                                           [Proven Process] │ │
│ │ ─────────────────────────────────────────────────────────────────────── │ │
│ │                                                                         │ │
│ │  🟢 Active: 12    🟡 In Sales: 8    🟠 Onboarding: 3    ⚫ Inactive: 180│ │
│ │                                                                         │ │
│ │  SALES PIPELINE:                                                        │ │
│ │  Engaging(2) → Demo(1) → Preview(2) → Trial(2) → Proposal(1)           │ │
│ │                                                                         │ │
│ │  Conversion: 45% │ Avg Cycle: 23 days │ MRR: $48,000                   │ │
│ │                                                                         │ │
│ │  [View Pipeline] [View Customers] [Analytics]                           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🤖 AI Agents                                           [Proven Process] │ │
│ │ ─────────────────────────────────────────────────────────────────────── │ │
│ │                                                                         │ │
│ │  🟢 Active: 25    🟡 In Sales: 4    🟠 Onboarding: 2    ⚫ Inactive: 175│ │
│ │  ...                                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [More products...]                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Product Detail Page (`/products/[slug]`)

Pipeline view + proven process for one product.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Products    X-RAI 2.0                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [Pipeline] [Proven Process] [Analytics] [Settings]                          │
│                                                                             │
│ ═══════════════════════════════════════════════════════════════════════════ │
│                                                                             │
│ PIPELINE                                                                    │
│                                                                             │
│ Engaging (2)        Demo (1)         Preview (2)       Trial (2)           │
│ ┌──────────────┐   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│ │ Happinest    │   │ Triangle     │  │ Palmetto     │  │ Native Pest  │    │
│ │ 🤖 AI active │   │ 📅 Dec 26    │  │ Data loading │  │ Day 3 of 7   │    │
│ │ 5 days       │   │ 2 days       │  │ 8 days       │  │ 4 days       │    │
│ ├──────────────┤   └──────────────┘  ├──────────────┤  ├──────────────┤    │
│ │ Lawn Doctor  │                     │ Redd Pest    │  │ Frame's      │    │
│ │ 🤖 AI active │                     │ Ready!       │  │ Day 5 of 7   │    │
│ │ 3 days       │                     │ 12 days      │  │ 2 days       │    │
│ └──────────────┘                     └──────────────┘  └──────────────┘    │
│                                                                             │
│        → Proposal (1)                                                       │
│          ┌──────────────┐                                                   │
│          │ On the Fly   │                                                   │
│          │ $36k/yr      │                                                   │
│          │ Sent Dec 20  │                                                   │
│          └──────────────┘                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Proven Process Page (`/products/[slug]/process`)

Document and refine the sales process.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ X-RAI 2.0: PROVEN SALES PROCESS                          [Edit] [AI Suggest]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ STAGE 1: ACTIVELY ENGAGING                                    Avg: 5 days  │
│ ═══════════════════════════════════════════════════════════════════════════ │
│                                                                             │
│ 🎯 GOAL                                                                     │
│ Get their attention and schedule a demo call                                │
│                                                                             │
│ 🤖 AI ACTIONS                                                               │
│ • Email 1: Introduction + value prop (Day 0)                               │
│ • Email 2: Case study (Day 3)                                              │
│ • SMS: Quick check-in (Day 5)                                              │
│ • Email 3: Last chance (Day 7)                                             │
│                                                                             │
│ 💬 KEY PITCH POINTS                                         [+ Add Point]  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ "This isn't another $200/mo software - it's an intelligence engine     │ │
│ │  that will 5-10x your investment"                                       │ │
│ │                                                            [Edit] [🗑️] │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ "See YOUR data, not a generic demo"                                     │ │
│ │                                                            [Edit] [🗑️] │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ 💡 AI SUGGESTION (from transcripts):                                    │ │
│ │ "We've seen customers reduce missed calls by 40% in the first month"   │ │
│ │                                                    [Accept] [Dismiss]   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ❓ OBJECTION HANDLERS                                    [+ Add Objection] │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ "It's too expensive"                                                    │ │
│ │ → Response: "I understand. Let me show you the ROI calculator.         │ │
│ │   Most customers see payback within 60-90 days..."                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ✅ EXIT CRITERIA                                                            │
│ Demo scheduled in calendar                                                  │
│                                                                             │
│ ═══════════════════════════════════════════════════════════════════════════ │
│ STAGE 2: DEMO SCHEDULED                                       Avg: 3 days  │
│ ...                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4. Company Page (Redesigned)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HAPPINEST                                                                   │
│ 🟢 VFP Customer since 2022 │ Support: Jane Smith                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [Overview] [Products] [Communications] [Contacts] [Activity]                │
│                                                                             │
│ ═══════════════════════════════════════════════════════════════════════════ │
│                                                                             │
│ PRODUCT STATUS                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │  X-RAI 2.0              AI Agents            Smart Data+     Summary    │ │
│ │  ──────────────────     ─────────────────    ───────────     ────────   │ │
│ │  🟡 IN SALES            🟢 ACTIVE            ⚫ INACTIVE     ⚫ INACTIVE │ │
│ │                                                                         │ │
│ │  Stage: Trial           Modules:             [Start          [Start     │ │
│ │  Day 4 of 7             • Receptionist ✓      Sale]           Sale]     │ │
│ │                         • Scheduling ✓                                  │ │
│ │  🤖 AI: Waiting for     • Sales Agent ✓                                │ │
│ │     trial feedback      Seats: 3                                        │ │
│ │                                                                         │ │
│ │  [View Pipeline]        [Manage]                                        │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ RECENT COMMUNICATIONS                                      [View All →]    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 📧 Ramsey Cole - "Re: Trial feedback" - 2 hours ago                    │ │
│ │ 📞 Discovery Call - 45 min - Dec 20                                    │ │
│ │ 🤖 AI Follow-up sent - Dec 18                                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ KEY CONTACTS                                                               │
│ • Ramsey Cole - VP Operations (Primary)                                    │
│ • Sarah Kim - Technical Lead                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5. Prospecting Pipeline (`/pipeline/prospects`)

For non-VFP customers (new logos).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PROSPECTING PIPELINE                                      [+ Add Prospect] │
│ New business (non-VFP customers)                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Lead (5)          Qualified (3)      Demo (2)         Proposal (1)         │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│ │ ABC Pest     │  │ XYZ Lawn     │  │ 123 Pest     │  │ Big Pest Co  │     │
│ │ Interested:  │  │ Interested:  │  │ 📅 Dec 28    │  │ $120k/yr     │     │
│ │ VFP + X-RAI  │  │ AI Agents    │  │ VFP + Suite  │  │ Full suite   │     │
│ └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│ ...               ...                                                       │
│                                                                             │
│ Won this month: 2 ($85k ARR)                                               │
│ Lost this month: 1                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6. Whitespace Analytics (`/analytics/whitespace`)

See adoption gaps.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ WHITESPACE ANALYSIS                                                         │
│ Expansion opportunities in existing customer base                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ VFP CUSTOMER BASE: 208 companies                                           │
│                                                                             │
│ PRODUCT ADOPTION                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ AI Agents      ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  25 (12%)       │ │
│ │ X-RAI 2.0      ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  12 (6%)        │ │
│ │ Smart Data+    ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   8 (4%)        │ │
│ │ Summary Note   ██████████████████░░░░░░░░░░░░░░░░░░░░  45 (22%)       │ │
│ │ X-RAI 1.0      ████████████████████████░░░░░░░░░░░░░░  60 (29%)       │ │
│ │                                                                         │ │
│ │ No AI Products ████████████████████████████████████░░░ 150 (72%)       │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ OPPORTUNITIES                                                               │
│ • 150 VFP customers with NO AI products                   [View List]      │
│ • 45 Summary Note customers could upgrade to X-RAI        [View List]      │
│ • 60 X-RAI 1.0 customers could upgrade to 2.0             [View List]      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## AI-Powered Features

### 1. Proven Process Learning

The CRM analyzes transcripts to:
- **Suggest new pitch points** that worked in successful deals
- **Identify common objections** and how they were handled
- **Calculate stage metrics** (avg time, conversion rates)
- **Flag what's different** about won vs lost deals

```typescript
// Example: Analyze transcripts for a product
async function analyzeTranscriptsForProduct(productId: string) {
  // Get all transcripts for companies where this product was sold
  const transcripts = await getTranscriptsForProductSales(productId);
  
  // Extract successful patterns
  const analysis = await ai.analyze({
    prompt: `Analyze these sales transcripts for ${product.name}.
    
    Identify:
    1. Key phrases that resonated with customers
    2. Common objections and successful responses
    3. Questions that led to positive outcomes
    4. Red flags that appeared in lost deals
    
    Transcripts: ${transcripts}`,
  });
  
  // Suggest updates to proven process
  return analysis.suggestions;
}
```

### 2. AI Sequences by Stage

Each stage can have automated AI actions:

```typescript
interface StageAIConfig {
  emails: {
    template_id: string;
    delay_days: number;
    subject: string;
  }[];
  sms: {
    template_id: string;
    delay_days: number;
  }[];
  pause_on: string[];  // ['replied', 'meeting_scheduled']
}
```

### 3. Communication Badges

Show AI activity status on pipeline cards:

```
🤖 AI Active - Sequence running
⏸️ AI Paused - Waiting for reply
✅ AI Complete - Sequence finished
⚠️ AI Stalled - No response after sequence
```

---

## Data Import Plan

### 1. Voice for Pest Customer Import

From your spreadsheet:
- Company name
- Address
- VFP Customer ID
- Internal support contact

```typescript
// Import format
interface VFPCustomerImport {
  name: string;
  address: string;
  vfp_customer_id: string;
  support_contact: string;  // Jane Smith, etc.
}

// Creates:
// - Company record (customer_type = 'vfp_customer')
// - company_products record for VFP (status = 'active')
```

### 2. AI Product Customer Import

From billing spreadsheet:
- Company name
- Products they have
- Tier/seats if applicable

```typescript
// Import format
interface AIProductImport {
  company_name: string;  // Match to existing company
  products: {
    slug: string;  // 'xrai-2', 'ai-agents', etc.
    tier?: string;
    seats?: number;
    modules?: string[];
  }[];
}

// Creates:
// - company_products records (status = 'active')
```

### 3. Deal Migration

Map existing deals to product statuses:

```typescript
// For each existing deal:
// 1. Identify which product it's for (from name/notes)
// 2. Create company_products record with status = 'in_sales'
// 3. Set current_stage based on deal stage mapping
// 4. Archive or delete the old deal
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create database tables (products, company_products, stages, etc.)
- [ ] Seed products and default stages
- [ ] Create Products page (list view)
- [ ] Add customer_type to companies

### Phase 2: Data Import (Week 1-2)
- [ ] Build import scripts for VFP customers
- [ ] Build import scripts for AI product customers
- [ ] Migrate existing deals to company_products
- [ ] Verify data integrity

### Phase 3: Product UI (Week 2)
- [ ] Product detail page with pipeline view
- [ ] Company page redesign with product status grid
- [ ] "Start Sale" flow (create company_product, assign stage)

### Phase 4: Proven Process (Week 2-3)
- [ ] Proven process editor page
- [ ] Stage management (add/edit/reorder)
- [ ] Pitch points and objection handlers
- [ ] AI sequence configuration per stage

### Phase 5: AI Learning (Week 3-4)
- [ ] Transcript analysis for pitch suggestions
- [ ] Objection extraction from transcripts
- [ ] Win/loss pattern analysis
- [ ] Stage metrics calculation

### Phase 6: Polish (Week 4)
- [ ] Whitespace analytics
- [ ] Prospecting pipeline
- [ ] Dashboard widgets
- [ ] Mobile optimization

---

## Success Metrics

| Metric | How to Measure |
|--------|----------------|
| Product adoption rate | Active customers / Total VFP customers |
| Pipeline velocity | Avg days from Engaging → Won |
| Stage conversion | % moving to next stage |
| AI effectiveness | Reply rate, meeting rate from AI sequences |
| Whitespace captured | New product sales to existing customers |
| Process improvement | Pitch point usage correlation with wins |

---

## Open Questions

1. **What happens to existing Communication Hub?** 
   - Keep it, integrate with company page

2. **How to handle multi-product deals?**
   - Each product tracked separately
   - Can bundle in pricing but track adoption individually

3. **Stage customization per product?**
   - Yes, each product has its own stages
   - Some products might share similar stages

4. **Reporting needs?**
   - Pipeline by product
   - Adoption dashboard
   - Rep performance by product
