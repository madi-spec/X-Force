# Phase 1: Database Schema Migration

## Objective

Add `company_product_id` columns to all tables that currently have `deal_id`, create proper foreign key relationships and indexes, and build data migration scripts.

## Pre-Flight Checks

Before starting, verify your environment:

```bash
# 1. Verify build is clean
npm run build

# 2. Check database connection
npx supabase db diff
```

**Use Postgres MCP to verify current schema:**

```sql
-- Check current deal_id references
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE column_name = 'deal_id' 
AND table_schema = 'public'
ORDER BY table_name;
```

**Expected tables with deal_id:**
- activities
- tasks
- meeting_transcriptions
- scheduling_requests
- command_center_items
- ai_email_drafts (maybe)
- ai_signals (maybe)

Record results in checklist before proceeding.

---

## Step 1: Create Migration File

Create a new migration file. Get the current timestamp:

```bash
date +%Y%m%d%H%M%S
```

Create file: `supabase/migrations/[TIMESTAMP]_add_company_product_id_columns.sql`

```sql
-- Migration: Add company_product_id to tables with deal_id
-- This enables the deal → product transition while maintaining backwards compatibility

-- ============================================
-- 1. Activities table
-- ============================================
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_company_product_id ON activities(company_product_id);

COMMENT ON COLUMN activities.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 2. Tasks table
-- ============================================
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_company_product_id ON tasks(company_product_id);

COMMENT ON COLUMN tasks.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 3. Meeting transcriptions table
-- ============================================
ALTER TABLE meeting_transcriptions 
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_company_product_id ON meeting_transcriptions(company_product_id);

COMMENT ON COLUMN meeting_transcriptions.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 4. Scheduling requests table
-- ============================================
ALTER TABLE scheduling_requests 
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_requests_company_product_id ON scheduling_requests(company_product_id);

COMMENT ON COLUMN scheduling_requests.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 5. Command center items table
-- ============================================
ALTER TABLE command_center_items 
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_command_center_items_company_product_id ON command_center_items(company_product_id);

COMMENT ON COLUMN command_center_items.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 6. AI email drafts table (if exists)
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_email_drafts' AND table_schema = 'public') THEN
    ALTER TABLE ai_email_drafts 
    ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_ai_email_drafts_company_product_id ON ai_email_drafts(company_product_id);
  END IF;
END $$;

-- ============================================
-- 7. AI signals table (if exists)
-- ============================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_signals' AND table_schema = 'public') THEN
    ALTER TABLE ai_signals 
    ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_ai_signals_company_product_id ON ai_signals(company_product_id);
  END IF;
END $$;
```

---

## Step 2: Apply Migration

```bash
npx supabase db push
```

**If this fails:**
1. Check the error message
2. Common issue: column already exists - wrap in IF NOT EXISTS
3. Common issue: foreign key constraint - ensure company_products table exists
4. Fix and retry

---

## Step 3: Verify Schema Changes

**Use Postgres MCP to verify columns exist:**

```sql
-- Verify new columns exist
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE column_name = 'company_product_id' 
AND table_schema = 'public'
ORDER BY table_name;
```

**Expected result:** 5-7 rows showing company_product_id in each target table.

```sql
-- Verify indexes exist
SELECT indexname, tablename 
FROM pg_indexes 
WHERE indexname LIKE '%company_product_id%'
AND schemaname = 'public';
```

**Expected result:** 5+ indexes.

**Record results in checklist. Do not proceed if verification fails.**

---

## Step 4: Create Data Migration Script

Create file: `scripts/migrate-deal-to-product-ids.ts`

