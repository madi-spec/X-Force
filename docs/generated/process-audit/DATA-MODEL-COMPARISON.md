# Process Data Model Comparison

## Overview

This document compares the data models across all 4 generations of process/pipeline systems.

---

## Table Comparison

### Stage Storage

| Field | Gen 1 (Hardcoded) | Gen 2 (product_sales_stages) | Gen 3 (product_process_stages) | Gen 4 (process_nodes) |
|-------|-------------------|------------------------------|--------------------------------|----------------------|
| ID | string constant | UUID | UUID | UUID |
| Name | `name` | `name` | `name` | `label` |
| Order | `order` | `stage_order` | `stage_order` | `position_y` + `node_order` |
| Description | N/A | `description` | `description` | `config.description` |
| Goal | N/A | `goal` | `goal` | `config.goal` |
| Exit Criteria | N/A | `exit_criteria` | N/A | `config.exitCriteria` |
| SLA | N/A | N/A | `sla_days`, `sla_warning_days` | `config.slaDays` |
| Terminal | implied (closed_*) | N/A | `is_terminal`, `terminal_type` | type='exit' |
| Product Link | N/A | `product_id` | `process_id` → `product_id` | `process_id` → `product_id` |
| Type | sales only | sales only | sales/onboarding/support/engagement | any |

### Content Fields (Gen 2 Only)

These fields exist only in `product_sales_stages`:

```sql
-- Sales enablement content
pitch_points JSONB,           -- [{id, text, source, effectiveness_score}]
objection_handlers JSONB,     -- [{id, objection, response, source}]
resources JSONB,              -- [{id, title, url, type}]

-- AI suggestions
ai_suggested_pitch_points JSONB,
ai_suggested_objections JSONB,
ai_insights JSONB,

-- Metrics
avg_days_in_stage NUMERIC,
conversion_rate NUMERIC,

-- Automation
ai_sequence_id UUID,
ai_actions JSONB
```

**Recommendation:** Add these to `product_process_stages` for the unified model.

### Entity Tracking

| Field | deals table | company_products table |
|-------|-------------|------------------------|
| Company link | `company_id` | `company_id` |
| Product link | `primary_product_category_id` | `product_id` |
| Current stage | `stage` (string) | `current_stage_id` (FK) |
| Stage entered | N/A | `stage_entered_at` |
| Owner | `owner_id` | `owner_user_id` |
| Value | `value`, `mrr_estimate` | `mrr` |
| Status | `status` (open/won/lost) | `status` (active/churned/paused) |
| Close confidence | `close_confidence` | `close_confidence` |

---

## Schema Definitions

### Gen 1: deals table

```sql
CREATE TABLE deals (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  stage TEXT NOT NULL,  -- Matches PIPELINE_STAGES.id
  value NUMERIC,
  mrr_estimate NUMERIC,
  close_confidence INTEGER,
  expected_close_date DATE,
  owner_id UUID REFERENCES users(id),
  sales_team TEXT,
  products JSONB,
  primary_product_category_id TEXT,
  status TEXT DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Gen 2: product_sales_stages table

```sql
CREATE TABLE product_sales_stages (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  goal TEXT,
  description TEXT,
  exit_criteria TEXT,
  pitch_points JSONB DEFAULT '[]',
  objection_handlers JSONB DEFAULT '[]',
  resources JSONB DEFAULT '[]',
  ai_suggested_pitch_points JSONB DEFAULT '[]',
  ai_suggested_objections JSONB DEFAULT '[]',
  ai_insights JSONB DEFAULT '{}',
  avg_days_in_stage NUMERIC,
  conversion_rate NUMERIC,
  ai_sequence_id UUID,
  ai_actions JSONB DEFAULT '[]',
  exit_actions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, slug)
);
```

### Gen 3: product_processes + product_process_stages

```sql
CREATE TABLE product_processes (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  process_type process_type NOT NULL,  -- ENUM
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  name TEXT NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE(product_id, process_type, version)
);

