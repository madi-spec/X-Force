# X-FORCE Products Tab - Complete Specification

## Executive Summary

The Products Tab is the central hub for managing X-RAI Labs' product catalog, sales processes, and customer product relationships. It enables sales reps to track deals through product-specific pipelines while leveraging AI-powered insights from call transcripts.

---

## 1. CORE CONCEPTS

### 1.1 Product Hierarchy
```
Suite (e.g., "X-RAI Platform")
  └── Base Product (e.g., "X-RAI 2.0")
        ├── Module (e.g., "Action Hub")
        ├── Module (e.g., "Accountability Hub")
        └── Addon (e.g., "AI Agents")
```

### 1.2 Product Types
| Type | Description |
|------|-------------|
| `suite` | Bundled collection of products |
| `base` | Standalone core product |
| `module` | Feature set within a base product |
| `addon` | Optional enhancement |

### 1.3 Product Status Lifecycle
```
                    ┌──────────────┐
                    │   inactive   │ (VFP customer, no product)
                    └──────┬───────┘
                           │ Start Sale
                           ▼
                    ┌──────────────┐
                    │   in_sales   │ → declined
                    └──────┬───────┘
                           │ Won
                           ▼
                    ┌──────────────┐
                    │ in_onboarding│
                    └──────┬───────┘
                           │ Activated
                           ▼
                    ┌──────────────┐
                    │    active    │ → churned
                    └──────────────┘
```

---

## 2. DATABASE SCHEMA

### 2.1 Products Table
```sql
products {
  id: uuid PRIMARY KEY
  name: text NOT NULL
  slug: text UNIQUE NOT NULL
  description: text
  parent_product_id: uuid REFERENCES products(id)
  product_type: enum('suite', 'base', 'module', 'addon')
  display_order: integer
  icon: text (Lucide icon name)
  color: text (hex color code)
  base_price_monthly: numeric
  pricing_model: enum('per_seat', 'flat', 'tiered')
  is_active: boolean DEFAULT true
  is_sellable: boolean DEFAULT true (false = legacy product)
  created_at, updated_at: timestamptz
}
```

### 2.2 Product Tiers Table
```sql
product_tiers {
  id: uuid PRIMARY KEY
  product_id: uuid REFERENCES products(id)
  name: text NOT NULL (e.g., "Basic", "Professional", "Enterprise")
  slug: text NOT NULL
  display_order: integer
  included_modules: text[] (array of module slugs)
  features: jsonb (feature flags/limits)
  price_monthly: numeric
  created_at: timestamptz
}
```

### 2.3 Product Sales Stages Table (Proven Process)
```sql
product_sales_stages {
  id: uuid PRIMARY KEY
  product_id: uuid REFERENCES products(id)
  name: text NOT NULL
  slug: text NOT NULL
  stage_order: integer NOT NULL

  -- Stage Definition
  goal: text (what rep should accomplish)
  description: text (detailed instructions)
  exit_criteria: text (requirements to advance)

  -- Sales Enablement
  pitch_points: jsonb[] (manual pitch points)
  objection_handlers: jsonb[] (objection/response pairs)
  resources: jsonb[] (links, docs, videos)

  -- AI Integration
  ai_sequence_id: uuid (linked automation sequence)
  ai_actions: jsonb (automated actions config)
  ai_suggested_pitch_points: jsonb[] (AI-generated suggestions)
  ai_suggested_objections: jsonb[] (AI-detected objections)
  ai_insights: jsonb (analysis results)

  -- Metrics
  avg_days_in_stage: numeric
  conversion_rate: numeric (% advancing to next stage)

  is_active: boolean DEFAULT true
  created_at, updated_at: timestamptz
}
```

### 2.4 Company Products Table (Pipeline Tracking)
```sql
company_products {
  id: uuid PRIMARY KEY
  company_id: uuid REFERENCES companies(id)
  product_id: uuid REFERENCES products(id)

  -- Status & Tier
  status: enum('inactive', 'in_sales', 'in_onboarding', 'active', 'churned', 'declined')
  tier_id: uuid REFERENCES product_tiers(id)

  -- Seats & Revenue
  seats: integer
  mrr: numeric (monthly recurring revenue)
  enabled_modules: text[]

  -- Pipeline Position
  current_stage_id: uuid REFERENCES product_sales_stages(id)
  stage_entered_at: timestamptz

  -- Lifecycle Timestamps
  sales_started_at: timestamptz
  onboarding_started_at: timestamptz
  activated_at: timestamptz
  churned_at: timestamptz
  declined_at: timestamptz

  -- AI Automation
  ai_sequence_active: boolean DEFAULT false
  ai_sequence_paused_reason: text

  -- Operating Layer Extensions
  last_stage_moved_at: timestamptz
  last_human_touch_at: timestamptz
  last_ai_touch_at: timestamptz
  close_confidence: integer (0-100)
  close_ready: boolean
  risk_level: enum('none', 'low', 'med', 'high')
  open_objections: text[]
  next_step_due_at: timestamptz

  -- Ownership
  owner_user_id: uuid REFERENCES users(id)
  notes: text

  created_at, updated_at: timestamptz

  UNIQUE(company_id, product_id)
}
```

