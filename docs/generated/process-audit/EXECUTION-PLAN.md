# Process Consolidation Execution Plan

> **Created:** 2026-01-01
> **Status:** READY FOR EXECUTION
> **Estimated Effort:** 11-15 days across 5 phases

---

## Executive Summary

This document provides a complete, step-by-step execution plan for consolidating the 4 generations of process/pipeline systems into a unified architecture. Each phase is self-contained with explicit validation steps.

### Key Decisions (Confirmed)

1. **Deals Migration:** Full migration to company_products (Option A)
2. **Process Studio Landing:** Keep as read-only dashboard (Option B)
3. **Workflow Builder:** Optional "Advanced Mode" toggle (Option B)
4. **Cross-product Pipeline:** Build unified view if needed (Option B)

### End State Summary

- **Single data layer:** `product_process_stages` for all stage definitions
- **Single editor UI:** ProcessEditor with tabs for each process type
- **Optional workflow:** "Advanced Mode" toggle for visual builder
- **Product-centric nav:** Process management accessed from product pages
- **Unified pipeline:** company_products replaces deals table

---

## Phase Overview

| Phase | Name | Effort | Risk | Description |
|-------|------|--------|------|-------------|
| 1 | Database Schema Unification | 2 days | Low | Add fields, migrate data, no breaking changes |
| 2 | API Consolidation | 2 days | Medium | Unified endpoints, backward compatible |
| 3 | Component Unification | 3 days | Medium | Merge editors, add Advanced Mode toggle |
| 4 | Deals Migration | 2 days | Medium | Convert deals → company_products |
| 5 | Route Consolidation & Cleanup | 2 days | Low | Redirects, deprecations, cleanup |

---

# PHASE 1: Database Schema Unification

## Objective
Extend `product_process_stages` to include all fields from `product_sales_stages`, then migrate existing data. No breaking changes - both tables work during this phase.

## Prerequisites
- [ ] Database backup completed
- [ ] Current row counts documented
- [ ] No active deployments in progress

---

### Step 1.1: Create Schema Migration

**File to create:** `supabase/migrations/20260102000001_unify_process_stages_schema.sql`

```sql
-- ============================================================================
-- PHASE 1.1: Extend product_process_stages with Gen 2 fields
-- ============================================================================
-- This migration adds sales enablement fields from product_sales_stages
-- to the unified product_process_stages table.
--
-- NO DATA IS MIGRATED HERE - just schema changes.
-- NO BREAKING CHANGES - existing queries continue to work.
-- ============================================================================

-- Add sales enablement content fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS pitch_points JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS objection_handlers JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '[]';

-- Add AI suggestion fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS ai_suggested_pitch_points JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_suggested_objections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT '{}';

-- Add metrics fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS avg_days_in_stage NUMERIC,
ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC;

-- Add automation fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS ai_sequence_id UUID,
ADD COLUMN IF NOT EXISTS ai_actions JSONB DEFAULT '[]';

-- Add exit fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS exit_criteria TEXT,
ADD COLUMN IF NOT EXISTS exit_actions JSONB;

-- Add index for AI sequence lookup
CREATE INDEX IF NOT EXISTS idx_product_process_stages_ai_sequence
ON product_process_stages(ai_sequence_id)
WHERE ai_sequence_id IS NOT NULL;

-- Document the columns
COMMENT ON COLUMN product_process_stages.pitch_points IS 'Array of pitch points: [{id, text, source, effectiveness_score}]';
COMMENT ON COLUMN product_process_stages.objection_handlers IS 'Array of objection handlers: [{id, objection, response, source}]';
COMMENT ON COLUMN product_process_stages.resources IS 'Array of resources: [{id, title, url, type}]';
COMMENT ON COLUMN product_process_stages.ai_suggested_pitch_points IS 'AI-generated pitch point suggestions';
COMMENT ON COLUMN product_process_stages.ai_suggested_objections IS 'AI-generated objection handling suggestions';
COMMENT ON COLUMN product_process_stages.ai_insights IS 'AI analysis insights: {last_analyzed, transcript_count, patterns}';
COMMENT ON COLUMN product_process_stages.avg_days_in_stage IS 'Average days companies spend in this stage';
COMMENT ON COLUMN product_process_stages.conversion_rate IS 'Percentage of companies that advance from this stage';
COMMENT ON COLUMN product_process_stages.ai_sequence_id IS 'FK to AI sequence for automated actions';
COMMENT ON COLUMN product_process_stages.ai_actions IS 'Array of AI actions: [{type, config, trigger}]';
COMMENT ON COLUMN product_process_stages.exit_criteria IS 'Human-readable exit criteria text';
COMMENT ON COLUMN product_process_stages.exit_actions IS 'Actions to execute on stage exit';
```

**Action:** Run migration via Supabase CLI or dashboard.

---

### Step 1.2: Create Data Migration Script

**File to create:** `scripts/migrate-sales-stages-to-unified.ts`