```typescript
/**
 * Data Migration Script: Populate company_product_id from deal_id
 * 
 * Uses deal_conversions table to map legacy deal_id → company_product_id
 * Run this after schema migration is complete.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface MigrationResult {
  table: string;
  total: number;
  updated: number;
  skipped: number;
  errors: string[];
}

async function migrateTable(tableName: string): Promise<MigrationResult> {
  const result: MigrationResult = { 
    table: tableName, 
    total: 0,
    updated: 0, 
    skipped: 0,
    errors: [] 
  };
  
  console.log(`\n📦 Migrating ${tableName}...`);
  
  // Get records with deal_id but no company_product_id
  const { data: records, error: fetchError, count } = await supabase
    .from(tableName)
    .select('id, deal_id', { count: 'exact' })
    .not('deal_id', 'is', null)
    .is('company_product_id', null)
    .limit(1000);
  
  if (fetchError) {
    result.errors.push(`Fetch error: ${fetchError.message}`);
    console.error(`  ❌ Fetch error: ${fetchError.message}`);
    return result;
  }
  
  result.total = count || 0;
  
  if (!records || records.length === 0) {
    console.log(`  ✓ No records to migrate (0 with deal_id and no company_product_id)`);
    return result;
  }
  
  console.log(`  Found ${records.length} records to migrate (of ${count} total needing migration)`);
  
  // Get unique deal IDs
  const dealIds = [...new Set(records.map(r => r.deal_id).filter(Boolean))];
  
  if (dealIds.length === 0) {
    console.log(`  ✓ No valid deal IDs found`);
    return result;
  }
  
  // Get mappings from deal_conversions
  const { data: conversions, error: convError } = await supabase
    .from('deal_conversions')
    .select('legacy_deal_id, company_product_id')
    .in('legacy_deal_id', dealIds);
  
  if (convError) {
    result.errors.push(`Conversion lookup error: ${convError.message}`);
    console.error(`  ❌ Conversion lookup error: ${convError.message}`);
    return result;
  }
  
  // Create mapping
  const dealToProduct = new Map<string, string>();
  conversions?.forEach(c => {
    dealToProduct.set(c.legacy_deal_id, c.company_product_id);
  });
  
  console.log(`  Found ${dealToProduct.size} deal→product mappings in deal_conversions`);
  
  // Update records in batches
  for (const record of records) {
    const companyProductId = dealToProduct.get(record.deal_id);
    
    if (companyProductId) {
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ company_product_id: companyProductId })
        .eq('id', record.id);
      
      if (updateError) {
        result.errors.push(`Update error for ${record.id}: ${updateError.message}`);
      } else {
        result.updated++;
      }
    } else {
      result.skipped++;
    }
  }
  
  console.log(`  ✓ Updated: ${result.updated}, Skipped (no mapping): ${result.skipped}`);
  if (result.errors.length > 0) {
    console.log(`  ⚠ Errors: ${result.errors.length}`);
  }
  
  return result;
}

async function checkDealConversionsTable(): Promise<boolean> {
  const { data, error } = await supabase
    .from('deal_conversions')
    .select('legacy_deal_id, company_product_id')
    .limit(1);
  
  if (error) {
    console.log('⚠ deal_conversions table not found or empty - migration will skip record updates');
    console.log('  This is OK if deals have not been converted yet.');
    return false;
  }
  
  const { count } = await supabase
    .from('deal_conversions')
    .select('*', { count: 'exact', head: true });
  
  console.log(`✓ deal_conversions table found with ${count || 0} mappings`);
  return true;
}

async function main() {
  console.log('🚀 Starting Deal → Product ID Migration\n');
  console.log('='.repeat(60));
  
  // Check if deal_conversions exists
  const hasConversions = await checkDealConversionsTable();
  
  const tables = [
    'activities',
    'tasks', 
    'meeting_transcriptions',
    'scheduling_requests',
    'command_center_items',
  ];
  
  // Check for optional tables
  const optionalTables = ['ai_email_drafts', 'ai_signals'];
  for (const table of optionalTables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (!error) {
      tables.push(table);
    }
  }
  
  console.log(`\nTables to migrate: ${tables.join(', ')}`);
  
  const results: MigrationResult[] = [];
  
  for (const table of tables) {
    try {
      const result = await migrateTable(table);
      results.push(result);
    } catch (err) {
      results.push({
        table,
        total: 0,
        updated: 0,
        skipped: 0,
        errors: [`Fatal error: ${err}`],
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary\n');
  
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  console.log('Table                      | Updated | Skipped | Errors');
  console.log('-'.repeat(60));
  
  for (const r of results) {
    const tablePadded = r.table.padEnd(26);
    console.log(`${tablePadded} | ${String(r.updated).padStart(7)} | ${String(r.skipped).padStart(7)} | ${r.errors.length}`);
    totalUpdated += r.updated;
    totalSkipped += r.skipped;
    totalErrors += r.errors.length;
  }
  
  console.log('-'.repeat(60));
  console.log(`${'TOTAL'.padEnd(26)} | ${String(totalUpdated).padStart(7)} | ${String(totalSkipped).padStart(7)} | ${totalErrors}`);
  
  if (!hasConversions) {
    console.log('\n⚠ Note: No deal_conversions found. Run deal conversion first to populate mappings.');
  }
  
  if (totalErrors > 0) {
    console.log('\n⚠ Some errors occurred. Review logs above.');
    process.exit(1);
  } else {
    console.log('\n✅ Migration complete!');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

---

## Step 5: Run Data Migration

```bash
npx tsx scripts/migrate-deal-to-product-ids.ts
```

**Note:** If the `deal_conversions` table is empty, this script will report "no mappings found" but will still succeed. The mappings will be populated as deals are converted.

---

## Step 6: Verify Data Migration

**Use Postgres MCP:**

```sql
-- Check migration coverage for each table
SELECT 
  'activities' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE deal_id IS NOT NULL) as has_deal_id,
  COUNT(*) FILTER (WHERE company_product_id IS NOT NULL) as has_company_product_id,
  COUNT(*) FILTER (WHERE deal_id IS NOT NULL AND company_product_id IS NULL) as needs_mapping
