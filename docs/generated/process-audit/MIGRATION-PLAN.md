# Process Consolidation Migration Plan

## Overview

This document provides step-by-step instructions for consolidating the 4 generations of process/pipeline systems into a unified architecture.

---

## Pre-Migration Checklist

- [ ] Backup all process-related tables
- [ ] Document current data counts per table
- [ ] Identify any custom stage configurations
- [ ] Notify users of upcoming changes
- [ ] Set up feature flag for gradual rollout

---

## Phase 1: Database Schema Unification

### Step 1.1: Extend product_process_stages

Create migration file: `20260102_unify_process_stages.sql`

```sql
-- Add sales enablement fields to product_process_stages
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS pitch_points JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS objection_handlers JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_suggested_pitch_points JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_suggested_objections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS avg_days_in_stage NUMERIC,
ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC,
ADD COLUMN IF NOT EXISTS ai_sequence_id UUID,
ADD COLUMN IF NOT EXISTS ai_actions JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS exit_criteria TEXT,
ADD COLUMN IF NOT EXISTS exit_actions JSONB;

-- Add index for AI sequence lookup
CREATE INDEX IF NOT EXISTS idx_pps_ai_sequence
ON product_process_stages(ai_sequence_id)
WHERE ai_sequence_id IS NOT NULL;

COMMENT ON COLUMN product_process_stages.pitch_points IS 'Sales pitch points from Gen 2 ProvenProcess';
COMMENT ON COLUMN product_process_stages.objection_handlers IS 'Objection handling scripts';
```

### Step 1.2: Migrate product_sales_stages Data

Create migration file: `20260102_migrate_sales_stages.sql`

```sql
-- Create product_processes entries for products with sales stages
INSERT INTO product_processes (id, product_id, process_type, name, status, version)
SELECT
  gen_random_uuid(),
  product_id,
  'sales',
  'Sales Process',
  'published',
  1
FROM (
  SELECT DISTINCT product_id
  FROM product_sales_stages
) pss
WHERE NOT EXISTS (
  SELECT 1 FROM product_processes pp
  WHERE pp.product_id = pss.product_id AND pp.process_type = 'sales'
);

-- Migrate stages with all content
INSERT INTO product_process_stages (
  id, process_id, name, slug, stage_order, goal, description,
  sla_days, sla_warning_days, is_terminal, terminal_type,
  config, pitch_points, objection_handlers, resources,
  ai_suggested_pitch_points, ai_suggested_objections, ai_insights,
  avg_days_in_stage, conversion_rate, ai_sequence_id, ai_actions,
  exit_criteria, exit_actions, created_at, updated_at
)
SELECT
  pss.id,  -- Preserve original ID for FK references
  pp.id,
  pss.name,
  pss.slug,
  pss.stage_order,
  pss.goal,
  pss.description,
  NULL,  -- sla_days (not in original)
  NULL,  -- sla_warning_days
  pss.slug IN ('closed_won', 'closed_lost', 'churned'),  -- is_terminal
  CASE
    WHEN pss.slug = 'closed_won' THEN 'won'
    WHEN pss.slug = 'closed_lost' THEN 'lost'
    ELSE NULL
  END,  -- terminal_type
  '{}'::jsonb,  -- config
  COALESCE(pss.pitch_points, '[]'::jsonb),
  COALESCE(pss.objection_handlers, '[]'::jsonb),
  COALESCE(pss.resources, '[]'::jsonb),
  COALESCE(pss.ai_suggested_pitch_points, '[]'::jsonb),
  COALESCE(pss.ai_suggested_objections, '[]'::jsonb),
  COALESCE(pss.ai_insights, '{}'::jsonb),
  pss.avg_days_in_stage,
  pss.conversion_rate,
  pss.ai_sequence_id,
  COALESCE(pss.ai_actions, '[]'::jsonb),
  pss.exit_criteria,
  pss.exit_actions,
  pss.created_at,
  pss.updated_at
FROM product_sales_stages pss
JOIN product_processes pp ON pp.product_id = pss.product_id AND pp.process_type = 'sales'
ON CONFLICT (id) DO UPDATE SET
  pitch_points = EXCLUDED.pitch_points,
  objection_handlers = EXCLUDED.objection_handlers,
  resources = EXCLUDED.resources,
  ai_suggested_pitch_points = EXCLUDED.ai_suggested_pitch_points,
  ai_suggested_objections = EXCLUDED.ai_suggested_objections,
  ai_insights = EXCLUDED.ai_insights,
  avg_days_in_stage = EXCLUDED.avg_days_in_stage,
  conversion_rate = EXCLUDED.conversion_rate,
  ai_sequence_id = EXCLUDED.ai_sequence_id,
  ai_actions = EXCLUDED.ai_actions,
  exit_criteria = EXCLUDED.exit_criteria,
  exit_actions = EXCLUDED.exit_actions,
  updated_at = NOW();
```

### Step 1.3: Update Foreign Key References

```sql
-- Update process_nodes to reference unified stages
-- (Already has stage_id FK, just ensure it points correctly)

-- Verify no orphaned references
SELECT pn.id, pn.label, pn.stage_id
FROM process_nodes pn
LEFT JOIN product_process_stages pps ON pn.stage_id = pps.id
WHERE pn.stage_id IS NOT NULL AND pps.id IS NULL;
```

---

## Phase 2: API Consolidation