### 2.5 Company Product History Table (Audit Trail)
```sql
company_product_history {
  id: uuid PRIMARY KEY
  company_product_id: uuid REFERENCES company_products(id)
  event_type: enum('status_changed', 'stage_changed', 'tier_changed', 'seats_changed', 'note_added')
  from_value: text
  to_value: text
  changed_by: uuid REFERENCES users(id)
  notes: text
  created_at: timestamptz
}
```

---

## 3. USER INTERFACE

### 3.1 Products Index Page (`/products`)

**Purpose:** Master view of all sellable products with quick stats and navigation.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Products                                                       │
│  Manage your product catalog and sales pipelines                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Icon] X-RAI 2.0                          [LEGACY]      │   │
│  │ AI-powered pest control operations platform             │   │
│  │                                                         │   │
│  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │   │
│  │ │Active  │ │In Sales│ │Onboard │ │Inactive│ │  MRR   │ │   │
│  │ │  127   │ │   23   │ │   8    │ │   45   │ │ $45.2K │ │   │
│  │ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ │   │
│  │                                                         │   │
│  │ Pipeline: [Discovery 5] → [Demo 8] → [Trial 6] → [Close 4] │
│  │                                                         │   │
│  │           [Proven Process]  [View Pipeline]             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Icon] AI Agents                                        │   │
│  │ ... (repeat for each product)                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Product cards with icon, name, description
- Legacy badge for non-sellable products
- 5 clickable stat badges (navigate to filtered views)
- Mini pipeline visualization showing stage counts
- Two action buttons: Proven Process, View Pipeline

**Stats Calculation:**
- Active: count where status = 'active'
- In Sales: count where status = 'in_sales'
- In Onboarding: count where status = 'in_onboarding'
- Inactive: (total VFP customers) - (active + in_sales + in_onboarding)
- MRR: sum of mrr for active customers

---

### 3.2 Product Detail Page (`/products/[slug]`)

**Purpose:** Detailed product management with multi-tab pipeline/customer views.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Products                                             │
│                                                                 │
│  [Icon] X-RAI 2.0                        [Proven Process →]    │
│  AI-powered pest control operations platform                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  │In Sales │ │Onboard  │ │ Active  │ │Inactive │ │Total MRR│ │Avg MRR  │
│  │   23    │ │    8    │ │   127   │ │   45    │ │ $45.2K  │ │  $356   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
│                                                                 │
│  [In Sales] [Onboarding] [Active] [Inactive]    ← Tab switcher │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  (Tab Content - see 3.2a-3.2d below)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Stat Cards:**
| Stat | Icon | Color |
|------|------|-------|
| In Sales | Target | Yellow/Amber |
| Onboarding | Clock | Blue |
| Active | Users | Green |
| Inactive | UserX | Gray |
| Total MRR | DollarSign | Emerald |
| Avg MRR | TrendingUp | Purple |

---

### 3.2a In Sales Tab (Pipeline View)

**Layout:** Horizontal Kanban board with stages as columns.

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Discovery (5)│  │   Demo (8)   │  │  Trial (6)   │  │ Close (4)  │ │
│  │              │  │              │  │              │  │            │ │
│  │ Goal: Under- │  │ Goal: Show   │  │ Goal: Prove  │  │Goal: Sign  │ │
│  │ stand needs  │  │ capabilities │  │ value        │  │contract    │ │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├────────────┤ │
│  │┌────────────┐│  │┌────────────┐│  │┌────────────┐│  │┌──────────┐│ │
│  ││ Acme Pest  ││  ││ Bug Stop   ││  ││ Pest Pro   ││  ││ Green    ││ │
│  ││ Dallas, TX ││  ││ Austin, TX ││  ││ Houston,TX ││  ││ Shield   ││ │
│  ││ 5 days     ││  ││ 12 days    ││  ││ 8 days     ││  ││ 3 days   ││ │
│  ││ John Smith ││  ││ Jane Doe   ││  ││ Bob Jones  ││  ││ Sue Lee  ││ │
│  ││ [▶ AI On]  ││  ││ [⏸ Manual] ││  ││ [▶ AI On]  ││  ││ [▶ AI On]││ │
│  │└────────────┘│  │└────────────┘│  │└────────────┘│  │└──────────┘│ │
│  │┌────────────┐│  │┌────────────┐│  │              │  │            │ │
│  ││ ...        ││  ││ ...        ││  │              │  │            │ │
│  │└────────────┘│  │└────────────┘│  │              │  │            │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Card Details:**
- Company name (clickable → company page)
- Location (city, state)
- Days in stage (from stage_entered_at)
- Sales owner name
- AI status indicator (green play = active, gray pause = manual)

