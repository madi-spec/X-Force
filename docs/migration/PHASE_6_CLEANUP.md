# Phase 6: Final Cleanup & Deprecation

## Objective

Complete the migration with final cleanup: add deprecation comments, update documentation, audit remaining references, and verify everything works end-to-end.

## Pre-Flight Check

**Verify all previous phases complete:**
```bash
grep -E "Phase [1-5]:" docs/migration/MIGRATION_CHECKLIST.md | head -10
npm run build
```

**All phases 1-5 must show ✅ Complete before proceeding.**

---

## Step 1: Audit Remaining Deal References

**Run comprehensive search:**

```bash
# Count all deal_id references
echo "=== deal_id references ===" 
grep -rn "deal_id" --include="*.ts" --include="*.tsx" src/ | wc -l

# List files with deal_id (for review)
echo "=== Files with deal_id ===" 
grep -rl "deal_id" --include="*.ts" --include="*.tsx" src/ | head -30

# Find deal-specific function names
echo "=== Deal-specific functions ===" 
grep -rn "findDeal\|getDeal\|updateDeal\|createDeal" --include="*.ts" --include="*.tsx" src/ | head -20

# Find deal in type definitions
echo "=== Deal types ===" 
grep -rn "interface.*Deal\|type.*Deal" --include="*.ts" src/types/ | head -10
```

**Categorize results:**
- **KEEP**: Backwards compatibility, migration scripts, deal_conversions
- **DEPRECATE**: Add @deprecated comments
- **ACCEPTABLE**: References in legacy-deals pages

**Document findings in checklist.**

---

## Step 2: Add Deprecation Comments

**For files that will keep deal_id for backwards compatibility, add deprecation comments.**

### Pattern for Type Definitions

In type files (e.g., `src/types/*.ts`):
```typescript
export interface SomeEntity {
  id: string;
  
  /**
   * @deprecated Use company_product_id instead. 
   * Maintained for backwards compatibility with legacy deals.
   */
  deal_id?: string | null;
  
  /** Reference to the company_product for this entity */
  company_product_id?: string | null;
  
  // ... rest of fields
}
```

### Pattern for Functions

If there are deal-specific functions being kept:
```typescript
/**
 * @deprecated Use findCompanyProductForCompany() instead.
 * This function is maintained for legacy deal support only.
 */
export async function findDealForCompany(companyId: string) {
  // ...
}
```

### Files to Add Deprecation Comments

Likely candidates:
- `src/types/commandCenter.ts` - deal_id, deal_value, deal_stage fields
- `src/lib/scheduler/types.ts` - deal_id field
- `src/lib/commandCenter/itemGenerator.ts` - findDealForCompany if it exists
- Any other files with deal-specific logic

**Add deprecation comments to at least 5 key locations.**

---

## Step 3: Review AI Prompts (If Applicable)

**Check if there are AI prompts that mention "deals":**

```bash
grep -rn "deal" --include="*.ts" src/lib/ai/
grep -rn "deal" --include="*.ts" src/lib/prompts/
```

**For prompts stored in database:**

Use Postgres MCP:
```sql
SELECT id, name, content 
FROM prompts 
WHERE content ILIKE '%deal%'
LIMIT 10;
```

**Update prompts to be product-aware where appropriate:**

Before:
```
Analyze this deal and provide recommendations...
```

After:
```
Analyze this sales opportunity and provide recommendations...
```

Or use conditional language:
```
Analyze this {product_name ? 'product opportunity' : 'deal'} and provide recommendations...
```

**Note:** If prompts are complex, document them for future update rather than changing now.

---

## Step 4: Identify Unused Deal Components

**Check which deal components are still imported:**

```bash
# List deal components
ls -la src/components/deals/ 2>/dev/null || echo "No deals component folder"

# Check if they're imported
for file in src/components/deals/*.tsx 2>/dev/null; do
  name=$(basename "$file" .tsx)
  echo "=== Checking $name ==="
  grep -rn "from.*deals.*$name\|from.*/$name" --include="*.tsx" src/app/ | head -3
  grep -rn "import.*$name" --include="*.tsx" src/app/ | head -3
done
```

**For unused components, choose one:**
1. Delete them
2. Move to `src/components/_deprecated/`
3. Keep but add deprecation notice at top of file

**Recommended: Move to _deprecated folder:**
```bash
mkdir -p src/components/_deprecated
mv src/components/deals/UnusedComponent.tsx src/components/_deprecated/
```

---

## Step 5: Update CLAUDE.md

### File: `CLAUDE.md`

**Find the data model or architecture section and update it.**