```typescript
/**
 * PHASE 1.2: Migrate product_sales_stages data to product_process_stages
 *
 * This script:
 * 1. Creates product_processes entries for products with sales stages (if missing)
 * 2. Copies all stage data including pitch points, objection handlers, etc.
 * 3. Preserves original IDs to maintain FK references
 * 4. Is idempotent - safe to run multiple times
 *
 * RUN: npx tsx scripts/migrate-sales-stages-to-unified.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('=== PHASE 1.2: Migrate Sales Stages to Unified Table ===\n');

  // Step 1: Get all products with sales stages
  const { data: salesStages, error: fetchError } = await supabase
    .from('product_sales_stages')
    .select('*, product:products(id, name, slug)')
    .order('product_id')
    .order('stage_order');

  if (fetchError) {
    console.error('Failed to fetch sales stages:', fetchError);
    process.exit(1);
  }

  console.log(`Found ${salesStages?.length || 0} sales stages to migrate\n`);

  if (!salesStages || salesStages.length === 0) {
    console.log('No sales stages to migrate. Done.');
    return;
  }

  // Step 2: Group by product
  const byProduct = new Map<string, typeof salesStages>();
  for (const stage of salesStages) {
    const productId = stage.product_id;
    if (!byProduct.has(productId)) {
      byProduct.set(productId, []);
    }
    byProduct.get(productId)!.push(stage);
  }

  console.log(`Migrating stages for ${byProduct.size} products\n`);

  // Step 3: Process each product
  for (const [productId, stages] of byProduct) {
    const productName = stages[0]?.product?.name || productId;
    console.log(`\n--- Product: ${productName} (${stages.length} stages) ---`);

    // 3a: Ensure product_processes entry exists
    const { data: existingProcess } = await supabase
      .from('product_processes')
      .select('id')
      .eq('product_id', productId)
      .eq('process_type', 'sales')
      .single();

    let processId: string;

    if (existingProcess) {
      processId = existingProcess.id;
      console.log(`  Using existing process: ${processId}`);
    } else {
      const { data: newProcess, error: createError } = await supabase
        .from('product_processes')
        .insert({
          product_id: productId,
          process_type: 'sales',
          name: 'Sales Process',
          status: 'published',
          version: 1,
        })
        .select('id')
        .single();

      if (createError) {
        console.error(`  Failed to create process:`, createError);
        continue;
      }

      processId = newProcess.id;
      console.log(`  Created new process: ${processId}`);
    }

    // 3b: Migrate each stage
    for (const stage of stages) {
      // Check if already migrated
      const { data: existing } = await supabase
        .from('product_process_stages')
        .select('id')
        .eq('id', stage.id)
        .single();

      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('product_process_stages')
          .update({
            pitch_points: stage.pitch_points || [],
            objection_handlers: stage.objection_handlers || [],
            resources: stage.resources || [],
            ai_suggested_pitch_points: stage.ai_suggested_pitch_points || [],
            ai_suggested_objections: stage.ai_suggested_objections || [],
            ai_insights: stage.ai_insights || {},
            avg_days_in_stage: stage.avg_days_in_stage,
            conversion_rate: stage.conversion_rate,
            ai_sequence_id: stage.ai_sequence_id,
            ai_actions: stage.ai_actions || [],
            exit_criteria: stage.exit_criteria,
            exit_actions: stage.exit_actions,
          })
          .eq('id', stage.id);

        if (updateError) {
          console.error(`  Failed to update stage ${stage.name}:`, updateError);
        } else {
          console.log(`  Updated: ${stage.name}`);
        }
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('product_process_stages')
          .insert({
            id: stage.id, // Preserve original ID
            process_id: processId,
            name: stage.name,
            slug: stage.slug,
            stage_order: stage.stage_order,
            goal: stage.goal,
            description: stage.description,
            is_terminal: ['closed_won', 'closed_lost', 'churned'].includes(stage.slug),
            terminal_type: stage.slug === 'closed_won' ? 'won' :
                          stage.slug === 'closed_lost' ? 'lost' : null,
            config: {},
            pitch_points: stage.pitch_points || [],
            objection_handlers: stage.objection_handlers || [],
            resources: stage.resources || [],
            ai_suggested_pitch_points: stage.ai_suggested_pitch_points || [],
            ai_suggested_objections: stage.ai_suggested_objections || [],
            ai_insights: stage.ai_insights || {},
            avg_days_in_stage: stage.avg_days_in_stage,
            conversion_rate: stage.conversion_rate,
            ai_sequence_id: stage.ai_sequence_id,
            ai_actions: stage.ai_actions || [],
            exit_criteria: stage.exit_criteria,
            exit_actions: stage.exit_actions,
          });

        if (insertError) {
          console.error(`  Failed to insert stage ${stage.name}:`, insertError);
        } else {
          console.log(`  Inserted: ${stage.name}`);
        }
      }
    }
  }

  console.log('\n=== Migration Complete ===');
}

migrate().catch(console.error);
```

**Action:** Run script after schema migration.

---

### Step 1.3: Validation

**File to create:** `scripts/validate-phase1-migration.ts`