---

### 3.2b-d Other Tabs (Table Views)

**Onboarding, Active, Inactive tabs** use table layouts:

| Company | Tier | Seats | MRR | Since | Owner | Actions |
|---------|------|-------|-----|-------|-------|---------|
| Acme Pest | Professional | 25 | $450 | Dec 15 | John S. | [View] [Convert] |

**Special Feature - Legacy Conversion:**
For legacy products, shows "Convert to [New Product]" button per row.

---

### 3.3 Proven Process Editor (`/products/[slug]/process`)

**Purpose:** Configure the product's sales playbook - stages, pitch points, objection handlers.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to X-RAI 2.0                                                    │
│                                                                         │
│  Proven Process Editor                         [Analyze Transcripts]   │
│  Define your sales stages and AI-powered coaching                       │
├────────────────────────────┬────────────────────────────────────────────┤
│                            │                                            │
│  SALES STAGES              │  STAGE DETAILS                             │
│                            │                                            │
│  ┌──────────────────────┐  │  ┌──────────────────────────────────────┐  │
│  │ 1. Discovery      ▼  │  │  │ Stage: Discovery              [Save] │  │
│  │    Goal: Understand   │  │  │                                      │  │
│  │    Conv: 85% | 4.2d   │  │  │ Goal:                                │  │
│  │    3 pitch | 5 obj    │  │  │ [Understand customer pain points   ] │  │
│  │    [Edit] [Delete]    │  │  │                                      │  │
│  └──────────────────────┘  │  │ Description:                         │  │
│  ┌──────────────────────┐  │  │ [Multi-line textarea for detailed   ] │  │
│  │ 2. Demo           ▼  │  │  │ [instructions to sales rep          ] │  │
│  │    Goal: Show value   │  │  │                                      │  │
│  │    Conv: 72% | 8.1d   │  │  │ Exit Criteria:                       │  │
│  │    5 pitch | 8 obj    │  │  │ [What must happen to advance        ] │  │
│  └──────────────────────┘  │  ├──────────────────────────────────────┤  │
│  ┌──────────────────────┐  │  │ PITCH POINTS                         │  │
│  │ 3. Trial          ▼  │  │  │                                      │  │
│  │    ...                │  │  │ Manual:                              │  │
│  └──────────────────────┘  │  │ • "Focus on call volume reduction"   │  │
│  ┌──────────────────────┐  │  │ • "Highlight real-time monitoring"   │  │
│  │ 4. Negotiation    ▼  │  │  │ [+ Add Pitch Point]                  │  │
│  │    ...                │  │  │                                      │  │
│  └──────────────────────┘  │  │ AI Suggested (from transcripts):     │  │
│                            │  │ ┌────────────────────────────────┐   │  │
│  [+ Add Stage]             │  │ │ "Mention 24/7 monitoring"      │   │  │
│                            │  │ │ Effectiveness: 87% ████████░░ │   │  │
│                            │  │ │              [Accept] [Dismiss]│   │  │
│                            │  │ └────────────────────────────────┘   │  │
│                            │  ├──────────────────────────────────────┤  │
│                            │  │ OBJECTION HANDLERS                   │  │
│                            │  │                                      │  │
│                            │  │ Manual:                              │  │
│                            │  │ ┌────────────────────────────────┐   │  │
│                            │  │ │ Objection: "Too expensive"     │   │  │
│                            │  │ │ Response: "Compare to hiring   │   │  │
│                            │  │ │ another CSR at $40K/year..."   │   │  │
│                            │  │ └────────────────────────────────┘   │  │
│                            │  │                                      │  │
│                            │  │ AI Detected:                         │  │
│                            │  │ ┌────────────────────────────────┐   │  │
│                            │  │ │ "We already use PestPac"       │   │  │
│                            │  │ │ Frequency: 34% | Success: 78%  │   │  │
│                            │  │ │              [Accept] [Dismiss]│   │  │
│                            │  │ └────────────────────────────────┘   │  │
│                            │  ├──────────────────────────────────────┤  │
│                            │  │ RESOURCES                            │  │
│                            │  │ • [PDF] Product Overview Deck        │  │
│                            │  │ • [Video] Demo Recording             │  │
│                            │  │ • [Link] ROI Calculator              │  │
│                            │  │ [+ Add Resource]                     │  │
│                            │  ├──────────────────────────────────────┤  │
│                            │  │ FUNNEL METRICS                       │  │
│                            │  │                                      │  │
│                            │  │ Discovery → Demo → Trial → Close     │  │
│                            │  │    85%       72%     68%     45%     │  │
│                            │  │   4.2d      8.1d    12.3d   5.4d     │  │
│                            │  └──────────────────────────────────────┘  │
│                            │                                            │
└────────────────────────────┴────────────────────────────────────────────┘
```

**Features:**

1. **Stage List (Left Panel):**
   - Drag-to-reorder stages
   - Expandable rows with metrics
   - Add/Edit/Delete buttons
   - Visual conversion rate and avg days display

2. **Stage Detail (Right Panel):**
   - Edit name, goal, description, exit criteria
   - Manage pitch points (manual + AI-suggested)
   - Manage objection handlers (manual + AI-detected)
   - Attach resources (links, docs, videos)
   - View funnel metrics visualization

3. **AI Analysis:**
   - "Analyze Transcripts" button triggers AI processing
   - Analyzes all call transcripts related to product
   - Extracts winning pitch patterns
   - Detects common objections and successful responses
   - Calculates effectiveness scores

---

## 4. API ENDPOINTS

### 4.1 Products
```
GET  /api/products
     ?include_modules=true
     ?include_stats=true
     ?sellable_only=true
     → Returns all active products with optional expansions