Add or update this section:
```markdown
## Data Architecture

### Product-Centric Model (Current)

X-FORCE uses a product-centric architecture where sales opportunities are tracked per product:

- **company_products** - Primary entity for sales/customer relationships
  - Links: company_id, product_id, current_stage_id
  - Status: in_sales, in_onboarding, active, inactive
  - Tracks MRR, stage history, ownership

- **products** - Product catalog
  - Product types: suite, addon, module
  - Each product has its own sales stages

- **product_sales_stages** - Per-product pipeline stages

### Legacy Deal System (Deprecated)

The legacy `deals` table is maintained for historical data but should not be used for new development:

- **deals** - Legacy sales opportunities (READ-ONLY for new code)
- Access via /legacy-deals for historical reference
- Use deal_conversions table for migration mapping

### Foreign Key Pattern

Tables support both systems during transition:
- `deal_id` - @deprecated, for backwards compatibility
- `company_product_id` - Preferred, use for all new code

### For New Development

Always use `company_product_id` instead of `deal_id` when:
- Creating activities
- Creating tasks
- Creating transcriptions
- Creating scheduling requests
- Creating command center items
```

---

## Step 6: Create Migration Documentation

### File: `docs/MIGRATION_DEAL_TO_PRODUCT.md`

Create this file:
```markdown
# Deal to Product Migration

## Overview

In January 2025, X-FORCE completed migration from a deal-centric to product-centric architecture.

## Timeline

- Phase 1: Database schema (company_product_id columns)
- Phase 2: Scheduler system
- Phase 3: Command Center
- Phase 4: Activities, Tasks, Transcriptions
- Phase 5: UI Navigation
- Phase 6: Cleanup & Documentation

## Key Changes

### Data Model
- Primary entity changed from `deals` to `company_products`
- All tables now support `company_product_id` alongside `deal_id`
- New records should use `company_product_id`

### Navigation
- `/deals` redirects to `/products`
- Legacy deals accessible at `/legacy-deals`
- Products pipeline is the primary sales view

### API Changes
- All endpoints accept `company_product_id`
- `deal_id` still accepted for backwards compatibility
- New integrations should use `company_product_id`

## For Developers

### DO use company_product_id for:
- New activity creation
- New task creation
- New meeting transcriptions
- Scheduler requests
- Command center items

### DON'T use deal_id for:
- Any new development
- New integrations
- New features

### Migration Utilities
- `/api/deals/[id]/convert` - Convert legacy deal to company_products
- `deal_conversions` table - Maps legacy deals to products

## Database Schema

### company_products (Current)
```sql
- id (UUID)
- company_id (UUID)
- product_id (UUID)
- status (in_sales, in_onboarding, active, inactive)
- current_stage_id (UUID -> product_sales_stages)
- mrr (NUMERIC)
- owner_id (UUID -> users)
```

### deals (Legacy)
```sql
- id (UUID)
- company_id (UUID)
- stage (TEXT)
- estimated_value (NUMERIC)
- [other legacy fields]
```

### deal_conversions (Migration Tracking)
```sql
- legacy_deal_id (UUID -> deals)
- company_product_id (UUID -> company_products)
- converted_at (TIMESTAMPTZ)
```

## Troubleshooting

### "Deal not found" errors
- Check if the deal was converted
- Use deal_conversions to find the company_product_id
- Redirect to company or product page

### Missing product data
- Verify company_product_id is set
- Check company_products table for the record
- May need to run data migration script
```

---

## Step 7: Run Full Test Suite

```bash
# TypeScript compilation
npm run build

# Lint check
npm run lint

# If tests exist
npm run test 2>/dev/null || echo "No test script"
```

**All must pass or have acceptable warnings.**

---

## Step 8: Final Database Verification

**Use Postgres MCP:**