```typescript
/**
 * PHASE 1 VALIDATION: Verify sales stages migration
 *
 * Checks:
 * 1. All product_sales_stages rows exist in product_process_stages
 * 2. Pitch points, objection handlers preserved
 * 3. AI insights preserved
 * 4. No orphaned references
 *
 * RUN: npx tsx scripts/validate-phase1-migration.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function validate() {
  console.log('=== PHASE 1 VALIDATION ===\n');
  let errors = 0;

  // Check 1: Row counts match
  const { count: salesCount } = await supabase
    .from('product_sales_stages')
    .select('*', { count: 'exact', head: true });

  const { count: unifiedSalesCount } = await supabase
    .from('product_process_stages')
    .select('*', { count: 'exact', head: true })
    .not('pitch_points', 'is', null);

  console.log(`product_sales_stages: ${salesCount} rows`);
  console.log(`product_process_stages (with pitch_points): ${unifiedSalesCount} rows`);

  if (salesCount !== unifiedSalesCount) {
    console.error(`❌ Row count mismatch!`);
    errors++;
  } else {
    console.log(`✅ Row counts match\n`);
  }

  // Check 2: Spot check content preservation
  const { data: sampleSales } = await supabase
    .from('product_sales_stages')
    .select('id, name, pitch_points, objection_handlers')
    .limit(5);

  for (const stage of sampleSales || []) {
    const { data: unified } = await supabase
      .from('product_process_stages')
      .select('id, name, pitch_points, objection_handlers')
      .eq('id', stage.id)
      .single();

    if (!unified) {
      console.error(`❌ Stage ${stage.name} (${stage.id}) not found in unified table`);
      errors++;
      continue;
    }

    const pitchMatch = JSON.stringify(stage.pitch_points) === JSON.stringify(unified.pitch_points);
    const objMatch = JSON.stringify(stage.objection_handlers) === JSON.stringify(unified.objection_handlers);

    if (!pitchMatch || !objMatch) {
      console.error(`❌ Stage ${stage.name}: content mismatch`);
      errors++;
    } else {
      console.log(`✅ Stage ${stage.name}: content preserved`);
    }
  }

  // Check 3: No orphaned company_products references
  const { data: orphaned } = await supabase
    .from('company_products')
    .select('id, current_stage_id')
    .not('current_stage_id', 'is', null);

  let orphanCount = 0;
  for (const cp of orphaned || []) {
    // Check if stage exists in either table
    const { data: inSales } = await supabase
      .from('product_sales_stages')
      .select('id')
      .eq('id', cp.current_stage_id)
      .single();

    const { data: inUnified } = await supabase
      .from('product_process_stages')
      .select('id')
      .eq('id', cp.current_stage_id)
      .single();

    if (!inSales && !inUnified) {
      orphanCount++;
    }
  }

  if (orphanCount > 0) {
    console.error(`\n❌ Found ${orphanCount} orphaned stage references`);
    errors++;
  } else {
    console.log(`\n✅ No orphaned stage references`);
  }

  // Summary
  console.log('\n=== VALIDATION SUMMARY ===');
  if (errors === 0) {
    console.log('✅ All checks passed! Phase 1 complete.');
  } else {
    console.error(`❌ ${errors} error(s) found. Please investigate before proceeding.`);
    process.exit(1);
  }
}

validate().catch(console.error);
```

**Action:** Run validation script. Must pass before proceeding to Phase 2.

---

## Phase 1 Checklist

- [ ] Backup database
- [ ] Run schema migration (Step 1.1)
- [ ] Run data migration script (Step 1.2)
- [ ] Run validation script (Step 1.3)
- [ ] Verify application still works (both old and new tables accessible)
- [ ] Document any issues

**Phase 1 Complete When:** Validation script passes with 0 errors.

---

# PHASE 2: API Consolidation

## Objective
Create unified API endpoints that read from `product_process_stages`. Maintain backward compatibility with existing endpoints during transition.

## Prerequisites
- [ ] Phase 1 validation passed
- [ ] No active deployments in progress

---

### Step 2.1: Create Unified Process API

**File to create:** `src/app/api/products/[slug]/process/[type]/route.ts`