GET  /api/products/[slug]
     → Returns product with tiers, stages, modules, pipeline, stats
```

### 4.2 Product Stages (Proven Process)
```
GET    /api/products/[slug]/stages
       → Returns all stages ordered by stage_order

POST   /api/products/[slug]/stages
       Body: { name, goal, description, exit_criteria, stage_order }
       → Creates new stage

GET    /api/products/[slug]/stages/[stageId]
       → Returns single stage detail

PATCH  /api/products/[slug]/stages/[stageId]
       Body: { name, goal, description, exit_criteria,
               pitch_points, objection_handlers, resources,
               ai_sequence_id, ai_actions }
       → Updates stage

DELETE /api/products/[slug]/stages/[stageId]
       → Deletes stage (fails if companies exist in stage)

POST   /api/products/[slug]/stages/reorder
       Body: { stage_ids: [id1, id2, id3...] }
       → Reorders stages
```

### 4.3 AI Analysis
```
POST /api/products/[slug]/analyze
     Body: { type: 'full' | 'transcripts' | 'patterns' | 'metrics' }
     → Runs AI analysis on transcripts
     → Updates ai_suggested_pitch_points, ai_suggested_objections
     → Calculates conversion metrics

GET  /api/products/[slug]/analyze
     → Returns analysis results and AI suggestions
```

### 4.4 Company Products
```
GET  /api/companies/[id]/products
     → Returns all products for company with stage info

POST /api/companies/[id]/products
     Body: { product_id, status: 'in_sales' }
     → Starts sale, enrolls in first stage

PUT  /api/companies/[id]/products
     Body: { company_product_id, status?, tier_id?, mrr?,
             seats?, current_stage_id?, notes? }
     → Updates company product, logs history

POST /api/companies/[id]/products/convert
     Body: { from_product_id, to_product_id,
             transfer_mrr: true, transfer_tier: false }
     → Converts from legacy to new product
