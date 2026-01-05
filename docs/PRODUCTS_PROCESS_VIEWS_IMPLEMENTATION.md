# Products Process Views - Implementation Guide

> **Location**: Place this file in `/docs/PRODUCTS_PROCESS_VIEWS_IMPLEMENTATION.md`
> **Reference Design**: `/docs/designs/products-pipeline-redesign/mockup-v5-minimal.html`

---

## Overview

This document provides complete implementation instructions for the Products Process Views feature. Claude Code should read this entire document before starting and reference it throughout implementation.

### Feature Summary
Replace the current Products page with a process-centric view allowing users to manage Sales, Onboarding, Customer Service, and Customer Engagement processes across multiple products.

### Key Capabilities
- Process tabs (Sales, Onboarding, Customer Service, Engagement)
- Multi-select filters (users, products, health status)
- Health-based Kanban columns (Needs Attention, Stalled, On Track)
- Side panel with item details and stage-specific actions
- Stage move modal with required notes
- URL state for shareable links

---

## Design System Requirements

**CRITICAL**: Follow these design rules exactly.

### Colors (Light Mode Only - NO dark: prefixes)
```
Background:     #f6f8fb
Panel/Card:     #ffffff
Primary Text:   #0b1220
Secondary Text: #667085
Border:         #e6eaf0
Primary Action: #3b82f6
Success:        #22c55e (minimal use)
Warning:        #f59e0b (minimal use)
Error:          #ef4444 (minimal use)
```

### Visual Philosophy
- **Minimal color** - White/gray backgrounds, color only for small status indicators
- **Status dots** - 6px colored dots, not colored backgrounds
- **Cards** - `bg-white rounded-xl border border-[#e6eaf0] shadow-sm`
- **Typography** - System font stack, text-sm (14px) default
- **Spacing** - 4-8 point grid (p-2, p-4, p-6, gap-4)

### What NOT to Do
- No colored column backgrounds
- No colored product badges (use gray)
- No zebra striping in tables
- No excessive bold text
- No emojis in buttons (only in tab labels)

---

## Implementation Phases

Execute phases in order. Complete all tasks and tests in each phase before proceeding.

---

## PHASE 1: Database Schema & Types

### Objective
Set up database schema extensions and TypeScript types.

### Tasks

#### 1.1 Explore Existing Schema
Use Postgres MCP to understand current structure:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%product%';

SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'company_products';

SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'products';
```

#### 1.2 Create Migration
File: `supabase/migrations/[timestamp]_add_process_views.sql`

```sql
-- Add tracking fields to company_products if not exist
ALTER TABLE company_products 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_stage_moved_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for process queries
CREATE INDEX IF NOT EXISTS idx_cp_process_query 
ON company_products(product_id, status, owner_id) 
WHERE status IN ('in_sales', 'in_onboarding', 'active');

-- Create view for pipeline items with computed health
CREATE OR REPLACE VIEW product_pipeline_items AS
SELECT 
  cp.id,
  cp.company_id,
  c.name as company_name,
  c.company_type,
  cp.product_id,
  p.name as product_name,
  p.color as product_color,
  p.icon as product_icon,
  cp.status,
  cp.current_stage_id,
  ps.name as stage_name,
  ps.order_index as stage_order,
  cp.owner_id,
  pr.name as owner_name,
  pr.initials as owner_initials,
  cp.mrr,
  cp.created_at,
  cp.updated_at,
  cp.last_activity_at,
  cp.last_stage_moved_at,
  EXTRACT(DAY FROM NOW() - COALESCE(cp.last_stage_moved_at, cp.created_at))::INTEGER as days_in_stage,
  CASE 
    WHEN EXTRACT(DAY FROM NOW() - COALESCE(cp.last_activity_at, cp.created_at)) > 14 THEN 'attention'
    WHEN EXTRACT(DAY FROM NOW() - COALESCE(cp.last_stage_moved_at, cp.created_at)) >= 30 THEN 'stalled'
    ELSE 'healthy'
  END as health_status,
  CASE 
    WHEN EXTRACT(DAY FROM NOW() - COALESCE(cp.last_activity_at, cp.created_at)) > 14 
      THEN 'No activity ' || EXTRACT(DAY FROM NOW() - COALESCE(cp.last_activity_at, cp.created_at))::INTEGER || 'd'
    WHEN EXTRACT(DAY FROM NOW() - COALESCE(cp.last_stage_moved_at, cp.created_at)) >= 30 
      THEN 'Stalled ' || EXTRACT(DAY FROM NOW() - COALESCE(cp.last_stage_moved_at, cp.created_at))::INTEGER || 'd'
    ELSE NULL
  END as health_reason