```typescript
/**
 * Unified Process API
 *
 * GET - Fetch process with stages for a product/type
 * POST - Save stages (creates process if needed)
 *
 * Replaces:
 * - GET/POST /api/process/[productSlug]/[processType]
 * - Parts of /api/products/[slug]/stages
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

type ProcessType = 'sales' | 'onboarding' | 'support' | 'engagement';

interface RouteParams {
  params: Promise<{ slug: string; type: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug, type } = await params;

  if (!['sales', 'onboarding', 'support', 'engagement'].includes(type)) {
    return NextResponse.json({ error: 'Invalid process type' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get product
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, slug, color, icon')
    .eq('slug', slug)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Get process with stages
  const { data: process, error: processError } = await supabase
    .from('product_processes')
    .select(`
      id,
      process_type,
      name,
      status,
      version,
      config,
      stages:product_process_stages(
        id, name, slug, stage_order, goal, description,
        sla_days, sla_warning_days, is_terminal, terminal_type,
        config, pitch_points, objection_handlers, resources,
        ai_suggested_pitch_points, ai_suggested_objections, ai_insights,
        avg_days_in_stage, conversion_rate, ai_sequence_id, ai_actions,
        exit_criteria, exit_actions
      )
    `)
    .eq('product_id', product.id)
    .eq('process_type', type as ProcessType)
    .eq('status', 'published')
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (processError && processError.code !== 'PGRST116') {
    console.error('[Process API] Error:', processError);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  // Sort stages by order
  const stages = (process?.stages || []).sort(
    (a: { stage_order: number }, b: { stage_order: number }) =>
      a.stage_order - b.stage_order
  );

  return NextResponse.json({
    product,
    process: process ? {
      id: process.id,
      process_type: process.process_type,
      name: process.name,
      status: process.status,
      version: process.version,
      config: process.config,
    } : null,
    stages,
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { slug, type } = await params;

  if (!['sales', 'onboarding', 'support', 'engagement'].includes(type)) {
    return NextResponse.json({ error: 'Invalid process type' }, { status: 400 });
  }

  const supabaseClient = await createClient();
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await request.json();
  const { stages } = body;

  if (!Array.isArray(stages)) {
    return NextResponse.json({ error: 'stages must be an array' }, { status: 400 });
  }

  // Get product
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Get or create process
  let { data: process } = await supabase
    .from('product_processes')
    .select('id')
    .eq('product_id', product.id)
    .eq('process_type', type as ProcessType)
    .single();

  if (!process) {
    const { data: newProcess, error: createError } = await supabase
      .from('product_processes')
      .insert({
        product_id: product.id,
        process_type: type as ProcessType,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Process`,
        status: 'published',
        version: 1,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (createError) {
      console.error('[Process API] Create error:', createError);
      return NextResponse.json({ error: 'Failed to create process' }, { status: 500 });
    }

    process = newProcess;
  }

  // Delete existing stages
  await supabase
    .from('product_process_stages')
    .delete()
    .eq('process_id', process.id);

  // Insert new stages
  const stagesToInsert = stages.map((stage: Record<string, unknown>, index: number) => ({
    process_id: process.id,
    name: stage.name,
    slug: stage.slug || stage.name.toLowerCase().replace(/\s+/g, '_'),
    stage_order: index + 1,
    goal: stage.goal || null,
    description: stage.description || null,
    sla_days: stage.sla_days || null,
    sla_warning_days: stage.sla_warning_days || null,
    is_terminal: stage.is_terminal || false,
    terminal_type: stage.terminal_type || null,
    config: stage.config || {},
    pitch_points: stage.pitch_points || [],
    objection_handlers: stage.objection_handlers || [],
    resources: stage.resources || [],
    ai_suggested_pitch_points: stage.ai_suggested_pitch_points || [],
    ai_suggested_objections: stage.ai_suggested_objections || [],
    ai_insights: stage.ai_insights || {},
    avg_days_in_stage: stage.avg_days_in_stage || null,
    conversion_rate: stage.conversion_rate || null,
    ai_sequence_id: stage.ai_sequence_id || null,
    ai_actions: stage.ai_actions || [],
    exit_criteria: stage.exit_criteria || null,
    exit_actions: stage.exit_actions || null,
  }));

  const { data: insertedStages, error: insertError } = await supabase
    .from('product_process_stages')
    .insert(stagesToInsert)
    .select();

  if (insertError) {
    console.error('[Process API] Insert error:', insertError);
    return NextResponse.json({ error: 'Failed to save stages' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    process_id: process.id,
    stages: insertedStages,
  });
}
```

---

### Step 2.2: Create Unified Stages Query Helper

**File to create:** `src/lib/process/queries.ts`

```typescript
/**
 * Unified process/stage query helpers
 *
 * These functions provide consistent access to process stages
 * across all components, abstracting the underlying table structure.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type ProcessType = 'sales' | 'onboarding' | 'support' | 'engagement';

export interface ProcessStage {
  id: string;
  name: string;
  slug: string;
  stage_order: number;
  goal: string | null;
  description: string | null;
  sla_days: number | null;
  sla_warning_days: number | null;
  is_terminal: boolean;
  terminal_type: string | null;
  config: Record<string, unknown>;
  // Sales-specific fields
  pitch_points: Array<{ id: string; text: string; source?: string; effectiveness_score?: number }>;
  objection_handlers: Array<{ id: string; objection: string; response: string; source?: string }>;
  resources: Array<{ id: string; title: string; url: string; type: string }>;
  ai_suggested_pitch_points: unknown[];
  ai_suggested_objections: unknown[];
  ai_insights: Record<string, unknown>;
  avg_days_in_stage: number | null;
  conversion_rate: number | null;
  ai_sequence_id: string | null;
  ai_actions: unknown[];
  exit_criteria: string | null;
  exit_actions: unknown;
}

export interface ProcessWithStages {
  id: string;
  product_id: string;
  process_type: ProcessType;
  name: string;
  status: string;
  version: number;
  stages: ProcessStage[];
}

/**
 * Get published process with stages for a product
 */
export async function getProcessWithStages(
  supabase: SupabaseClient,
  productId: string,
  processType: ProcessType
): Promise<ProcessWithStages | null> {
  const { data, error } = await supabase
    .from('product_processes')
    .select(`
      id, product_id, process_type, name, status, version,
      stages:product_process_stages(*)
    `)
    .eq('product_id', productId)
    .eq('process_type', processType)
    .eq('status', 'published')
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    stages: (data.stages || []).sort(
      (a: ProcessStage, b: ProcessStage) => a.stage_order - b.stage_order
    ),
  } as ProcessWithStages;
}

/**
 * Get stages for a product's sales process
 * Convenience wrapper for ProductPipeline and similar components
 */
export async function getSalesStages(
  supabase: SupabaseClient,
  productId: string
): Promise<ProcessStage[]> {
  const process = await getProcessWithStages(supabase, productId, 'sales');
  return process?.stages || [];
}

/**
 * Get all process types configured for a product
 */