CREATE TABLE product_process_stages (
  id UUID PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES product_processes(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  description TEXT,
  goal TEXT,
  sla_days INTEGER,
  sla_warning_days INTEGER,
  is_terminal BOOLEAN DEFAULT FALSE,
  terminal_type TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(process_id, slug)
);
```

### Gen 4: processes + process_nodes + process_connections

```sql
CREATE TABLE processes (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id),
  process_type process_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  canvas_zoom NUMERIC DEFAULT 1.0,
  canvas_pan_x INTEGER DEFAULT 0,
  canvas_pan_y INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE TABLE process_nodes (
  id UUID PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES processes(id),
  type TEXT NOT NULL,  -- trigger/stage/condition/aiAction/humanAction/exit
  item_id TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  config JSONB DEFAULT '{}',
  stage_id UUID REFERENCES product_process_stages(id),
  node_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE process_connections (
  id UUID PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES processes(id),
  from_node_id UUID NOT NULL REFERENCES process_nodes(id),
  to_node_id UUID NOT NULL REFERENCES process_nodes(id),
  from_port TEXT,
  to_port TEXT,
  label TEXT,
  color TEXT,
  style TEXT DEFAULT 'solid',
  condition JSONB,
  connection_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Proposed Unified Schema

### product_process_stages (Enhanced)

```sql
-- Add missing fields from product_sales_stages
ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS
  pitch_points JSONB DEFAULT '[]',
  objection_handlers JSONB DEFAULT '[]',
  resources JSONB DEFAULT '[]',
  ai_suggested_pitch_points JSONB DEFAULT '[]',
  ai_suggested_objections JSONB DEFAULT '[]',
  ai_insights JSONB DEFAULT '{}',
  avg_days_in_stage NUMERIC,
  conversion_rate NUMERIC,
  ai_sequence_id UUID,
  ai_actions JSONB DEFAULT '[]',
  exit_criteria TEXT,
  exit_actions JSONB;
```

### company_products (Already exists, ensure fields)

```sql
-- Already has:
-- current_stage_id UUID REFERENCES product_process_stages(id)
-- stage_entered_at TIMESTAMPTZ

-- May need to update references from product_sales_stages
```

---

## Migration Queries

### Migrate product_sales_stages → product_process_stages

```sql
-- Step 1: Create process record for each product (if not exists)
INSERT INTO product_processes (product_id, process_type, name, status)
SELECT DISTINCT
  product_id,
  'sales',
  'Sales Process',
  'published'
FROM product_sales_stages
ON CONFLICT (product_id, process_type, version) DO NOTHING;

-- Step 2: Copy stages with all fields
INSERT INTO product_process_stages (
  process_id, name, slug, stage_order, goal, description,
  config, pitch_points, objection_handlers, resources,
  ai_suggested_pitch_points, ai_suggested_objections, ai_insights,
  avg_days_in_stage, conversion_rate, ai_sequence_id, ai_actions,
  exit_criteria, exit_actions
)
SELECT
  pp.id,
  pss.name,
  pss.slug,
  pss.stage_order,
  pss.goal,
  pss.description,
  '{}'::jsonb,
  pss.pitch_points,
  pss.objection_handlers,
  pss.resources,
  pss.ai_suggested_pitch_points,
  pss.ai_suggested_objections,
  pss.ai_insights,
  pss.avg_days_in_stage,
  pss.conversion_rate,
  pss.ai_sequence_id,
  pss.ai_actions,
  pss.exit_criteria,
  pss.exit_actions
FROM product_sales_stages pss
JOIN product_processes pp ON pp.product_id = pss.product_id AND pp.process_type = 'sales';

-- Step 3: Update company_products FK references
UPDATE company_products cp
SET current_stage_id = pps.id
FROM product_sales_stages pss
JOIN product_processes pp ON pp.product_id = pss.product_id
JOIN product_process_stages pps ON pps.process_id = pp.id AND pps.slug = pss.slug
WHERE cp.current_stage_id = pss.id;
```

---

## API Endpoint Comparison

| Action | Gen 2 API | Gen 3 API | Gen 4 API |
|--------|-----------|-----------|-----------|
| Get stages | `GET /api/products/[slug]` (includes stages) | `GET /api/process/[slug]/[type]` | `GET /api/process/[slug]/[type]/workflow` |
| Save stages | `POST /api/products/[slug]/stages` | `POST /api/process/[slug]/[type]` | `POST /api/process/[slug]/[type]/workflow` |
| Move entity | N/A | `POST /api/company-products/[id]/move-stage` | Same |
| AI analysis | `POST /api/products/[slug]/analyze` | N/A | N/A |

**Recommendation:** Consolidate to single API pattern:
- `GET/POST /api/products/[slug]/process/[type]` - Stage data
- `GET/POST /api/products/[slug]/process/[type]/workflow` - Visual workflow
- `POST /api/products/[slug]/process/[type]/analyze` - AI analysis