```

---

## 5. KEY WORKFLOWS

### 5.1 Starting a Sale
1. Navigate to company page
2. Click "Add Product"
3. Select product from catalog
4. Company enters `in_sales` status at Stage 1
5. AI sequence optionally activates

### 5.2 Moving Through Pipeline
1. Rep works deal through stages
2. Manually advances stage when exit criteria met
3. System tracks days in each stage
4. AI may suggest next actions

### 5.3 Configuring Proven Process
1. Navigate to product → Proven Process
2. Define sales stages in order
3. Add pitch points and objection handlers
4. Click "Analyze Transcripts" for AI insights
5. Accept/dismiss AI suggestions
6. Attach relevant resources

### 5.4 Converting Legacy Customers
1. Navigate to legacy product → Active/Onboarding tab
2. Click "Convert to [New Product]" on customer row
3. Confirm conversion
4. Old product marked churned, MRR transferred to new

---

## 6. DESIGN SPECIFICATIONS

### 6.1 Color Palette
| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background | white | #1a1a1a |
| Card | white | #1a1a1a |
| Border | gray-200 | #2a2a2a |
| In Sales badge | amber-100/amber-700 | amber-900/amber-300 |
| Onboarding badge | blue-100/blue-700 | blue-900/blue-300 |
| Active badge | green-100/green-700 | green-900/green-300 |
| Inactive badge | gray-100/gray-600 | gray-800/gray-400 |

### 6.2 Typography
- Page headers: `text-xl font-normal` (not bold)
- Card titles: `text-lg font-semibold`
- Stat values: `text-3xl font-light`
- Labels: `text-sm text-gray-500`
- Body: `text-sm text-gray-900`

### 6.3 Spacing
- Card padding: `p-6`
- Grid gap: `gap-4` or `gap-6`
- Section spacing: `space-y-6`
- Stat card grid: `grid-cols-6`

### 6.4 Components
- Cards: `rounded-xl shadow-sm border hover:shadow-md transition-shadow`
- Buttons: `rounded-lg px-4 py-2`
- Badges: `rounded-full px-2 py-0.5 text-xs font-medium`
- Tables: horizontal borders only, `hover:bg-gray-50`

---

## 7. DATA RELATIONSHIPS

```
products (1) ──────────────────→ (many) product_sales_stages
    │                                        │
    │                                        ↓
    ↓                           company_products.current_stage_id
product_tiers ←──────────────── company_products.tier_id
    │                                        │
    │                                        ↓
    ↓                           company_product_history
company_products.product_id

products (parent) ←── products.parent_product_id (child modules)
```

---

## 8. CURRENT STATE & LIMITATIONS

### What Exists:
- Full product CRUD
- Multi-tier pricing support
- Kanban pipeline view for In Sales
- Table views for other statuses
- Proven Process editor with stages
- Manual pitch points and objection handlers
- AI transcript analysis integration
- Legacy product conversion workflow
- History/audit trail

### Current Limitations:
1. No drag-and-drop between pipeline stages (view only)
2. No bulk actions on multiple companies
3. No export/reporting built into UI
4. Stage deletion blocked if companies exist (must reassign)
5. AI analysis depends on existing transcripts
6. No prospecting pipeline UI (table exists but unused)

---

## 9. POTENTIAL ENHANCEMENTS

Consider these areas for refinement:

1. **Pipeline Interactivity:** Drag cards between stages
2. **Bulk Operations:** Select multiple, bulk update status/owner
3. **Forecasting:** Revenue projections based on pipeline
4. **Win/Loss Analysis:** Detailed reports on closed deals
5. **Stage SLAs:** Alerts when deals stall too long
6. **Guided Selling:** Step-by-step coaching within stages
7. **Competitor Tracking:** Per-deal competitor intelligence
8. **Resource Effectiveness:** Track which resources help close
9. **Mobile Pipeline:** Responsive Kanban for mobile
10. **AI Recommendations:** Proactive next-best-action suggestions

---

## 10. FILE STRUCTURE

```
src/
├── app/(dashboard)/products/
│   ├── page.tsx                    # Products index
│   └── [slug]/
│       ├── page.tsx                # Product detail (4 tabs)
│       └── process/
│           └── page.tsx            # Proven process editor
├── app/api/products/
│   ├── route.ts                    # GET products list
│   └── [slug]/
│       ├── route.ts                # GET product detail
│       ├── stages/
│       │   ├── route.ts            # GET/POST stages
│       │   ├── [stageId]/route.ts  # GET/PATCH/DELETE stage
│       │   └── reorder/route.ts    # POST reorder
│       └── analyze/route.ts        # POST/GET AI analysis
├── components/products/
│   ├── ProductCard.tsx
│   ├── ProductHeader.tsx
│   ├── ProductStats.tsx
│   ├── ProductPipeline.tsx
│   ├── ProductCustomers.tsx
│   ├── ProvenProcessEditor.tsx
│   ├── StageDetailPanel.tsx
│   ├── AddStageModal.tsx
│   └── AISuggestions.tsx
├── types/products.ts               # TypeScript definitions
└── supabase/migrations/
    └── 20251224_product_centric_combined.sql
```

---

*This specification represents the complete current state of the Products Tab as of December 2025. Use this as a foundation for refinement and enhancement discussions.*