export async function getProductProcessTypes(
  supabase: SupabaseClient,
  productId: string
): Promise<ProcessType[]> {
  const { data } = await supabase
    .from('product_processes')
    .select('process_type')
    .eq('product_id', productId)
    .eq('status', 'published');

  return (data || []).map((p) => p.process_type as ProcessType);
}
```

---

### Step 2.3: Update ProvenProcessEditor API Calls

**File to modify:** `src/components/products/ProvenProcessEditor.tsx`

**Changes:**
1. Update save endpoint from `/api/products/${slug}/stages` to `/api/products/${slug}/process/sales`
2. Update data structure to match new API

```typescript
// Find and replace the save function
// OLD:
const response = await fetch(`/api/products/${product.slug}/stages`, {
  method: 'POST',
  body: JSON.stringify({ stages }),
});

// NEW:
const response = await fetch(`/api/products/${product.slug}/process/sales`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ stages }),
});
```

---

### Step 2.4: Update ProductPipeline Queries

**File to modify:** `src/components/products/ProductPipeline.tsx`

**Changes:**
1. Import query helper
2. Use `getSalesStages` instead of direct query

```typescript
// Add import
import { getSalesStages } from '@/lib/process/queries';

// Update stage fetching (find the query that selects product_sales_stages)
// Replace with:
const stages = await getSalesStages(supabase, product.id);
```

---

### Step 2.5: Validation

**File to create:** `scripts/validate-phase2-api.ts`

```typescript
/**
 * PHASE 2 VALIDATION: Verify API consolidation
 *
 * Tests:
 * 1. New unified API returns correct data
 * 2. ProvenProcessEditor still saves correctly
 * 3. ProductPipeline still displays correctly
 *
 * RUN: npx tsx scripts/validate-phase2-api.ts
 */

async function validate() {
  console.log('=== PHASE 2 VALIDATION ===\n');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let errors = 0;

  // Test 1: Fetch process via new API
  console.log('Test 1: Fetch process via unified API');
  try {
    const res = await fetch(`${baseUrl}/api/products/ai-agents/process/sales`);
    const data = await res.json();

    if (data.stages && data.stages.length > 0) {
      console.log(`✅ Fetched ${data.stages.length} stages for AI Agents`);

      // Check that sales-specific fields are present
      const hasContent = data.stages.some(
        (s: { pitch_points?: unknown[] }) => s.pitch_points && s.pitch_points.length > 0
      );
      if (hasContent) {
        console.log('✅ Pitch points preserved');
      } else {
        console.log('⚠️ No pitch points found (may be expected if none configured)');
      }
    } else {
      console.error('❌ No stages returned');
      errors++;
    }
  } catch (e) {
    console.error('❌ API call failed:', e);
    errors++;
  }

  // Test 2: Verify ProductPipeline page loads
  console.log('\nTest 2: ProductPipeline page');
  try {
    const res = await fetch(`${baseUrl}/products/ai-agents`);
    if (res.ok) {
      console.log('✅ Product page loads');
    } else {
      console.error('❌ Product page failed:', res.status);
      errors++;
    }
  } catch (e) {
    console.error('❌ Page load failed:', e);
    errors++;
  }

  // Summary
  console.log('\n=== VALIDATION SUMMARY ===');
  if (errors === 0) {
    console.log('✅ All checks passed! Phase 2 complete.');
  } else {
    console.error(`❌ ${errors} error(s) found.`);
    process.exit(1);
  }
}

validate().catch(console.error);
```

---

## Phase 2 Checklist

- [ ] Create unified API endpoint (Step 2.1)
- [ ] Create query helpers (Step 2.2)
- [ ] Update ProvenProcessEditor (Step 2.3)
- [ ] Update ProductPipeline (Step 2.4)
- [ ] Run validation script (Step 2.5)
- [ ] Manual test: Edit stages in ProvenProcessEditor, verify save works
- [ ] Manual test: View ProductPipeline, verify stages display correctly

**Phase 2 Complete When:** Validation script passes and manual tests confirm functionality.

---

# PHASE 3: Component Unification

## Objective
Merge ProvenProcessEditor and ProcessEditor into a single unified component with:
- Tabs for each process type
- Sales-specific fields (pitch points, objection handlers)
- "Advanced Mode" toggle for workflow builder

## Prerequisites
- [ ] Phase 2 validation passed
- [ ] Feature flag ready for gradual rollout

---

### Step 3.1: Create Unified Process Editor

**File to create:** `src/components/process/UnifiedProcessEditor.tsx`

This is a large component. Key features:
- Tabs: Sales | Onboarding | Support | Engagement
- Left panel: Stage list with drag-to-reorder
- Right panel: Stage detail form with type-specific fields
- "Advanced Mode" button → opens WorkflowBuilder
- Uses unified API from Phase 2

**Implementation notes:**
- Start from ProcessEditor.tsx as base
- Add pitch_points, objection_handlers, resources fields for sales
- Add AI analysis button for sales
- Keep SLA fields for onboarding/support
- Keep health band fields for engagement

---

### Step 3.2: Add Advanced Mode Toggle

**File to modify:** `src/components/process/UnifiedProcessEditor.tsx`

```typescript
// Add state for advanced mode
const [showAdvancedMode, setShowAdvancedMode] = useState(false);

// Add toggle button in header
<button
  onClick={() => setShowAdvancedMode(true)}
  className="text-sm text-blue-600 hover:text-blue-800"
>
  ⚡ Advanced Mode (Workflow Builder)
</button>

