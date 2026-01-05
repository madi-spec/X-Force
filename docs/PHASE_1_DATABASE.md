# PHASE 1: Database Schema & Types

## Objective
Set up the database schema extensions and TypeScript types needed for the Products Process Views feature.

## Pre-Phase Checklist
- [ ] Read CLAUDE.md for project conventions
- [ ] Review existing types in `src/types/index.ts`
- [ ] Check existing product-related tables using Postgres MCP

## Tasks

### 1.1 Explore Existing Schema
```sql
-- Run these queries using Postgres MCP to understand current schema
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%product%';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'company_products';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'product_sales_stages';
```

### 1.2 Create Migration File
Create file: `supabase/migrations/[timestamp]_add_process_views.sql`

```sql
-- Process types enum (if not exists)
DO $$ BEGIN
  CREATE TYPE process_type AS ENUM ('sales', 'onboarding', 'customer_service', 'engagement');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add process-specific stage tables if they don't exist
CREATE TABLE IF NOT EXISTS product_onboarding_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, name)
);

CREATE TABLE IF NOT EXISTS product_service_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, name)
);

CREATE TABLE IF NOT EXISTS product_engagement_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, name)
);

-- Add health calculation fields to company_products if not exist
ALTER TABLE company_products 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_stage_moved_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for process queries
CREATE INDEX IF NOT EXISTS idx_cp_process_query 
ON company_products(product_id, status, owner_id) 
WHERE status IN ('in_sales', 'in_onboarding', 'active');

CREATE INDEX IF NOT EXISTS idx_cp_company_query 
ON company_products(company_id, status);

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

### 1.3 Create TypeScript Types
Create or update file: `src/types/products.ts`

```typescript
// Process Types
export type ProcessType = 'sales' | 'onboarding' | 'customer_service' | 'engagement';

export type HealthStatus = 'healthy' | 'attention' | 'stalled';

export type ViewMode = 'all' | 'stage' | 'company';

// Process Definition
export interface ProcessDefinition {
  id: ProcessType;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export const PROCESSES: Record<ProcessType, ProcessDefinition> = {
  sales: {
    id: 'sales',
    name: 'Sales',
    icon: '🎯',
    description: 'Track prospects through your sales process',
    color: '#f59e0b',
  },
  onboarding: {
    id: 'onboarding',
    name: 'Onboarding',
    icon: '🚀',
    description: 'Get new customers up and running',
    color: '#3b82f6',
  },
  customer_service: {
    id: 'customer_service',
    name: 'Customer Service',
    icon: '🛟',
    description: 'Handle customer issues and requests',
    color: '#ef4444',
  },
  engagement: {
    id: 'engagement',
    name: 'Engagement',
    icon: '💚',
    description: 'Retention, upsells, and customer success',
    color: '#10b981',
  },
};

// Pipeline Item (from view)
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

// Process Stats
export interface ProcessStats {
  total: number;
  needsAttention: number;
  stalled: number;
  healthy: number;
  totalMrr: number;
  productCount: number;
}

// Filter State
export interface ProcessFilters {
  process: ProcessType;
  products: string[];
  users: string[];
  health: HealthStatus | 'all';
  search: string;
  view: ViewMode;
}

// Stage Definition
export interface StageDefinition {
  id: string;
  name: string;
  order_index: number;
}

// Company Group (for By Company view)
export interface CompanyGroup {
  company_id: string;
  company_name: string;
  company_type: string | null;
  items: PipelineItem[];
  total_mrr: number;
  has_attention: boolean;
  primary_owner: {
    id: string | null;
    name: string | null;
    initials: string | null;
  };
}

// API Response Types
export interface ProcessViewResponse {
  items: PipelineItem[];
  stats: ProcessStats;
  stages: StageDefinition[];
}

// Stage Move Request
export interface StageMoveRequest {
  item_id: string;
  to_stage_id: string;
  note: string;
}
```

### 1.4 Run Migration
```bash
npx supabase db push
```

## Testing Criteria

### Test 1: Schema Verification
Use Postgres MCP to verify:
```sql
-- Verify view exists and returns data
SELECT * FROM product_pipeline_items LIMIT 5;

-- Verify health calculation works
SELECT health_status, COUNT(*) FROM product_pipeline_items GROUP BY health_status;

-- Verify indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'company_products';
```

### Test 2: Type Compilation
```bash
npx tsc --noEmit
```
Should complete with no errors.

### Test 3: Import Test
Create temporary test file and verify imports work:
```typescript
import { ProcessType, PipelineItem, PROCESSES } from '@/types/products';
console.log(PROCESSES.sales.name); // Should output "Sales"
```

## Debugging Steps

### If migration fails:
1. Check for existing conflicting objects
2. Run migration statements one by one to identify issue
3. Check Supabase logs for detailed errors

### If types have errors:
1. Check for circular imports
2. Verify all referenced types exist
3. Run `npx tsc --noEmit` for detailed errors

## Completion Checklist
- [ ] Migration file created and applied
- [ ] TypeScript types created
- [ ] All SQL queries return expected results
- [ ] No TypeScript compilation errors
- [ ] Changes committed to git

## Git Commit
```bash
git add -A
git commit -m "feat(products): add database schema and types for process views

- Add product_onboarding_stages, product_service_stages, product_engagement_stages tables
- Add product_pipeline_items view with health calculation
- Add TypeScript types for process views
- Add indexes for process queries"
```

## Next Phase
Say "PHASE 1 COMPLETE - PHASE 2 STARTING" and proceed to Phase 2.
