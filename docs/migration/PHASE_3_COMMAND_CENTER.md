# Phase 3: Command Center Migration

## Objective

Update the Command Center / Work Queue system to use `company_product_id` for item generation, scoring, and display. Replace deal-centric logic with product-centric logic while maintaining backwards compatibility.

## Pre-Flight Check

**Verify Phase 2 is complete:**
```bash
grep -A5 "Phase 2:" docs/migration/MIGRATION_CHECKLIST.md
npm run build
```

**Do not proceed if Phase 2 is incomplete.**

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/commandCenter.ts` | Add company_product_id to types |
| `src/lib/commandCenter/itemGenerator.ts` | Add findCompanyProductForCompany(), update generateWhyNow() |
| `src/lib/commandCenter/momentumScoring.ts` | Use product MRR for scoring |
| `src/lib/commandCenter/contextEnrichment.ts` | Enrich with product context |
| `src/app/api/command-center/route.ts` | Return company_product info |
| `src/components/commandCenter/ActionCard.tsx` | Display product badges |

---

## Step 1: Update Command Center Types

### File: `src/types/commandCenter.ts`

**Find CommandCenterItem interface and add these fields (alongside existing deal fields):**

```typescript
export interface CommandCenterItem {
  // ... existing fields like id, user_id, action_type, etc.
  
  // Existing deal fields (keep these)
  deal_id?: string | null;
  deal_value?: number | null;
  deal_stage?: string | null;
  deal_probability?: number | null;
  
  // NEW: Product fields - add these
  company_product_id?: string | null;
  product_name?: string | null;
  product_status?: string | null;
  product_mrr?: number | null;
  product_stage?: string | null;
  
  // ... rest of existing fields
}
```

**Find EnrichedCommandCenterItem interface and add same fields if it exists.**

**Find CreateItemRequest interface and add:**
```typescript
export interface CreateItemRequest {
  // ... existing fields
  company_product_id?: string;
}
```

---

## Step 2: Create Product Lookup Function

### File: `src/lib/commandCenter/itemGenerator.ts`

**Add this new function (can be placed near findDealForCompany if it exists):**

```typescript
/**
 * Find the primary company_product for a company
 * Returns the highest-priority active product (in_sales > in_onboarding > active)
 */