// Render workflow builder when in advanced mode
{showAdvancedMode && (
  <WorkflowBuilderModal
    productSlug={product.slug}
    processType={processType}
    onClose={() => setShowAdvancedMode(false)}
  />
)}
```

---

### Step 3.3: Create Process Editor Page

**File to create:** `src/app/(dashboard)/products/[slug]/process/page.tsx`

```typescript
/**
 * Unified Process Editor Page
 *
 * Replaces:
 * - /products/[slug]/process (ProvenProcess)
 * - /process/[slug] (Process Studio product view)
 */

import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { UnifiedProcessEditor } from '@/components/process/UnifiedProcessEditor';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function ProcessEditorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { type = 'sales' } = await searchParams;

  const supabase = await createClient();

  const { data: product } = await supabase
    .from('products')
    .select('id, name, slug, color, icon')
    .eq('slug', slug)
    .single();

  if (!product) notFound();

  return (
    <UnifiedProcessEditor
      product={product}
      initialProcessType={type as 'sales' | 'onboarding' | 'support' | 'engagement'}
    />
  );
}
```

---

### Step 3.4: Update Navigation Links

**Files to modify:**
- `src/components/products/ProductCard.tsx` - Update "Proven Process" link
- `src/components/process/ProcessStudio.tsx` - Update editor links

```typescript
// OLD:
href={`/products/${product.slug}/process`}

// NEW (same path, but now loads UnifiedProcessEditor):
href={`/products/${product.slug}/process`}

// For specific process type:
href={`/products/${product.slug}/process?type=onboarding`}
```

---

### Step 3.5: Validation

**Manual Testing Checklist:**

- [ ] Navigate to `/products/ai-agents/process`
- [ ] Verify tabs display: Sales, Onboarding, Support, Engagement
- [ ] Click Sales tab:
  - [ ] Stages display correctly
  - [ ] Can add/remove stages
  - [ ] Can edit pitch points
  - [ ] Can edit objection handlers
  - [ ] Can add resources
  - [ ] "AI Analyze" button works
  - [ ] Save works
- [ ] Click Onboarding tab:
  - [ ] Target days field visible
  - [ ] Milestone fields visible
- [ ] Click Support tab:
  - [ ] SLA hours fields visible
- [ ] Click Engagement tab:
  - [ ] Health score bands visible
- [ ] Click "Advanced Mode":
  - [ ] Workflow builder opens
  - [ ] Can add nodes
  - [ ] Can connect nodes
  - [ ] Close returns to simple mode

---

## Phase 3 Checklist

- [ ] Create UnifiedProcessEditor component (Step 3.1)
- [ ] Add Advanced Mode toggle (Step 3.2)
- [ ] Create new page route (Step 3.3)
- [ ] Update navigation links (Step 3.4)
- [ ] Complete manual testing checklist (Step 3.5)
- [ ] All process types save and load correctly

**Phase 3 Complete When:** All manual tests pass.

---

# PHASE 4: Deals Migration

## Objective
Migrate data from `deals` table to `company_products`. Update DealsView to use unified data model.

## Prerequisites
- [ ] Phase 3 complete
- [ ] Backup of deals table
- [ ] User communication about migration

---

### Step 4.1: Create Migration Script

**File to create:** `scripts/migrate-deals-to-company-products.ts`

```typescript
/**
 * PHASE 4: Migrate deals to company_products
 *
 * For each open deal:
 * 1. Find or create company_product for company + product
 * 2. Map deal.stage to product_process_stages
 * 3. Set current_stage_id, stage_entered_at
 * 4. Copy owner, value, notes to metadata
 * 5. Mark deal as migrated
 *
 * RUN: npx tsx scripts/migrate-deals-to-company-products.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Map legacy stage slugs to product_process_stages
const STAGE_MAPPING: Record<string, string> = {
  'new_lead': 'new_lead',
  'qualifying': 'qualifying',
  'discovery': 'discovery',
  'demo': 'demo',
  'data_review': 'data_review',
  'trial': 'trial',
  'negotiation': 'negotiation',
  'closed_won': 'closed_won',
  'closed_lost': 'closed_lost',
};

async function migrate() {
  console.log('=== PHASE 4: Migrate Deals to Company Products ===\n');

  // Get all open deals
  const { data: deals, error: fetchError } = await supabase
    .from('deals')
    .select(`
      *,
      company:companies(id, name),
      owner:users!deals_owner_id_fkey(id, name)
    `)
    .in('status', ['open', 'won']); // Migrate open and won deals

  if (fetchError) {
    console.error('Failed to fetch deals:', fetchError);
    process.exit(1);
  }

  console.log(`Found ${deals?.length || 0} deals to migrate\n`);

  if (!deals || deals.length === 0) {
    console.log('No deals to migrate. Done.');
    return;
  }

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const deal of deals) {
    console.log(`\nProcessing: ${deal.name} (${deal.company?.name || 'No company'})`);

    // Skip if no company
    if (!deal.company_id) {
      console.log('  ⚠️ Skipping: No company_id');
      skipped++;
      continue;
    }

    // Determine product ID from deal
    let productId: string | null = null;

    // Try primary_product_category_id first
    if (deal.primary_product_category_id) {
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('slug', deal.primary_product_category_id)
        .single();

      if (product) productId = product.id;
    }

    // Fallback to first sellable product
    if (!productId) {
      const { data: defaultProduct } = await supabase
        .from('products')
        .select('id')
        .eq('is_sellable', true)
        .limit(1)
        .single();

      if (defaultProduct) productId = defaultProduct.id;
    }

    if (!productId) {
      console.log('  ⚠️ Skipping: Could not determine product');
      skipped++;
      continue;
    }

    // Find stage in unified table
    const stageSlug = STAGE_MAPPING[deal.stage] || deal.stage;
    const { data: stage } = await supabase
      .from('product_process_stages')
      .select('id, process_id')
      .eq('slug', stageSlug)
      .limit(1)
      .single();

    // Check if company_product already exists
    const { data: existing } = await supabase
      .from('company_products')
      .select('id')
      .eq('company_id', deal.company_id)
      .eq('product_id', productId)
      .single();

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from('company_products')
        .update({
          current_stage_id: stage?.id || null,
          stage_entered_at: deal.updated_at || deal.created_at,
          owner_user_id: deal.owner_id,
          mrr: deal.mrr_estimate || deal.value,
          close_confidence: deal.close_confidence,
          status: deal.status === 'won' ? 'active' : 'in_sales',
          metadata: {
            migrated_from_deal: deal.id,
            deal_name: deal.name,
            deal_notes: deal.notes,
            expected_close_date: deal.expected_close_date,
          },
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('  ❌ Update failed:', updateError);
        errors++;
      } else {
        console.log('  ✅ Updated existing company_product');
        migrated++;
      }
    } else {
      // Create new
      const { error: insertError } = await supabase
        .from('company_products')
        .insert({
          company_id: deal.company_id,
          product_id: productId,
          current_stage_id: stage?.id || null,
          stage_entered_at: deal.updated_at || deal.created_at,
          owner_user_id: deal.owner_id,
          mrr: deal.mrr_estimate || deal.value,
          close_confidence: deal.close_confidence,
          status: deal.status === 'won' ? 'active' : 'in_sales',
          sales_started_at: deal.created_at,
          metadata: {
            migrated_from_deal: deal.id,
            deal_name: deal.name,
            deal_notes: deal.notes,
            expected_close_date: deal.expected_close_date,
          },
        });

      if (insertError) {
        console.error('  ❌ Insert failed:', insertError);
        errors++;
      } else {
        console.log('  ✅ Created new company_product');
        migrated++;
      }
    }

    // Mark deal as migrated
    await supabase
      .from('deals')
      .update({
        status: 'migrated',
        notes: `${deal.notes || ''}\n[Migrated to company_products on ${new Date().toISOString()}]`,
      })
      .eq('id', deal.id);
  }

  console.log('\n=== MIGRATION SUMMARY ===');
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

migrate().catch(console.error);
```

---

### Step 4.2: Update DealsView

**File to modify:** `src/app/(dashboard)/deals/DealsView.tsx`

Two options:

**Option A: Full replacement (Recommended)**
- DealsView queries company_products instead of deals
- Uses dynamic stages from product_process_stages
- Filters by status = 'in_sales'

**Option B: Parallel view**
- Show both migrated company_products and legacy deals
- Banner explaining migration
- Legacy deals are read-only

---

### Step 4.3: Add Expected Close Date to company_products

**File to create:** `supabase/migrations/20260103000001_company_products_close_date.sql`

```sql
-- Add expected_close_date to company_products
ALTER TABLE company_products
ADD COLUMN IF NOT EXISTS expected_close_date DATE;

COMMENT ON COLUMN company_products.expected_close_date IS 'Expected close date for sales opportunities';
```

---

### Step 4.4: Validation

**File to create:** `scripts/validate-phase4-deals.ts`

```typescript
/**
 * PHASE 4 VALIDATION: Verify deals migration
 */

