# Phase 5: UI Pages & Navigation Cleanup

## Objective

Update navigation to make Products the primary focus, de-emphasize Deals, and update routes to redirect appropriately. Ensure users have a product-centric experience.

## Pre-Flight Check

**Verify Phase 4 is complete:**
```bash
grep -A5 "Phase 4:" docs/migration/MIGRATION_CHECKLIST.md
npm run build
```

**Do not proceed if Phase 4 is incomplete.**

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/shared/Sidebar.tsx` | Reorganize navigation |
| `src/components/shared/MobileNav.tsx` | Match sidebar changes |
| `src/app/(dashboard)/deals/page.tsx` | Add redirect or migration notice |
| `src/app/(dashboard)/deals/[id]/page.tsx` | Add redirect or legacy banner |

---

## Step 1: Update Sidebar Navigation

### File: `src/components/shared/Sidebar.tsx`

**Current navigation structure likely looks like:**
```typescript
const navigation = [
  { name: 'Command Center', href: '/ai', icon: Brain },
  { name: 'Daily Driver', href: '/daily', icon: ListTodo },
  { name: 'Deals', href: '/deals', icon: Zap },
  { name: 'Companies', href: '/companies', icon: Building2 },
  // ... etc
];
```

**Update to product-centric structure:**

```typescript
const navigation = [
  // Primary - AI & Work
  { name: 'Command Center', href: '/ai', icon: Brain },
  { name: 'Daily Driver', href: '/daily', icon: ListTodo },
  
  // Communications
  { name: 'Communications', href: '/communications', icon: MessageSquare },
  { name: 'Support Cases', href: '/cases', icon: Ticket },
  
  // Products & Sales (PRIMARY)
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Companies', href: '/companies', icon: Building2 },
  
  // Scheduler
  { name: 'Scheduler', href: '/scheduler', icon: Calendar },
  
  // Legacy (keep but de-emphasize - move near bottom)
  { name: 'Legacy Deals', href: '/legacy-deals', icon: Archive },
];
```

**Key changes:**
1. Remove or rename 'Deals' entry to 'Legacy Deals'
2. Change href from '/deals' to '/legacy-deals'
3. Move it towards the bottom
4. Ensure 'Products' is prominently placed

**If the code uses separate arrays, consolidate or update accordingly.**

---

## Step 2: Update MobileNav

### File: `src/components/shared/MobileNav.tsx`

**Apply the same navigation changes as Sidebar.**

The structure should mirror the desktop sidebar. Find the navigation array and update it to match the changes made in Step 1.

---

## Step 3: Create Deals Page Redirect

### File: `src/app/(dashboard)/deals/page.tsx`

**Option A: Simple Redirect (Recommended for clean break)**

Replace the entire file content with:
```typescript
import { redirect } from 'next/navigation';

export default function DealsPage() {
  redirect('/products');
}
```

**Option B: Migration Notice (Better for user communication)**

Replace the entire file content with:
```typescript
import Link from 'next/link';
import { ArrowRight, Package, Archive } from 'lucide-react';

export default function DealsPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-6">
          <Package className="h-10 w-10 text-blue-600" />
        </div>
        
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          We've Upgraded to Product Pipelines
        </h1>
        
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          The deals pipeline has been replaced with a more powerful product-centric system.
          All your sales opportunities are now organized by product for better tracking and insights.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Go to Products
            <ArrowRight className="h-4 w-4" />
          </Link>
          
          <Link
            href="/legacy-deals"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium"
          >
            <Archive className="h-4 w-4" />
            Access Legacy Deals
          </Link>
        </div>
        
        <p className="text-sm text-gray-500 mt-8">
          Need help? Check out the{' '}
          <Link href="/docs/products" className="text-blue-600 hover:underline">
            product documentation
          </Link>{' '}
          or contact support.
        </p>
      </div>
    </div>
  );
}
```

---

## Step 4: Update Deal Detail Page

### File: `src/app/(dashboard)/deals/[id]/page.tsx`

**Option A: Redirect to Company (Recommended)**

Add redirect at the beginning of the component:
```typescript
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  
  // Try to find the deal and redirect to its company
  const { data: deal } = await supabase
    .from('deals')
    .select('company_id')
    .eq('id', id)
    .single();
  
  if (deal?.company_id) {
    redirect(`/companies/${deal.company_id}`);
  }
  
  // If deal not found or no company, redirect to products
  redirect('/products');
}
```

**Option B: Keep Page with Legacy Banner**

Add a banner at the top of the existing page content. Find where the page content starts (usually after auth checks) and add:

```typescript
// Add this after the deal data is loaded
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