```sql
-- Migration completion stats
SELECT '=== MIGRATION STATS ===' as header;

-- 1. Converted deals
SELECT 'Converted Deals' as metric, COUNT(*) as count 
FROM deal_conversions;

-- 2. Unconverted deals (excluding closed)
SELECT 'Unconverted Active Deals' as metric, COUNT(*) as count
FROM deals d
WHERE NOT EXISTS (
  SELECT 1 FROM deal_conversions dc WHERE dc.legacy_deal_id = d.id
)
AND d.stage NOT IN ('closed_won', 'closed_lost', 'closed_converted');

-- 3. Company products by status
SELECT 'Company Products: ' || status as metric, COUNT(*) as count
FROM company_products 
GROUP BY status 
ORDER BY count DESC;

-- 4. Tables with company_product_id populated
SELECT '=== COMPANY_PRODUCT_ID COVERAGE ===' as header;

SELECT 'activities' as table_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE company_product_id IS NOT NULL) as has_cp_id,
  ROUND(100.0 * COUNT(*) FILTER (WHERE company_product_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as pct
FROM activities
UNION ALL
SELECT 'tasks', COUNT(*),
  COUNT(*) FILTER (WHERE company_product_id IS NOT NULL),
  ROUND(100.0 * COUNT(*) FILTER (WHERE company_product_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1)
FROM tasks
UNION ALL
SELECT 'scheduling_requests', COUNT(*),
  COUNT(*) FILTER (WHERE company_product_id IS NOT NULL),
  ROUND(100.0 * COUNT(*) FILTER (WHERE company_product_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1)
FROM scheduling_requests
UNION ALL
SELECT 'command_center_items', COUNT(*),
  COUNT(*) FILTER (WHERE company_product_id IS NOT NULL),
  ROUND(100.0 * COUNT(*) FILTER (WHERE company_product_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1)
FROM command_center_items
UNION ALL
SELECT 'meeting_transcriptions', COUNT(*),
  COUNT(*) FILTER (WHERE company_product_id IS NOT NULL),
  ROUND(100.0 * COUNT(*) FILTER (WHERE company_product_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1)
FROM meeting_transcriptions;
```

**Record these stats in the checklist.**

---

## Step 9: Final UI Verification

**Use Playwright MCP for comprehensive check:**

```
1. Navigate to /
   Screenshot: "final-home"
   
2. Navigate to /products
   Screenshot: "final-products"
   
3. Navigate to /ai
   Screenshot: "final-command-center"
   
4. Navigate to /scheduler
   Screenshot: "final-scheduler"
   
5. Navigate to /companies/[valid-id]
   Screenshot: "final-company"
   
6. Navigate to /legacy-deals
   Screenshot: "final-legacy-deals"
   
7. Navigate to /settings
   Screenshot: "final-settings"
```

**Verify no errors in console, all pages load correctly.**

---

## Phase 6 Success Criteria

### ✅ Build & Lint
```bash
npm run build  # Exit code 0
npm run lint   # Exit code 0 or acceptable warnings
```

### ✅ Deprecation Comments Added
- At least 5 key deal_id references marked @deprecated
- Document which files were updated

### ✅ Documentation Updated
- [ ] CLAUDE.md has product-centric architecture notes
- [ ] docs/MIGRATION_DEAL_TO_PRODUCT.md created

### ✅ Unused Code Handled
- Unused components identified
- Either deleted or moved to _deprecated

### ✅ Final Database Stats Captured
- Record conversion counts
- Record company_product_id coverage percentages

### ✅ Final UI Verification
- All main pages load
- No console errors
- Navigation works

---

## Final Commit

```bash
git add -A
git commit -m "Phase 6: Migration complete - Deal to Product architecture

🎉 MIGRATION COMPLETE

Summary of Changes:
==================
- Database: company_product_id columns in activities, tasks, 
  meeting_transcriptions, scheduling_requests, command_center_items
- Scheduler: Full company_product_id support with UI product selection
- Command Center: Product-aware scoring, display, and context
- Activities/Tasks: All creation paths support company_product_id
- UI: Product-centric navigation, /deals redirects to /products
- Legacy: Deals accessible at /legacy-deals for historical data

Documentation:
- CLAUDE.md updated with product-centric architecture
- docs/MIGRATION_DEAL_TO_PRODUCT.md created
- Deprecation comments added to legacy code

Breaking Changes:
- /deals now redirects to /products
- New code should use company_product_id, not deal_id

Backwards Compatibility:
- deal_id fields preserved but @deprecated
- Legacy deals accessible via /legacy-deals
- deal_conversions table tracks migrations"
```

---

## Update Checklist - Final

Edit `docs/migration/MIGRATION_CHECKLIST.md`:
1. Mark Phase 6 as ✅ Complete
2. Record timestamp and commit hash
3. Update Migration Summary section:
   - Total Duration
   - Phases Completed: 6/6
   - Final Status: ✅ COMPLETE
4. Add any final notes

---

## 🎉 MIGRATION COMPLETE

Congratulations! The deal-to-product migration is complete.

### Post-Migration Monitoring (Next 7 Days)

Watch for:
1. Any 500 errors in logs related to deal/product lookups
2. User reports of missing data
3. Performance issues with new queries
4. Any edge cases missed during migration

### Future Cleanup (30-60 Days)

After stable operation:
1. Consider removing deal_id columns from tables (major breaking change)
2. Archive the deals table
3. Remove _deprecated components
4. Remove deal-specific API endpoints

### Support

If issues arise:
1. Check deal_conversions for missing mappings
2. Run data migration script again for new conversions
3. Check company_product_id population with verification queries