async function validate() {
  console.log('=== PHASE 4 VALIDATION ===\n');
  let errors = 0;

  // Check 1: No open deals remaining
  const { count: openDeals } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open');

  if (openDeals && openDeals > 0) {
    console.error(`❌ ${openDeals} open deals not migrated`);
    errors++;
  } else {
    console.log('✅ All open deals migrated');
  }

  // Check 2: company_products have stage references
  const { data: noStage } = await supabase
    .from('company_products')
    .select('id')
    .eq('status', 'in_sales')
    .is('current_stage_id', null);

  if (noStage && noStage.length > 0) {
    console.error(`❌ ${noStage.length} company_products missing stage`);
    errors++;
  } else {
    console.log('✅ All in_sales company_products have stages');
  }

  // Check 3: DealsView page loads
  const res = await fetch(`${baseUrl}/deals`);
  if (res.ok) {
    console.log('✅ Deals page loads');
  } else {
    console.error('❌ Deals page failed');
    errors++;
  }

  // Summary
  if (errors === 0) {
    console.log('\n✅ Phase 4 complete!');
  } else {
    console.error(`\n❌ ${errors} error(s) found`);
    process.exit(1);
  }
}
```

---

## Phase 4 Checklist

- [ ] Add expected_close_date migration
- [ ] Create migration script (Step 4.1)
- [ ] Backup deals table
- [ ] Run migration script
- [ ] Update DealsView (Step 4.2)
- [ ] Run validation script (Step 4.4)
- [ ] Manual test: View deals page, verify data displays
- [ ] Manual test: Move company through stages, verify works

**Phase 4 Complete When:** Validation passes and deals page works with new data.

---

# PHASE 5: Route Consolidation & Cleanup

## Objective
- Consolidate navigation routes
- Add deprecation notices
- Clean up unused code
- Update Process Studio to dashboard mode

## Prerequisites
- [ ] Phases 1-4 complete
- [ ] All validations passed
- [ ] User communication complete

---

### Step 5.1: Update Process Studio to Dashboard

**File to modify:** `src/components/process/ProcessStudio.tsx`

Convert to read-only dashboard that links to individual product editors:
- Remove inline editing
- Show all products with process status
- Link to `/products/[slug]/process?type=X`

---

### Step 5.2: Add Route Redirects

**File to create:** `src/app/(dashboard)/process/[productSlug]/page.tsx`

```typescript
import { redirect } from 'next/navigation';