// ... existing code ...

// In the return JSX, add at the very top:
return (
  <div className="space-y-6">
    {/* Legacy Banner */}
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-amber-800">
            <strong>Legacy View:</strong> This deal page uses the old system. 
            New opportunities should be managed in{' '}
            <Link href="/products" className="underline font-medium hover:text-amber-900">
              Products
            </Link>.
          </p>
        </div>
        {deal.company_id && (
          <Link
            href={`/companies/${deal.company_id}`}
            className="px-3 py-1.5 text-sm font-medium text-amber-800 bg-amber-100 rounded-lg hover:bg-amber-200"
          >
            View Company
          </Link>
        )}
      </div>
    </div>
    
    {/* Rest of existing page content */}
    ...
  </div>
);
```

---

## Step 5: Verify Company Page Shows Products

### File: `src/app/(dashboard)/companies/[id]/page.tsx`

**Verify that company_products are displayed prominently.**

Look for where products are rendered. It should be near the top of the page, not hidden at the bottom.

If products are not prominent, consider reordering the sections to show:
1. Company header
2. Products/Opportunities (should be high up)
3. Contacts
4. Activities
5. Other sections

**No code changes needed if products are already prominent.**

---

## Step 6: TypeScript Verification

```bash
npm run build
```

Fix any import errors or TypeScript issues.

---

## Step 7: UI Testing with Playwright MCP

**Test Navigation:**
```
1. Navigate to / (home or default route)
2. Take screenshot: "home-page"
3. Look at sidebar - verify "Products" is visible, "Deals" is removed/renamed
4. Take screenshot: "sidebar-navigation"
```

**Test Deals Redirect:**
```
1. Navigate to /deals
2. Wait for page to load/redirect
3. Take screenshot: "deals-page-redirect"
4. Verify you see either:
   - Products page (if redirect)
   - Migration notice (if notice page)
```

**Test Deal Detail Redirect:**
```
1. Navigate to /deals/[any-valid-deal-id]
2. Wait for redirect
3. Take screenshot: "deal-detail-redirect"
4. Verify redirect to company page or products
```

**Test Products Page:**
```
1. Navigate to /products
2. Take screenshot: "products-page"
3. Verify pipeline is visible
```

**Test Company Page:**
```
1. Navigate to /companies/[valid-company-id]
2. Take screenshot: "company-page"
3. Verify products section is visible
```

**Test Legacy Deals (if kept):**
```
1. Navigate to /legacy-deals
2. Take screenshot: "legacy-deals-page"
3. Verify old deals are accessible
```

---

## Step 8: Verify No Broken Links

**Check that all main navigation works:**

```
1. Click each sidebar link
2. Verify page loads without error
3. Take note of any broken links
```

**Expected working routes:**
- /ai ✓
- /daily ✓
- /products ✓
- /companies ✓
- /communications ✓
- /scheduler ✓
- /cases ✓
- /legacy-deals ✓
- /settings ✓

---

## Phase 5 Success Criteria

### ✅ Build Verification
```bash
npm run build
# Expected: Exit code 0
```

### ✅ Navigation Updated (Playwright MCP)
- Sidebar shows "Products" prominently
- "Deals" is removed or renamed to "Legacy Deals"
- "Legacy Deals" is accessible if kept

### ✅ Redirects Working (Playwright MCP)
- /deals redirects to /products OR shows migration notice
- /deals/[id] redirects to company page

### ✅ No Broken Links
- All sidebar navigation items work
- No 404 errors on main routes

---

## Commit Checkpoint

```bash
git add -A
git commit -m "Phase 5: UI navigation updated for product-centric experience

- Sidebar reorganized: Products prominent, Deals renamed to Legacy Deals
- /deals now redirects to /products (or shows migration notice)
- /deals/[id] redirects to company page
- Legacy Deals accessible at /legacy-deals
- MobileNav updated to match
- All navigation links verified working
- Company page prominently displays products"
```

---

## Update Checklist

Edit `docs/migration/MIGRATION_CHECKLIST.md`:
1. Mark Phase 5 as ✅ Complete
2. Record timestamp
3. Record commit hash
4. List screenshots taken
5. Note any issues

---

## Next Phase

```bash
cat docs/migration/PHASE_6_CLEANUP.md
```