FROM company_products cp
JOIN companies c ON c.id = cp.company_id
JOIN products p ON p.id = cp.product_id
LEFT JOIN product_sales_stages ps ON ps.id = cp.current_stage_id
LEFT JOIN profiles pr ON pr.id = cp.owner_id
WHERE cp.status IN ('in_sales', 'in_onboarding', 'active');
```

#### 1.3 Create TypeScript Types
File: `src/types/products.ts`

```typescript
export type ProcessType = 'sales' | 'onboarding' | 'customer_service' | 'engagement';
export type HealthStatus = 'healthy' | 'attention' | 'stalled';
export type ViewMode = 'all' | 'stage' | 'company';

export interface ProcessDefinition {
  id: ProcessType;
  name: string;
  icon: string;
  description: string;
}

export const PROCESSES: Record<ProcessType, ProcessDefinition> = {
  sales: {
    id: 'sales',
    name: 'Sales',
    icon: '🎯',
    description: 'Track prospects through your sales process',
  },
  onboarding: {
    id: 'onboarding',
    name: 'Onboarding',
    icon: '🚀',
    description: 'Get new customers up and running',
  },
  customer_service: {
    id: 'customer_service',
    name: 'Customer Service',
    icon: '🛟',
    description: 'Handle customer issues and requests',
  },
  engagement: {
    id: 'engagement',
    name: 'Engagement',
    icon: '💚',
    description: 'Retention, upsells, and customer success',
  },
};

export interface PipelineItem {
  id: string;
  company_id: string;
  company_name: string;
  company_type: string | null;
  product_id: string;
  product_name: string;
  product_color: string | null;
  product_icon: string | null;
  status: string;
  current_stage_id: string | null;
  stage_name: string | null;
  stage_order: number | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_initials: string | null;
  mrr: number | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string | null;
  last_stage_moved_at: string | null;
  days_in_stage: number;
  health_status: HealthStatus;
  health_reason: string | null;
}

export interface ProcessStats {
  total: number;
  needsAttention: number;
  stalled: number;
  healthy: number;
  totalMrr: number;
  productCount: number;
}

export interface StageDefinition {
  id: string;
  name: string;
  order_index: number;
}