export default async function ProcessRedirect({
  params
}: {
  params: Promise<{ productSlug: string }>
}) {
  const { productSlug } = await params;
  redirect(`/products/${productSlug}/process`);
}
```

**File to create:** `src/app/(dashboard)/process/[productSlug]/[processType]/page.tsx`

```typescript
import { redirect } from 'next/navigation';

export default async function ProcessTypeRedirect({
  params
}: {
  params: Promise<{ productSlug: string; processType: string }>
}) {
  const { productSlug, processType } = await params;
  redirect(`/products/${productSlug}/process?type=${processType}`);
}
```

---

### Step 5.3: Update Sidebar Navigation

**File to modify:** `src/components/shared/Sidebar.tsx`

```typescript
// Remove or update the /process link
// OLD:
{ name: 'Process', href: '/process', icon: Workflow }

// NEW (optional - keep as dashboard):
{ name: 'Processes', href: '/process', icon: Workflow }
// Or remove entirely if accessed only via product pages
```

---

### Step 5.4: Add Deprecation Markers

**File to modify:** `src/types/index.ts`

```typescript
/**
 * @deprecated Use product_process_stages table instead.
 * These hardcoded stages are only kept for backward compatibility.
 * Will be removed in a future version.
 */
export const PIPELINE_STAGES: PipelineStage[] = [...]
```

**File to modify:** `src/components/products/ProvenProcessEditor.tsx`

```typescript
/**
 * @deprecated Use UnifiedProcessEditor instead.
 * This component is kept for backward compatibility during migration.
 *
 * Migration path:
 * - Import UnifiedProcessEditor from '@/components/process/UnifiedProcessEditor'
 * - Pass processType='sales' for equivalent functionality
 */
```

---

### Step 5.5: Final Validation

**Full System Test Checklist:**

- [ ] `/products` - Lists all products with stats
- [ ] `/products/[slug]` - Shows pipeline with correct stages
- [ ] `/products/[slug]/process` - Opens unified editor
- [ ] `/products/[slug]/process?type=sales` - Sales tab selected
- [ ] `/products/[slug]/process?type=onboarding` - Onboarding tab selected
- [ ] `/deals` - Shows company_products in pipeline view
- [ ] `/process` - Dashboard shows all products
- [ ] `/process/[slug]` - Redirects to `/products/[slug]/process`
- [ ] Workflow builder accessible via "Advanced Mode"
- [ ] Stage changes emit lifecycle events
- [ ] Event store has correct events

---

## Phase 5 Checklist

- [ ] Update ProcessStudio to dashboard mode
- [ ] Add route redirects
- [ ] Update sidebar navigation
- [ ] Add deprecation markers
- [ ] Complete full system test checklist
- [ ] Remove any dead code
- [ ] Update any remaining hardcoded stage references

**Phase 5 Complete When:** All routes work correctly and deprecation notices are in place.

---

# POST-MIGRATION

## Monitoring (First 2 Weeks)

1. **Error tracking:** Monitor for 500 errors on process-related pages
2. **Data integrity:** Daily check for orphaned stage references
3. **User feedback:** Track support tickets related to process changes

## Cleanup (After 30 Days)

- [ ] Remove deprecated ProvenProcessEditor (if no usage)
- [ ] Remove PIPELINE_STAGES constant (if no usage)
- [ ] Consider dropping product_sales_stages table (after full validation)
- [ ] Consider dropping deals table (after archiving)

## Documentation Updates

- [ ] Update CLAUDE.md with new architecture
- [ ] Update any API documentation
- [ ] Update user-facing help docs

---

# ROLLBACK PROCEDURES

## Phase 1 Rollback
- Restore database from pre-migration backup
- No code changes needed

## Phase 2 Rollback
- Revert API changes via git
- Old APIs still work (tables unchanged)

## Phase 3 Rollback
- Revert component changes via git
- Old components still work

## Phase 4 Rollback
- Update migrated deals: `status = 'open'`
- Revert DealsView changes

## Phase 5 Rollback
- Remove redirects
- Restore old navigation

---

# SUCCESS METRICS

1. **Single source of truth:** All stages in `product_process_stages`
2. **No duplicates:** `product_sales_stages` deprecated/empty
3. **Unified UX:** One editor at `/products/[slug]/process`
4. **No regressions:** All existing functionality works
5. **User satisfaction:** No increase in support tickets

---

# EXECUTION READY

This plan is ready for execution. Each phase is self-contained and can be paused/resumed as needed.

**To begin:** Start with Phase 1, Step 1.1 (Create Schema Migration)