### Step 2.1: Create Unified Stage API

Create: `src/app/api/products/[slug]/process/[type]/route.ts`

```typescript
// GET - Fetch process with stages
// POST - Save stages (creates process if needed)
// Replaces:
// - GET/POST /api/process/[productSlug]/[processType]
// - Parts of GET /api/products/[slug] for stages
```

### Step 2.2: Update ProvenProcessEditor

Modify: `src/components/products/ProvenProcessEditor.tsx`

```typescript
// Change API endpoint from:
// /api/products/${product.slug}/stages
// To:
// /api/products/${product.slug}/process/sales

// Change data source from:
// product_sales_stages
// To:
// product_process_stages (via product_processes)
```

### Step 2.3: Update ProductPipeline

Modify: `src/components/products/ProductPipeline.tsx`

```typescript
// Change query from:
// product:products(..., stages:product_sales_stages(*))
// To:
// product:products(..., process:product_processes(..., stages:product_process_stages(*)))
```

---

## Phase 3: UI Route Consolidation

### Step 3.1: Update Navigation

Modify: `src/components/shared/Sidebar.tsx`

```typescript
// Remove standalone /process link
// Add process management under each product:
// /products/[slug] → "Manage Process" → /products/[slug]/process
```

### Step 3.2: Redirect Legacy Routes

Create: `src/app/(dashboard)/process/page.tsx`

```typescript
// Redirect /process to /products with process tab selected
import { redirect } from 'next/navigation';
export default function ProcessRedirect() {
  redirect('/products?view=process');
}
```

### Step 3.3: Merge ProvenProcess into ProcessEditor

Modify: `src/components/process/ProcessEditor.tsx`

```typescript
// Add sales-specific fields when processType === 'sales':
// - Pitch points
// - Objection handlers
// - Resources
// - AI analysis button
```

---

## Phase 4: Deals Migration

### Step 4.1: Create Deal → CompanyProduct Migration Script

Create: `scripts/migrate-deals-to-company-products.ts`

```typescript
// For each open deal:
// 1. Find or create company_product for company + product
// 2. Map deal.stage to product_process_stages.slug
// 3. Set current_stage_id, stage_entered_at
// 4. Copy owner, value, notes
// 5. Mark deal as migrated
```

### Step 4.2: Update DealsView

Modify: `src/app/(dashboard)/deals/DealsView.tsx`

```typescript
// Option A: Query company_products instead of deals
// Option B: Show both with migration banner

// Update KanbanBoard to use dynamic stages:
// - Fetch from product_process_stages
// - Group by product if multi-product view
```

### Step 4.3: Deprecation Notice

Add migration banner to /deals page:
"Deals are being migrated to the new Product Pipeline system. [Learn More]"

---

## Phase 5: Cleanup

### Step 5.1: Add Deprecation Markers

```typescript
// src/types/index.ts
/** @deprecated Use product_process_stages instead */
export const PIPELINE_STAGES = [...]

// src/components/products/ProvenProcessEditor.tsx
/** @deprecated Use ProcessEditor with processType='sales' */
```

### Step 5.2: Remove Legacy Tables (After Validation)

```sql
-- Only after confirming all data migrated and no references
-- DROP TABLE product_sales_stages;
-- This should be done in a separate, later migration
```

### Step 5.3: Remove Legacy Routes

```typescript
// After redirect has been in place for 30+ days:
// Remove: src/app/(dashboard)/process/page.tsx (original)
// Remove: src/app/(dashboard)/products/[slug]/process/page.tsx (ProvenProcess)
```

---

## Rollback Plan

### If Migration Fails

1. **Database**: Restore from backup taken in pre-migration
2. **Code**: Revert to previous deployment
3. **Data**: product_sales_stages preserved, no destructive changes in Phase 1-3

### Feature Flag Rollback

```typescript
// Use feature flag for gradual rollout
if (featureFlags.useUnifiedProcesses) {
  // New unified flow
} else {
  // Legacy flow
}
```

---

## Validation Checklist

### After Phase 1 (Database)
- [ ] All product_sales_stages rows exist in product_process_stages
- [ ] Pitch points, objection handlers preserved
- [ ] AI insights preserved
- [ ] No orphaned stage references

### After Phase 2 (API)
- [ ] ProvenProcessEditor saves to unified table
- [ ] ProductPipeline displays correct stages
- [ ] Stage changes emit lifecycle events

### After Phase 3 (UI)
- [ ] /process redirects correctly
- [ ] Process editor accessible from product page
- [ ] Workflow builder still functions

### After Phase 4 (Deals)
- [ ] Open deals migrated to company_products
- [ ] Pipeline view shows correct data
- [ ] No data loss in deal → company_product conversion

---

## Timeline

| Week | Phase | Tasks |
|------|-------|-------|
| 1 | Phase 1 | Database schema updates, data migration |
| 1-2 | Phase 2 | API consolidation, component updates |
| 2 | Phase 3 | UI route changes, redirects |
| 3 | Phase 4 | Deals migration (can run in parallel) |
| 4 | Phase 5 | Cleanup, deprecation, monitoring |

---

## Success Metrics

1. **Single Source of Truth**: All stages in `product_process_stages`
2. **Reduced Confusion**: One process editor UI
3. **Data Consistency**: No duplicate stage definitions
4. **Maintainability**: Single codepath for stage operations