export interface ProcessViewResponse {
  items: PipelineItem[];
  stats: ProcessStats;
  stages: StageDefinition[];
}
```

#### 1.4 Apply Migration
```bash
npx supabase db push
```

### Tests

**Test 1** - Verify view exists (Postgres MCP):
```sql
SELECT * FROM product_pipeline_items LIMIT 5;
```

**Test 2** - Verify health calculation:
```sql
SELECT health_status, COUNT(*) FROM product_pipeline_items GROUP BY health_status;
```

**Test 3** - TypeScript compilation:
```bash
npx tsc --noEmit
```

### Completion Checklist
- [ ] Migration file created and applied
- [ ] TypeScript types created
- [ ] View returns data with health_status
- [ ] No TypeScript errors

### Git Commit
```bash
git add -A
git commit -m "feat(products): add database schema and types for process views"
```

---

## PHASE 2: API Routes

### Objective
Create API endpoints for fetching process data and moving stages.

### Tasks

#### 2.1 Process Pipeline API
File: `src/app/api/products/process/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProcessType, ProcessStats, ProcessViewResponse } from '@/types/products';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  
  const { searchParams } = new URL(request.url);
  const process = (searchParams.get('process') || 'sales') as ProcessType;
  const products = searchParams.get('products')?.split(',').filter(Boolean) || [];
  const users = searchParams.get('users')?.split(',').filter(Boolean) || [];
  const health = searchParams.get('health') || 'all';
  const search = searchParams.get('search') || '';

  try {
    const statusMap: Record<ProcessType, string[]> = {
      sales: ['in_sales'],
      onboarding: ['in_onboarding'],
      customer_service: ['active'],
      engagement: ['active'],
    };
    
    const statuses = statusMap[process] || ['in_sales'];

    let query = supabase
      .from('product_pipeline_items')
      .select('*')
      .in('status', statuses);

    if (products.length > 0) query = query.in('product_id', products);
    if (users.length > 0) query = query.in('owner_id', users);
    if (health && health !== 'all') query = query.eq('health_status', health);
    if (search) query = query.ilike('company_name', `%${search}%`);

    const { data: items, error } = await query.order('days_in_stage', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stats: ProcessStats = {
      total: items?.length || 0,
      needsAttention: items?.filter(i => i.health_status === 'attention').length || 0,
      stalled: items?.filter(i => i.health_status === 'stalled').length || 0,
      healthy: items?.filter(i => i.health_status === 'healthy').length || 0,
      totalMrr: items?.reduce((sum, i) => sum + (i.mrr || 0), 0) || 0,
      productCount: new Set(items?.map(i => i.product_id)).size,
    };

    const { data: stages } = await supabase
      .from('product_sales_stages')
      .select('id, name, order_index')
      .order('order_index');

    return NextResponse.json({ items: items || [], stats, stages: stages || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch process data' }, { status: 500 });
  }
}
```

#### 2.2 Process Stats API
File: `src/app/api/products/process/stats/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProcessType } from '@/types/products';

export async function GET() {
  const supabase = await createClient();

  try {
    const processes: ProcessType[] = ['sales', 'onboarding', 'customer_service', 'engagement'];
    const statusMap: Record<ProcessType, string[]> = {
      sales: ['in_sales'],
      onboarding: ['in_onboarding'],
      customer_service: ['active'],
      engagement: ['active'],
    };

    const results = [];

    for (const process of processes) {
      const { data } = await supabase
        .from('product_pipeline_items')
        .select('health_status')
        .in('status', statusMap[process]);

      results.push({
        process,
        total: data?.length || 0,
        needsAttention: data?.filter(i => i.health_status !== 'healthy').length || 0,
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch process stats' }, { status: 500 });
  }
}
```

#### 2.3 Stage Move API
File: `src/app/api/products/process/move-stage/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const { item_id, to_stage_id, note } = await request.json();

    if (!item_id || !to_stage_id || !note || note.trim().length < 10) {
      return NextResponse.json(
        { error: 'item_id, to_stage_id, and note (min 10 chars) are required' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentItem } = await supabase
      .from('company_products')
      .select('id, current_stage_id, company_id')
      .eq('id', item_id)
      .single();

    if (!currentItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('company_products')
      .update({
        current_stage_id: to_stage_id,
        last_stage_moved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item_id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 });
    }

    await supabase.from('activities').insert({
      company_id: currentItem.company_id,
      user_id: user.id,
      type: 'stage_change',
      description: note,
      metadata: { company_product_id: item_id, from_stage_id: currentItem.current_stage_id, to_stage_id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to move stage' }, { status: 500 });
  }
}
```

#### 2.4 Products List API
File: `src/app/api/products/list/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, color, icon')
    .eq('is_active', true)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
```

#### 2.5 Users List API
File: `src/app/api/products/users/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, initials, role')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
```

### Tests

**Test 1** - API Response:
```bash
curl "http://localhost:3000/api/products/process?process=sales" | jq
curl "http://localhost:3000/api/products/process/stats" | jq
curl "http://localhost:3000/api/products/list" | jq
```

**Test 2** - Verify filters work:
```bash
curl "http://localhost:3000/api/products/process?process=sales&health=attention" | jq
```

### Completion Checklist
- [ ] All 5 API routes created
- [ ] Routes return expected data format
- [ ] Error handling works
- [ ] No TypeScript errors

### Git Commit
```bash
git add -A
git commit -m "feat(products): add API routes for process views"
```

---

## PHASE 3: Process Tabs & Header

### Objective
Create the main page layout with process tabs and header stats.

### Tasks

#### 3.1 Create Page
File: `src/app/(dashboard)/products/process/page.tsx`

```typescript
import { Suspense } from 'react';
import { ProcessViewContainer } from '@/components/products/ProcessViewContainer';
import { ProcessViewSkeleton } from '@/components/products/ProcessViewSkeleton';

export const metadata = { title: 'Products Process | X-FORCE' };

export default function ProductsProcessPage() {
  return (
    <Suspense fallback={<ProcessViewSkeleton />}>
      <ProcessViewContainer />
    </Suspense>
  );
}
```

#### 3.2 Create ProcessViewContainer
File: `src/components/products/ProcessViewContainer.tsx`

This is the main container that manages state and renders all child components. Create a client component that:
- Uses `useSearchParams` for URL state
- Fetches data from APIs
- Manages filter state
- Handles item selection and stage moves
- Renders: ProcessTabs, ProcessHeader, ProcessFilters, ProcessViewControls, ProcessKanban, ProcessSidePanel, StageMoveModal

#### 3.3 Create ProcessTabs
File: `src/components/products/ProcessTabs.tsx`

```typescript
'use client';

import { ProcessType, PROCESSES } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessTabsProps {
  activeProcess: ProcessType;
  processStats: Array<{ process: ProcessType; total: number; needsAttention: number }>;
  onProcessChange: (process: ProcessType) => void;
}

export function ProcessTabs({ activeProcess, processStats, onProcessChange }: ProcessTabsProps) {
  return (
    <div className="bg-white border-b border-[#e6eaf0] px-6">
      <div className="flex gap-1">
        {Object.values(PROCESSES).map((process) => {
          const stats = processStats.find(s => s.process === process.id) || { total: 0, needsAttention: 0 };
          const isActive = activeProcess === process.id;

          return (
            <button
              key={process.id}
              onClick={() => onProcessChange(process.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'text-[#0b1220] border-[#0b1220]'
                  : 'text-[#667085] border-transparent hover:text-[#0b1220]'
              )}
            >
              <span className="text-base">{process.icon}</span>
              <span>{process.name}</span>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-semibold',
                isActive ? 'bg-[#0b1220] text-white' : 'bg-[#eef2f7] text-[#667085]'
              )}>
                {stats.total}
              </span>
              {stats.needsAttention > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

#### 3.4 Create ProcessHeader
File: `src/components/products/ProcessHeader.tsx`

Create header with:
- Process icon and title
- Process description
- 4 stat cards: Total Items, Need Attention (amber if >0), MRR (green), Products

#### 3.5 Create ProcessViewSkeleton
File: `src/components/products/ProcessViewSkeleton.tsx`

Loading skeleton matching the layout structure.

### Tests (Playwright MCP)

```typescript
await page.goto('http://localhost:3000/products/process');
await page.waitForSelector('text=Sales');
await page.screenshot({ path: 'phase3-tabs.png' });

// Test tab switching
await page.click('text=Onboarding');
await page.waitForURL('**/process?process=onboarding');
```

### Completion Checklist
- [ ] Page renders without errors
- [ ] Four process tabs visible with counts
- [ ] Tab clicks update URL
- [ ] Header shows stats
- [ ] Skeleton shows during loading

### Git Commit
```bash
git add -A
git commit -m "feat(products): add process tabs and header components"
```

---

## PHASE 4: Filter Components

### Objective
Create multi-select filters and view controls.

### Tasks

#### 4.1 Create ProcessFilters
File: `src/components/products/ProcessFilters.tsx`

Components:
- User dropdown with multi-select checkboxes and "My Items Only" button
- Product dropdown with multi-select checkboxes
- Health select dropdown
- Search input with debounce (300ms)
- "Needs Attention" quick filter button

Key behaviors:
- Dropdowns close on outside click
- Filters update URL via `updateParams`
- Active filters show blue border

#### 4.2 Create ProcessViewControls
File: `src/components/products/ProcessViewControls.tsx`

- View mode tabs: All Items, By Stage, By Company
- Display toggle: Kanban / List (Kanban active by default)

### Tests (Playwright MCP)

```typescript
// Test user dropdown
await page.click('text=All Users');
await page.waitForSelector('text=Team Members');
await page.screenshot({ path: 'phase4-user-dropdown.png' });

// Test search
await page.fill('input[placeholder="Search companies..."]', 'Spring');
await page.waitForTimeout(400);
// Verify URL contains search param
```

### Completion Checklist
- [ ] User dropdown opens/closes correctly
- [ ] Product dropdown opens/closes correctly
- [ ] Multi-select works for both
- [ ] Search debounces and updates URL
- [ ] Quick filter toggles
- [ ] View mode tabs work

### Git Commit
```bash
git add -A
git commit -m "feat(products): add filter components"
```

---

## PHASE 5: Kanban View

### Objective
Create health-based Kanban board with cards.

### Tasks

#### 5.1 Create ProcessKanban
File: `src/components/products/ProcessKanban.tsx`

Three columns:
- "⚠️ Needs Attention" - items where health_status = 'attention'
- "🔴 Stalled 30d+" - items where health_status = 'stalled'
- "✓ On Track" - items where health_status = 'healthy'

Column styling:
- White header with border-b
- Gray body (#f6f8fb)
- Count badge in header

#### 5.2 Create ProcessCard
File: `src/components/products/ProcessCard.tsx`

Card content:
- Company name (font-semibold, line-clamp-2)
- Product badge (gray background, not colored)
- Stage name
- Health reason with small colored dot (if present)
- Footer: days (colored if >=14 amber, >=30 red), MRR, owner avatar

Card styling:
- `bg-white rounded-lg border border-[#e6eaf0] p-3.5`
- `hover:shadow-lg hover:-translate-y-0.5 transition-all`
- `cursor-pointer`

#### 5.3 Create ProcessEmptyState
File: `src/components/products/ProcessEmptyState.tsx`

### Tests (Playwright MCP)

```typescript
await page.goto('http://localhost:3000/products/process');
await page.waitForSelector('.grid-cols-3');
await page.screenshot({ path: 'phase5-kanban.png', fullPage: true });

// Verify cards exist
const cards = await page.locator('.cursor-pointer.rounded-lg').count();
console.log('Card count:', cards);
```

### Completion Checklist
- [ ] 3 columns render
- [ ] Items grouped by health correctly
- [ ] Cards show all required data
- [ ] Hover effect works
- [ ] Empty state shows when no items

### Git Commit
```bash
git add -A
git commit -m "feat(products): add kanban view components"
```

---

## PHASE 6: Side Panel

### Objective
Create slide-in detail panel.

### Tasks

#### 6.1 Create ProcessSidePanel
File: `src/components/products/ProcessSidePanel.tsx`

Structure:
- Fixed overlay with backdrop
- 480px white panel from right
- Slide-in animation

Content:
- Header: Company name, close button, product badge, stage
- Health alert banner (if applicable)
- Stats grid: Days in Stage, MRR, Owner
- Quick Actions (stage-specific buttons)
- Stage selector buttons (current highlighted in blue)
- Assigned To dropdown
- Footer: Log Activity (primary), Add Task (secondary), More menu

Close behaviors:
- X button click
- Escape key
- Backdrop click

#### 6.2 Add Animation
File: `src/app/globals.css`

```css
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.animate-slide-in-right {
  animation: slide-in-right 0.2s ease-out;
}
```

### Tests (Playwright MCP)

```typescript
await page.click('.cursor-pointer.rounded-lg');
await page.waitForSelector('.w-\\[480px\\]');
await page.screenshot({ path: 'phase6-panel.png' });

// Test close
await page.keyboard.press('Escape');
const panelVisible = await page.locator('.w-\\[480px\\]').isVisible();
console.log('Panel closed:', !panelVisible);
```

### Completion Checklist
- [ ] Panel opens on card click
- [ ] All sections display correctly
- [ ] Stage buttons highlight current stage
- [ ] Close via X, Escape, backdrop all work
- [ ] Animation smooth

### Git Commit
```bash
git add -A
git commit -m "feat(products): add side panel component"
```

---

## PHASE 7: Stage Move Modal

### Objective
Create modal for stage transitions with required notes.

### Tasks

#### 7.1 Create StageMoveModal
File: `src/components/products/StageMoveModal.tsx`

Content:
- Modal overlay with backdrop
- Title: "Move to New Stage"
- Info box: Company name, From → To stages
- Textarea for note (required, min 10 chars)
- Validation error display
- Cancel and "Move & Save Note" buttons

Behaviors:
- Focus textarea on open
- Validate on submit
- Show loading state during API call
- Close on success and refresh data
- Close via Cancel, Escape, backdrop

### Tests (Playwright MCP)

```typescript
// Open panel, click stage
await page.click('.cursor-pointer.rounded-lg');
await page.waitForSelector('.w-\\[480px\\]');
await page.locator('.bg-\\[\\#f6f8fb\\].rounded-md').first().click();
await page.waitForSelector('text=Move to New Stage');
await page.screenshot({ path: 'phase7-modal.png' });

// Test validation
await page.click('text=Move & Save Note');
const error = await page.locator('text=Please enter a note').isVisible();
console.log('Validation works:', error);
```

### Completion Checklist
- [ ] Modal opens on stage click
- [ ] Shows correct from/to stages
- [ ] Validation works (empty, too short)
- [ ] API called on valid submit
- [ ] Data refreshes after move
- [ ] All close methods work

### Git Commit
```bash
git add -A
git commit -m "feat(products): add stage move modal with validation"
```

---

## PHASE 8: Integration & Polish

### Objective
Final testing, bug fixes, and production readiness.

### Tasks

#### 8.1 Full Integration Test
Run complete user journey via Playwright MCP:
1. Page loads
2. Switch process tabs
3. Use all filters
4. Click card → panel opens
5. Click stage → modal opens
6. Submit stage move
7. Verify data refreshes

#### 8.2 Fix Any Issues
Common fixes:
- Loading state flicker (add minimum load time)
- URL state sync on mount
- Body scroll lock when panel open

#### 8.3 Add Error Boundary
Wrap page in error boundary with refresh button.

#### 8.4 Performance Optimization
- Add `React.memo` to ProcessCard
- Memoize expensive calculations

#### 8.5 Accessibility
- Add `role="button"`, `tabIndex`, `aria-labels`
- Keyboard navigation for cards

#### 8.6 Visual Review
Screenshot all states and compare with mockup.

### Final Verification

```bash
# TypeScript
npx tsc --noEmit

# Build
npm run build

# No console errors in browser
```

### Completion Checklist
- [ ] Full user journey works
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Build succeeds
- [ ] Matches mockup design

### Git Commit
```bash
git add -A
git commit -m "feat(products): complete process views implementation"
```

---

## File Structure Summary

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── products/
│   │       └── process/
│   │           └── page.tsx
│   └── api/
│       └── products/
│           ├── process/
│           │   ├── route.ts
│           │   ├── stats/route.ts
│           │   └── move-stage/route.ts
│           ├── list/route.ts
│           └── users/route.ts
├── components/
│   └── products/
│       ├── index.ts
│       ├── ProcessViewContainer.tsx
│       ├── ProcessTabs.tsx
│       ├── ProcessHeader.tsx
│       ├── ProcessFilters.tsx
│       ├── ProcessViewControls.tsx
│       ├── ProcessKanban.tsx
│       ├── ProcessCard.tsx
│       ├── ProcessSidePanel.tsx
│       ├── StageMoveModal.tsx
│       ├── ProcessEmptyState.tsx
│       └── ProcessViewSkeleton.tsx
└── types/
    └── products.ts

supabase/
└── migrations/
    └── [timestamp]_add_process_views.sql
```

---

## Troubleshooting

### API returns 500
- Check server logs
- Test SQL query in Postgres MCP
- Verify Supabase client setup

### Components not rendering
- Check imports
- Run `npx tsc --noEmit`
- Check browser console

### Styles look wrong
- Verify Tailwind classes
- Check for dark: prefixes (remove them)
- Compare with mockup

### Filters not working
- Check URL updates
- Verify API receives params
- Check useSearchParams usage