export async function findCompanyProductForCompany(
  companyId: string
): Promise<{
  id: string;
  product_id: string;
  product_name: string;
  status: string;
  mrr: number | null;
  stage_name: string | null;
} | null> {
  const supabase = createAdminClient();

  // Priority order: in_sales first (active sales), then onboarding, then active customers
  const { data: products, error } = await supabase
    .from('company_products')
    .select(`
      id,
      product_id,
      status,
      mrr,
      current_stage:product_sales_stages(id, name),
      product:products(id, name)
    `)
    .eq('company_id', companyId)
    .in('status', ['in_sales', 'in_onboarding', 'active'])
    .order('status', { ascending: true })
    .limit(5);

  if (error) {
    console.error('[findCompanyProductForCompany] Error:', error);
    return null;
  }

  if (!products || products.length === 0) {
    return null;
  }

  // Priority: in_sales > in_onboarding > active
  const priorityOrder = ['in_sales', 'in_onboarding', 'active'];
  const sorted = products.sort((a, b) => {
    return priorityOrder.indexOf(a.status) - priorityOrder.indexOf(b.status);
  });

  const cp = sorted[0];
  const product = Array.isArray(cp.product) ? cp.product[0] : cp.product;
  const stage = Array.isArray(cp.current_stage) ? cp.current_stage[0] : cp.current_stage;

  return {
    id: cp.id,
    product_id: cp.product_id,
    product_name: product?.name || 'Unknown Product',
    status: cp.status,
    mrr: cp.mrr,
    stage_name: stage?.name || null,
  };
}
```

**Make sure createAdminClient is imported at the top of the file.**

---

## Step 3: Update Item Generation

### File: `src/lib/commandCenter/itemGenerator.ts`

**Find the createCommandCenterItem function and update it:**

Look for where the item is inserted into the database. Before the insert, add product lookup:

```typescript
export async function createCommandCenterItem(
  item: Partial<CommandCenterItem>
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = createAdminClient();
  
  // NEW: If company_id provided but no company_product_id, try to find one
  let productData: {
    id: string;
    product_name: string;
    status: string;
    mrr: number | null;
    stage_name: string | null;
  } | null = null;
  
  if (item.company_id && !item.company_product_id) {
    productData = await findCompanyProductForCompany(item.company_id);
  }
  
  const insertData = {
    ...item,
    // Add product fields if we found a product
    company_product_id: item.company_product_id || productData?.id || null,
    product_name: item.product_name || productData?.product_name || null,
    product_status: item.product_status || productData?.status || null,
    product_mrr: item.product_mrr || productData?.mrr || null,
    product_stage: item.product_stage || productData?.stage_name || null,
  };
  
  const { data, error } = await supabase
    .from('command_center_items')
    .insert(insertData)
    .select('id')
    .single();
  
  // ... rest of existing function
}
```

---

## Step 4: Update generateWhyNow Function

### File: `src/lib/commandCenter/itemGenerator.ts`

**Find the generateWhyNow function and add product-aware messages at the beginning:**

```typescript
export function generateWhyNow(item: {
  action_type: string;
  signal_type?: string | null;
  deal_value?: number | null;
  deal_stage?: string | null;
  product_name?: string | null;
  product_status?: string | null;
  product_mrr?: number | null;
}): string {
  const { 
    action_type, 
    signal_type, 
    deal_value, 
    deal_stage,
    product_name,
    product_status,
    product_mrr
  } = item;

  // NEW: Product-based messages (check these first)
  if (product_name && product_status) {
    const mrr = product_mrr ? ` ($${product_mrr.toLocaleString()}/mo)` : '';
    
    switch (product_status) {
      case 'in_sales':
        return `${product_name}${mrr} opportunity - advance the sale`;
      case 'in_onboarding':
        return `${product_name} onboarding in progress - ensure customer success`;
      case 'active':
        return `${product_name} customer${mrr} - maintain and grow relationship`;
    }
  }

  // Existing deal-based and action-based logic follows...
  // ... keep all existing code below
```

---

## Step 5: Update Momentum Scoring

### File: `src/lib/commandCenter/momentumScoring.ts`

**Find the getValueScore function and update to include product MRR:**

```typescript
export function getValueScore(item: Partial<CommandCenterItem>): number {
  // Use deal_value if available, otherwise use product_mrr * 12 (annualized)
  const dealValue = item.deal_value || 0;
  const productValue = item.product_mrr ? item.product_mrr * 12 : 0;
  const value = dealValue || productValue;
  
  if (!value || value <= 0) return 0;
  
  // Scale: $0-10k = 0-25, $10k-50k = 25-50, $50k-100k = 50-75, $100k+ = 75-100
  if (value < 10000) return Math.round((value / 10000) * 25);
  if (value < 50000) return 25 + Math.round(((value - 10000) / 40000) * 25);
  if (value < 100000) return 50 + Math.round(((value - 50000) / 50000) * 25);
  return Math.min(100, 75 + Math.round(((value - 100000) / 100000) * 25));
}
```

---

## Step 6: Update Context Enrichment

### File: `src/lib/commandCenter/contextEnrichment.ts`

**Find the gatherContext or enrichItem function and add product context loading:**

Add this block where other context is loaded (near deal context loading if it exists):

```typescript
// Load product context
if (item.company_product_id) {
  const { data: companyProduct } = await supabase
    .from('company_products')
    .select(`
      id,
      status,
      mrr,
      current_stage:product_sales_stages(id, name),
      product:products(id, name, slug, color),
      activated_at,
      sales_started_at,
      last_stage_moved_at
    `)
    .eq('id', item.company_product_id)
    .single();
  
  if (companyProduct) {
    const product = Array.isArray(companyProduct.product) 
      ? companyProduct.product[0] 
      : companyProduct.product;
    const stage = Array.isArray(companyProduct.current_stage)
      ? companyProduct.current_stage[0]
      : companyProduct.current_stage;
    
    context.companyProduct = {
      id: companyProduct.id,
      status: companyProduct.status,
      mrr: companyProduct.mrr,
      stage: stage ? { id: stage.id, name: stage.name } : null,
      product: product ? { id: product.id, name: product.name, slug: product.slug } : null,
      activatedAt: companyProduct.activated_at,
      salesStartedAt: companyProduct.sales_started_at,
      lastStageMoveAt: companyProduct.last_stage_moved_at,
    };
  }
}
```

**Note:** The exact location depends on how the function is structured. Look for similar patterns loading deal or company context.

---

## Step 7: Update API Response

### File: `src/app/api/command-center/route.ts`

**Find where items are queried and update to include company_product:**

**1. Update the select query (look for .select()):**
```typescript
.select(`
  *,
  company:companies(id, name),
  company_product:company_products(
    id,
    status,
    mrr,
    product:products(id, name, slug, color),
    current_stage:product_sales_stages(id, name)
  )
`)
```

**2. If there's a transformation function, update it to extract product fields:**
```typescript
// In transformation logic
const companyProduct = row.company_product;
const product = companyProduct?.product;

return {
  // ... existing fields
  company_product_id: companyProduct?.id || null,
  product_name: product?.name || null,
  product_status: companyProduct?.status || null,
  product_mrr: companyProduct?.mrr || null,
};
```

---

## Step 8: Update ActionCard Component

### File: `src/components/commandCenter/ActionCard.tsx`

**Find where company name is displayed and add product badge nearby:**

```typescript
{/* Product Badge - Add after company name display */}
{item.product_name && (
  <span className={cn(
    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ml-2',
    item.product_status === 'in_sales' && 'bg-yellow-100 text-yellow-800',
    item.product_status === 'in_onboarding' && 'bg-blue-100 text-blue-800',
    item.product_status === 'active' && 'bg-green-100 text-green-800',
    !item.product_status && 'bg-gray-100 text-gray-700'
  )}>
    {item.product_name}
    {item.product_mrr && item.product_mrr > 0 && (
      <span className="opacity-75">
        ${item.product_mrr.toLocaleString()}/mo
      </span>
    )}
  </span>
)}
```

**Make sure cn is imported:**
```typescript
import { cn } from '@/lib/utils';
```

---

## Step 9: TypeScript Verification

```bash
npm run build
```

**Common issues and fixes:**
- Missing types: Add to CommandCenterItem interface
- Import errors: Check createAdminClient import
- Null safety: Use optional chaining (?.)

---

## Step 10: Test Command Center

**Use Playwright MCP:**
```
1. Navigate to /ai (Command Center page)
2. Wait for items to load
3. Take screenshot: "command-center-with-products"
4. Look for product badges on items
5. Click on an item with a product
6. Take screenshot: "command-center-item-detail"
```

**Use Postgres MCP to verify:**
```sql
-- Check items have product data populated
SELECT 
  id,
  company_id,
  company_product_id,
  product_name,
  product_status,
  product_mrr,
  momentum_score
FROM command_center_items
WHERE company_product_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

**Test momentum scoring:**
```sql
-- Verify value scoring includes product MRR
SELECT 
  id,
  deal_value,
  product_mrr,
  COALESCE(deal_value, product_mrr * 12) as effective_value,
  value_score,
  momentum_score
FROM command_center_items
WHERE product_mrr IS NOT NULL OR deal_value IS NOT NULL
ORDER BY momentum_score DESC
LIMIT 10;
```

---

## Phase 3 Success Criteria

### ✅ Type Verification
```bash
npm run build
# Expected: Exit code 0
```

### ✅ Function Verification (Postgres MCP)
```sql
-- findCompanyProductForCompany should work
-- Test by checking if items get product data
SELECT COUNT(*) FROM command_center_items WHERE company_product_id IS NOT NULL;
```

### ✅ UI Verification (Playwright MCP)
- Command Center page loads without errors
- Items show product badges when products exist
- Product MRR displays correctly

### ✅ Scoring Verification (Postgres MCP)
- Items with product_mrr have value_score > 0
- generateWhyNow produces product-aware messages

---

## Commit Checkpoint

```bash
git add -A
git commit -m "Phase 3: Command Center now uses company_product_id

- Added product fields to CommandCenterItem type
- Created findCompanyProductForCompany() function
- Updated item generation to auto-populate product data
- Updated momentum scoring to use product MRR (annualized)
- Updated generateWhyNow() for product-aware messaging
- Context enrichment includes product details
- API returns product information with items
- ActionCard displays product badges with MRR
- Backwards compatible with deal_id"
```

---

## Update Checklist

Edit `docs/migration/MIGRATION_CHECKLIST.md`:
1. Mark Phase 3 as ✅ Complete
2. Record timestamp
3. Record commit hash
4. Note screenshots taken
5. Document any issues

---

## Next Phase

```bash
cat docs/migration/PHASE_4_ACTIVITIES.md
```