FROM activities
UNION ALL
SELECT 'tasks', COUNT(*), 
  COUNT(*) FILTER (WHERE deal_id IS NOT NULL),
  COUNT(*) FILTER (WHERE company_product_id IS NOT NULL),
  COUNT(*) FILTER (WHERE deal_id IS NOT NULL AND company_product_id IS NULL)
FROM tasks
UNION ALL
SELECT 'meeting_transcriptions', COUNT(*),
  COUNT(*) FILTER (WHERE deal_id IS NOT NULL),
  COUNT(*) FILTER (WHERE company_product_id IS NOT NULL),
  COUNT(*) FILTER (WHERE deal_id IS NOT NULL AND company_product_id IS NULL)
FROM meeting_transcriptions
UNION ALL
SELECT 'scheduling_requests', COUNT(*),
  COUNT(*) FILTER (WHERE deal_id IS NOT NULL),
  COUNT(*) FILTER (WHERE company_product_id IS NOT NULL),
  COUNT(*) FILTER (WHERE deal_id IS NOT NULL AND company_product_id IS NULL)
FROM scheduling_requests
UNION ALL
SELECT 'command_center_items', COUNT(*),
  COUNT(*) FILTER (WHERE deal_id IS NOT NULL),
  COUNT(*) FILTER (WHERE company_product_id IS NOT NULL),
  COUNT(*) FILTER (WHERE deal_id IS NOT NULL AND company_product_id IS NULL)
FROM command_center_items;
```

**Record results in checklist.**

---

## Step 7: Update TypeScript Types

Search for type definitions that need updating:

```bash
grep -r "deal_id.*string" --include="*.ts" src/types/
```

For each relevant interface, add `company_product_id`:

### Common interfaces to update:

**Activity type:**
```typescript
interface Activity {
  id: string;
  deal_id?: string | null;
  company_product_id?: string | null;  // ADD THIS
  company_id?: string | null;
  // ... rest
}
```

**Task type:**
```typescript
interface Task {
  id: string;
  deal_id?: string | null;
  company_product_id?: string | null;  // ADD THIS
  company_id?: string | null;
  // ... rest
}
```

**MeetingTranscription type:**
```typescript
interface MeetingTranscription {
  id: string;
  deal_id?: string | null;
  company_product_id?: string | null;  // ADD THIS
  company_id?: string | null;
  // ... rest
}
```

**SchedulingRequest type (check src/lib/scheduler/types.ts):**
```typescript
interface SchedulingRequest {
  id: string;
  deal_id?: string | null;
  company_product_id?: string | null;  // ADD THIS
  company_id?: string | null;
  // ... rest
}
```

**CommandCenterItem type (check src/types/commandCenter.ts):**
```typescript
interface CommandCenterItem {
  id: string;
  deal_id?: string | null;
  company_product_id?: string | null;  // ADD THIS
  company_id?: string | null;
  // ... rest
}
```

---

## Step 8: Verify TypeScript Compilation

```bash
npm run build
```

**If errors occur:**
1. Read the error message
2. Find the file and line
3. Add the missing type or fix the issue
4. Re-run build
5. Repeat until clean

---

## Phase 1 Success Criteria

**ALL of these must pass before proceeding:**

### ✅ Database Columns (Postgres MCP)
```sql
SELECT COUNT(*) FROM information_schema.columns 
WHERE column_name = 'company_product_id' AND table_schema = 'public';
-- Expected: 5 or more
```

### ✅ Database Indexes (Postgres MCP)
```sql
SELECT COUNT(*) FROM pg_indexes 
WHERE indexname LIKE '%company_product_id%' AND schemaname = 'public';
-- Expected: 5 or more
```

### ✅ Build Passes
```bash
npm run build
# Expected: Exit code 0, no errors
```

### ✅ Migration Script Runs
```bash
npx tsx scripts/migrate-deal-to-product-ids.ts
# Expected: Completes without fatal errors
```

---

## Commit Checkpoint

When all criteria pass:

```bash
git add -A
git commit -m "Phase 1: Add company_product_id columns to all deal-related tables

- Added company_product_id column to: activities, tasks, meeting_transcriptions,
  scheduling_requests, command_center_items
- Created indexes for query performance
- Created data migration script: scripts/migrate-deal-to-product-ids.ts
- Updated TypeScript types to include company_product_id
- All verification queries passing
- Build passes"
```

---

## Update Checklist

Edit `docs/migration/MIGRATION_CHECKLIST.md`:
1. Mark Phase 1 as ✅ Complete
2. Record timestamp
3. Record commit hash
4. Note any issues encountered

---

## Next Phase

After updating the checklist, proceed to Phase 2:

```bash
cat docs/migration/PHASE_2_SCHEDULER.md
```
