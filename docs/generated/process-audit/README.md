# Process & Pipeline Consolidation Audit

> **Generated:** 2026-01-01
> **Status:** REQUIRES CONSOLIDATION
> **Complexity:** HIGH - 4 generations of pipeline/process systems

---

## Executive Summary

The X-FORCE codebase has **4 distinct generations** of pipeline and process management systems that have evolved over time. These systems have significant overlap and need consolidation to reduce technical debt and user confusion.

| Generation | Location | Primary Table(s) | Status |
|------------|----------|------------------|--------|
| Gen 1: Deals Pipeline | `/deals` | `deals` + hardcoded stages | **LEGACY** |
| Gen 2: Proven Process | `/products/[slug]/process` | `product_sales_stages` | **ACTIVE** |
| Gen 3: Process Studio | `/process` | `product_processes` + `product_process_stages` | **ACTIVE** |
| Gen 4: Workflow Builder | `/process/[slug]/[type]/builder` | `processes` + `process_nodes` | **ACTIVE** |

### The Problem

1. **User Confusion**: 4 different places to manage pipeline/process
2. **Data Fragmentation**: Same concepts stored in different tables
3. **Inconsistent UX**: Different editors with different capabilities
4. **Maintenance Burden**: 4 codepaths for similar functionality

---

## Detailed Analysis

### Generation 1: Legacy Deals Pipeline

**URL:** `/deals`

**Components:**
- `src/app/(dashboard)/deals/page.tsx`
- `src/app/(dashboard)/deals/DealsView.tsx`
- `src/components/pipeline/KanbanBoard.tsx`

**Data Model:**
```typescript
// Hardcoded in src/types/index.ts
PIPELINE_STAGES = [
  { id: 'new_lead', name: 'New Lead', order: 1 },
  { id: 'qualifying', name: 'Qualifying', order: 2 },
  { id: 'discovery', name: 'Discovery', order: 3 },
  { id: 'demo', name: 'Demo', order: 4 },
  { id: 'data_review', name: 'Data Review', order: 5 },
  { id: 'trial', name: 'Trial', order: 6 },
  { id: 'negotiation', name: 'Negotiation', order: 7 },
  { id: 'closed_won', name: 'Closed Won', order: 8 },
  { id: 'closed_lost', name: 'Closed Lost', order: 9 },
]
```

**Database:** `deals` table with `stage` column (string matching hardcoded IDs)

**Features:**
- Kanban board view
- List view
- Filters (company, salesperson, team, product)
- "Mark as Won" conversion to customer

**Limitations:**
- Stages are hardcoded, not per-product
- No pitch points, objection handlers, or resources
- No AI suggestions
- No event sourcing

---

### Generation 2: Proven Process Editor

**URL:** `/products/[slug]/process`

**Components:**
- `src/app/(dashboard)/products/[slug]/process/page.tsx`
- `src/components/products/ProvenProcessEditor.tsx`
- `src/components/products/StageDetailPanel.tsx`
- `src/components/products/AddStageModal.tsx`

**Data Model:**
```sql
product_sales_stages {
  id UUID,
  product_id UUID,
  name TEXT,
  slug TEXT,
  stage_order INTEGER,
  goal TEXT,
  description TEXT,
  exit_criteria TEXT,
  pitch_points JSONB,        -- [{id, text, source, effectiveness_score}]
  objection_handlers JSONB,  -- [{id, objection, response, source}]
  resources JSONB,           -- [{id, title, url, type}]
  ai_suggested_pitch_points JSONB,
  ai_suggested_objections JSONB,
  ai_insights JSONB,
  avg_days_in_stage NUMERIC,
  conversion_rate NUMERIC,
  ai_sequence_id UUID,
  ai_actions JSONB
}
```

**Features:**
- Per-product sales stages
- Pitch points with AI suggestions
- Objection handlers with AI suggestions
- Resources (documents, videos, links)
- AI transcript analysis for insights
- Metrics (avg days, conversion rate)

**Used By:**
- `ProductPipeline.tsx` - Kanban for company_products
- `ProductCard.tsx` - Stage counts display

---

### Generation 3: Process Studio (Multi-Type)

**URL:** `/process`

**Components:**
- `src/app/(dashboard)/process/page.tsx`
- `src/components/process/ProcessStudio.tsx`
- `src/components/process/ProcessEditor.tsx`
- `src/components/process/ProcessScaffold.tsx`

**Data Model:**
```sql
product_processes {
  id UUID,
  product_id UUID,
  process_type ENUM('sales', 'onboarding', 'support', 'engagement'),
  version INTEGER,
  status ENUM('draft', 'published', 'archived'),
  name TEXT,
  description TEXT,
  config JSONB,
  created_by UUID,
  published_at TIMESTAMPTZ
}

product_process_stages {
  id UUID,
  process_id UUID,  -- FK to product_processes
  name TEXT,
  slug TEXT,
  stage_order INTEGER,
  description TEXT,
  goal TEXT,
  sla_days INTEGER,
  sla_warning_days INTEGER,
  is_terminal BOOLEAN,
  terminal_type TEXT,
  config JSONB  -- Type-specific fields
}
```

**Process Types:**
1. **Sales** - Same as Gen 2 but with versioning
2. **Onboarding** - Milestones with target_days
3. **Support** - Severity levels with SLA hours
4. **Engagement** - Health score bands with actions

**Features:**
- Multi-process type support
- Version control (draft/published/archived)
- Type-specific configurations
- Template-based quick setup
- Event-sourced lifecycle engine

**Event Sourcing:**
- `event_store` - Immutable event log
- `company_product_read_model` - Current state projection
- `company_product_stage_facts` - Analytics projection
- `product_pipeline_stage_counts` - Kanban optimization

---

### Generation 4: Visual Workflow Builder

**URL:** `/process/[slug]/[type]/builder`

**Components:**
- `src/app/(dashboard)/process/[productSlug]/[processType]/builder/page.tsx`
- `src/components/workflow/WorkflowBuilder.tsx`
- `src/components/workflow/WorkflowCanvas.tsx`
- `src/components/workflow/WorkflowNode.tsx`
- `src/components/workflow/WorkflowConnections.tsx`
- Config components for each node type

**Data Model:**
```sql
processes {
  id UUID,
  product_id UUID,
  process_type ENUM,
  name TEXT,
  status ENUM('draft', 'active', 'archived'),
  canvas_zoom NUMERIC,
  canvas_pan_x INTEGER,
  canvas_pan_y INTEGER
}

process_nodes {
  id UUID,
  process_id UUID,
  type ENUM('trigger', 'stage', 'condition', 'aiAction', 'humanAction', 'exit'),
  item_id TEXT,
  label TEXT,
  icon TEXT,
  color TEXT,
  position_x INTEGER,
  position_y INTEGER,
  config JSONB,
  stage_id UUID,  -- Links to product_process_stages
  node_order INTEGER
}

process_connections {
  id UUID,
  process_id UUID,
  from_node_id UUID,
  to_node_id UUID,
  from_port TEXT,
  to_port TEXT,
  label TEXT,
  color TEXT,
  style ENUM('solid', 'dashed'),
  condition JSONB,
  connection_order INTEGER
}
```

**Node Types:**
- **Trigger** (orange) - Entry points (new lead, inbound email, etc.)
- **Stage** (blue) - Process stages (links to product_process_stages)
- **Condition** (yellow) - Branching logic (if/else)
- **AI Action** (purple) - Automated tasks (send email, update CRM)
- **Human Action** (cyan) - Manual tasks (call, review)
- **Exit** (green) - Terminal states (won, lost, custom)

**Features:**
- Visual drag-and-drop canvas
- Node-based workflow design
- Conditional branching
- AI automation nodes
- Human task assignment

---

## Relationship Diagram

```
                          ┌─────────────────────────────────────┐
                          │           User Interfaces           │
                          └─────────────────────────────────────┘
                                           │
         ┌─────────────┬─────────────┬─────┴─────┬─────────────┐
         ▼             ▼             ▼           ▼             ▼
    ┌─────────┐  ┌───────────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐
    │ /deals  │  │/products/ │  │/process │  │/process/ │  │/products│
    │ (Gen 1) │  │[slug]/    │  │ (Gen 3) │  │[s]/[t]/  │  │/[slug]  │
    │         │  │process    │  │         │  │builder   │  │pipeline │
    │         │  │(Gen 2)    │  │         │  │(Gen 4)   │  │         │
    └────┬────┘  └─────┬─────┘  └────┬────┘  └────┬─────┘  └────┬────┘
         │             │             │            │             │
         ▼             ▼             ▼            ▼             ▼
    ┌─────────┐  ┌───────────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐
    │ deals   │  │product_   │  │product_ │  │processes │  │company_ │
    │ table   │  │sales_     │  │processes│  │process_  │  │products │
    │         │  │stages     │  │product_ │  │nodes     │  │         │
    │         │  │           │  │process_ │  │process_  │  │         │
    │         │  │           │  │stages   │  │connect.  │  │         │
    └─────────┘  └───────────┘  └─────────┘  └──────────┘  └─────────┘
         │             │             │            │             │
         └─────────────┴─────────────┴────────────┴─────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │    Event Store      │
                          │ (lifecycle events)  │
                          └─────────────────────┘
```

---

## Overlap Analysis

### Duplicate Concepts

| Concept | Gen 1 | Gen 2 | Gen 3 | Gen 4 |
|---------|-------|-------|-------|-------|
| Stage definition | Hardcoded | `product_sales_stages` | `product_process_stages` | `process_nodes` (type=stage) |
| Stage order | `order` field | `stage_order` | `stage_order` | `position_y` + `node_order` |
| Stage goals | N/A | `goal` | `goal` | `config.goal` |
| Exit criteria | N/A | `exit_criteria` | SLA fields | `config.exitCriteria` |
| AI automation | N/A | `ai_sequence_id` | Config | AI Action nodes |

### Table Redundancy

**Problem:** 3 tables for essentially the same thing:
1. `product_sales_stages` - Gen 2 (sales only)
2. `product_process_stages` - Gen 3 (multi-type)
3. `process_nodes` where type='stage' - Gen 4 (visual)

**Impact:**
- Data can get out of sync
- Different APIs for similar operations
- Confusion about source of truth

---

## Consolidation Recommendations

### Phase 1: Deprecate Gen 1 (Deals Page)

**Action:** Migrate `/deals` to use `company_products` instead of `deals` table

**Steps:**
1. Create migration script: `deals` → `company_products`
2. Update DealsView to query `company_products` with product filter
3. Use dynamic stages from `product_sales_stages` instead of `PIPELINE_STAGES`
4. Keep ConvertDealWizard for "won" deals → customer activation
5. Eventually redirect `/deals` to `/products?view=pipeline`

**Effort:** Medium (2-3 days)

### Phase 2: Unify Gen 2 & Gen 3 Stages

**Action:** Merge `product_sales_stages` into `product_process_stages`

**Steps:**
1. Add missing columns to `product_process_stages`:
   - `pitch_points`, `objection_handlers`, `resources`
   - `ai_suggested_*`, `ai_insights`
   - `avg_days_in_stage`, `conversion_rate`
2. Create migration: copy `product_sales_stages` → `product_process_stages`
3. Update ProvenProcessEditor to use new table
4. Update ProductPipeline to use new table
5. Deprecate `product_sales_stages`

**Effort:** Medium-High (3-4 days)

### Phase 3: Connect Workflow Builder to Unified Stages

**Action:** Make `process_nodes` reference unified `product_process_stages`

**Steps:**
1. Ensure all stage nodes have `stage_id` FK
2. When saving workflow, sync stage metadata to `product_process_stages`
3. When loading workflow, populate node labels from stages
4. Visual positions stored in `process_nodes`, config in stages

**Effort:** Medium (2-3 days)

### Phase 4: Single Entry Point

**Action:** Consolidate UI entry points

**Recommended Flow:**
```
/products/[slug] (Product Detail)
  └── "Manage Process" button
       └── /process/[slug] (Process Overview)
            ├── Sales tab → ProcessEditor OR WorkflowBuilder
            ├── Onboarding tab → ProcessEditor OR WorkflowBuilder
            ├── Support tab → ProcessEditor OR WorkflowBuilder
            └── Engagement tab → ProcessEditor OR WorkflowBuilder
```

**Changes:**
- Remove standalone `/process` landing page (merge into products)
- ProvenProcess becomes a mode within ProcessEditor
- WorkflowBuilder becomes "Advanced Mode" toggle

**Effort:** High (4-5 days)

---

## Implementation Order

| Order | Phase | Effort | Risk | Dependencies |
|-------|-------|--------|------|--------------|
| 1 | Phase 2: Unify Stages | 3-4 days | Medium | None |
| 2 | Phase 3: Connect Workflow | 2-3 days | Low | Phase 2 |
| 3 | Phase 1: Deprecate Deals | 2-3 days | Medium | Phase 2 |
| 4 | Phase 4: Single Entry | 4-5 days | Low | Phases 1-3 |

**Total Estimated Effort:** 11-15 days

---

## Files Affected

### To Modify
- `src/app/(dashboard)/deals/DealsView.tsx` - Use company_products
- `src/components/products/ProvenProcessEditor.tsx` - Use unified stages
- `src/components/products/ProductPipeline.tsx` - Use unified stages
- `src/app/api/process/[productSlug]/[processType]/route.ts` - Unified API
- `src/lib/lifecycle/` - Update stage references

### To Deprecate
- `src/types/index.ts` - Remove `PIPELINE_STAGES` constant
- Gen 2 specific APIs (merge into Gen 3)

### Database Migrations
- Add columns to `product_process_stages`
- Migrate `product_sales_stages` data
- Update FKs in `company_products`
- Eventually drop `product_sales_stages`

---

## Decision Points

Before starting consolidation, confirm:

1. **Keep Workflow Builder?**
   - Option A: Keep as "Advanced Mode" for power users
   - Option B: Remove and simplify to just stage editor

2. **Deals table fate?**
   - Option A: Migrate to company_products, drop deals
   - Option B: Keep deals for historical, freeze in place

3. **Process types scope?**
   - Option A: Support all 4 types (sales, onboarding, support, engagement)
   - Option B: Focus on sales first, defer others

---

## Conclusion

The X-FORCE process/pipeline system has grown organically through 4 generations. While each generation added valuable features, the lack of consolidation has created:

- **4 different stage storage mechanisms**
- **4 different editing UIs**
- **User confusion about where to configure**
- **Developer burden maintaining parallel systems**

The recommended consolidation path prioritizes data unification (Phase 2) first, then UI consolidation (Phase 4) last, minimizing risk while delivering incremental value.
