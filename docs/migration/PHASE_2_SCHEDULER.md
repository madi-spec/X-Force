# Phase 2: Scheduler System Migration

## Objective

Update the scheduler system to use `company_product_id` instead of (or alongside) `deal_id`. The scheduler should be able to create meetings linked to company_products and display product context.

## Pre-Flight Check

**Verify Phase 1 is complete:**

```bash
# Check Phase 1 in checklist
grep -A5 "Phase 1:" docs/migration/MIGRATION_CHECKLIST.md
```

**Use Postgres MCP to verify:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'scheduling_requests' AND column_name = 'company_product_id';
```
Expected: 1 row

**Verify build is clean:**
```bash
npm run build
```

**Do not proceed if Phase 1 is incomplete.**

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/scheduler/types.ts` | Add company_product_id to type definitions |
| `src/lib/scheduler/events.ts` | Add company_product_id to event types |
| `src/app/api/scheduler/requests/route.ts` | Accept company_product_id in POST |
| `src/app/api/scheduler/quick-book/route.ts` | Accept company_product_id |
| `src/app/api/scheduler/requests/[id]/route.ts` | Return company_product_id |
| `src/components/scheduler/QuickBookModal.tsx` | Add product selection UI |
| `src/components/scheduler/SchedulingRequestDetailModal.tsx` | Show product info |

---

## Step 1: Update Type Definitions

### File: `src/lib/scheduler/types.ts`

**Find and update these interfaces:**

**1. CreateSchedulingRequestInput** - Find this interface and add:
```typescript
export interface CreateSchedulingRequestInput {
  // ... existing fields
  deal_id?: string;
  company_product_id?: string;  // ADD THIS LINE
  // ... rest of fields
}
```

**2. UpdateSchedulingRequestInput** - Find and add:
```typescript
export interface UpdateSchedulingRequestInput {
  // ... existing fields
  deal_id?: string | null;
  company_product_id?: string | null;  // ADD THIS LINE
  // ... rest of fields
}
```

**3. SchedulingRequestSummary** - Find and add:
```typescript
export interface SchedulingRequestSummary {
  // ... existing fields
  company_product_id?: string | null;  // ADD THIS
  product_name?: string | null;         // ADD THIS
  product_status?: string | null;       // ADD THIS
}
```

**4. If there's a SchedulingRequest interface, add:**
```typescript
company_product_id?: string | null;
```

---

## Step 2: Update Event Types

### File: `src/lib/scheduler/events.ts`

**1. Find SchedulingRequestedEvent interface and update event_data:**
```typescript
export interface SchedulingRequestedEvent extends LifecycleEvent<'SchedulingRequested'> {
  event_data: {
    scheduling_request_id: string;
    work_item_id: string;
    company_id: string;
    company_name: string;
    contact_id?: string;
    contact_name?: string;
    contact_email?: string;
    deal_id?: string;
    company_product_id?: string;  // ADD THIS LINE
    meeting_type: MeetingType;
    duration_minutes: number;
    context?: string;
    triggered_by_signal_type?: string;
    trigger_communication_id?: string;
  };
}
```

**2. Find SchedulerPrefillContext interface and add:**
```typescript
export interface SchedulerPrefillContext {
  companyId: string;
  companyName: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  dealId?: string;
  companyProductId?: string;  // ADD THIS
  productName?: string;       // ADD THIS
  suggestedMeetingType: MeetingType;
  suggestedDuration: number;
  context: string;
  triggerCommunicationId?: string;
}
```

**3. Find extractSchedulerContext function and update:**

Look for where it extracts dealId and add similar logic for companyProductId:
```typescript
// After: const dealId = workItem.metadata?.deal_id as string | undefined;
const companyProductId = workItem.metadata?.company_product_id as string | undefined;
const productName = workItem.metadata?.product_name as string | undefined;
```

And include in the return object:
```typescript
return {
  // ... existing fields
  dealId,
  companyProductId,  // ADD THIS
  productName,       // ADD THIS
  // ... rest of fields
};
```

---

## Step 3: Update API - Create Scheduling Request

### File: `src/app/api/scheduler/requests/route.ts`

**In the POST handler:**

**1. Update body destructuring:**
```typescript
const {
  meeting_type,
  duration_minutes,
  title,
  // ... other existing fields
  deal_id,
  company_product_id,  // ADD THIS
  company_id,
  // ... rest of fields
} = body;
```

**2. Update the insert statement to include company_product_id:**
```typescript
const { data: request, error } = await supabase
  .from('scheduling_requests')
  .insert({
    // ... existing fields
    deal_id: deal_id || null,
    company_product_id: company_product_id || null,  // ADD THIS
    company_id: company_id || null,
    // ... rest of fields
  })
  .select(`
    *,
    company:companies(id, name),
    company_product:company_products(
      id,
      status,
      product:products(id, name, slug, color)
    )
  `)
  .single();
```

---

## Step 4: Update API - Quick Book

### File: `src/app/api/scheduler/quick-book/route.ts`

**1. Find where body is destructured and add:**
```typescript
const {
  meeting_type,
  duration_minutes,
  title,
  meeting_platform,
  meeting_location,
  scheduled_time,
  deal_id,
  company_product_id,  // ADD THIS
  company_id,
  internal_attendees,
  external_attendees,
} = body;
```

**2. Find the scheduling_requests insert and add:**
```typescript
const { data: schedulingRequest, error: requestError } = await adminSupabase
  .from('scheduling_requests')
  .insert({
    // ... existing fields
    deal_id: deal_id || null,
    company_product_id: company_product_id || null,  // ADD THIS
    company_id: company_id || null,
    // ... rest
  })
  .select()
  .single();
```

---

## Step 5: Update API - Get/Update Request

### File: `src/app/api/scheduler/requests/[id]/route.ts`

**Find the GET handler and update the select query:**
```typescript
const { data: schedulingRequest, error } = await supabase
  .from('scheduling_requests')
  .select(`
    *,
    attendees:scheduling_attendees(*),
    company:companies(id, name),
    company_product:company_products(
      id,
      status,
      mrr,
      product:products(id, name, slug, color)
    )
  `)
  .eq('id', id)
  .single();
```

---

## Step 6: Update QuickBookModal Component

### File: `src/components/scheduler/QuickBookModal.tsx`

This is the main UI component. Make these changes:

**1. Add interface for CompanyProduct (near other interfaces):**
```typescript
interface CompanyProduct {
  id: string;
  status: string;
  product: {
    id: string;
    name: string;
    slug: string;
  } | null;
}
```

**2. Add state for company products (with other state declarations):**
```typescript
const [companyProductId, setCompanyProductId] = useState(initialCompanyProductId || '');
const [companyProducts, setCompanyProducts] = useState<CompanyProduct[]>([]);
```

**3. Add props if needed:**
Check if the component accepts initialCompanyProductId prop. If not, add it:
```typescript
interface QuickBookModalProps {
  // ... existing props
  companyProductId?: string;  // ADD if not present
}
```

**4. Add useEffect to fetch company products when company changes:**
```typescript
// Add after other useEffects that depend on companyId
useEffect(() => {
  async function fetchCompanyProducts() {
    if (!companyId) {
      setCompanyProducts([]);
      return;
    }
    
    const { data } = await supabase
      .from('company_products')
      .select(`
        id,
        status,
        product:products(id, name, slug)
      `)
      .eq('company_id', companyId)
      .in('status', ['in_sales', 'in_onboarding', 'active'])
      .order('updated_at', { ascending: false });
    
    setCompanyProducts(data || []);
  }
  
  fetchCompanyProducts();
}, [companyId]);
```

**5. Add product selector UI after company selector (find the company selector JSX and add after it):**
```typescript
{/* Product Selection - Add after company selection */}
{companyProducts.length > 0 && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Product (Optional)
    </label>
    <select
      value={companyProductId}
      onChange={(e) => setCompanyProductId(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
    >
      <option value="">No specific product</option>
      {companyProducts.map((cp) => {
        const product = Array.isArray(cp.product) ? cp.product[0] : cp.product;
        return (
          <option key={cp.id} value={cp.id}>
            {product?.name || 'Unknown'} ({cp.status.replace('_', ' ')})
          </option>
        );
      })}
    </select>
  </div>
)}
```

**6. Update the submit handler to include company_product_id:**
Find the fetch call and add company_product_id to the body:
```typescript
const response = await fetch('/api/scheduler/quick-book', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // ... existing fields
    deal_id: dealId || undefined,
    company_product_id: companyProductId || undefined,  // ADD THIS
    company_id: companyId || undefined,
    // ... rest
  }),
});
```

---

## Step 7: Update Detail Modal

### File: `src/components/scheduler/SchedulingRequestDetailModal.tsx`

**Find where company info is displayed and add product display below it:**

```typescript
{/* Company Product - Add after company display */}
{request.company_product && (
  <div className="space-y-1">
    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
      Product
    </label>
    <div className="flex items-center gap-2">
      {request.company_product.product?.color && (
        <span 
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: request.company_product.product.color }}
        />
      )}
      <span className="text-sm text-gray-900">
        {request.company_product.product?.name || 'Unknown Product'}
      </span>
      <span className={cn(
        'text-xs px-2 py-0.5 rounded-full',
        request.company_product.status === 'active' && 'bg-green-100 text-green-700',
        request.company_product.status === 'in_sales' && 'bg-yellow-100 text-yellow-700',
        request.company_product.status === 'in_onboarding' && 'bg-blue-100 text-blue-700'
      )}>
        {request.company_product.status?.replace('_', ' ')}
      </span>
    </div>
  </div>
)}
```

**Note:** Make sure `cn` utility is imported. If not, add:
```typescript
import { cn } from '@/lib/utils';
```

---

## Step 8: TypeScript Verification

```bash
npm run build
```

**Fix any errors before proceeding:**
- Missing imports: Add the import
- Type errors: Check the interface definitions
- Null safety: Add optional chaining (?.) where needed

---

## Step 9: UI Testing with Playwright MCP

**Use Playwright MCP to verify the UI changes:**

```
1. Navigate to a page with scheduler (e.g., /scheduler or /work)
2. Open the QuickBookModal (click appropriate button)
3. Take screenshot: "scheduler-quickbook-initial"
4. Select a company that has company_products
5. Wait for product dropdown to appear
6. Take screenshot: "scheduler-quickbook-with-products"
7. Select a product from dropdown
8. Take screenshot: "scheduler-quickbook-product-selected"
9. Close modal (to avoid creating test data)
```

**Record screenshot names in checklist.**

---

## Step 10: API Testing

**Test the API accepts company_product_id:**

First, get valid IDs from database using Postgres MCP:
```sql
SELECT c.id as company_id, cp.id as company_product_id 
FROM companies c 
JOIN company_products cp ON cp.company_id = c.id 
LIMIT 1;
```

Then test the API (adjust IDs):
```bash
curl -X POST http://localhost:3000/api/scheduler/requests \
  -H "Content-Type: application/json" \
  -H "Cookie: [your-auth-cookie]" \
  -d '{
    "meeting_type": "discovery",
    "duration_minutes": 30,
    "company_id": "[COMPANY_ID_FROM_QUERY]",
    "company_product_id": "[COMPANY_PRODUCT_ID_FROM_QUERY]",
    "date_range_start": "2025-01-06",
    "date_range_end": "2025-01-10",
    "timezone": "America/New_York"
  }'
```

**Verify with Postgres MCP:**
```sql
SELECT id, company_id, company_product_id, meeting_type, created_at
FROM scheduling_requests
WHERE company_product_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 3;
```

---

## Phase 2 Success Criteria

**ALL must pass:**

### ✅ Type Verification
```bash
npm run build
# Expected: Exit code 0, no errors
```

### ✅ Database Verification (Postgres MCP)
```sql
-- New requests can have company_product_id
SELECT COUNT(*) FROM scheduling_requests WHERE company_product_id IS NOT NULL;
-- Should be >= 0 (will increase after testing)
```

### ✅ UI Verification (Playwright MCP)
- QuickBookModal loads without errors
- Product dropdown appears when company with products is selected
- Product can be selected from dropdown

### ✅ API Verification
- POST /api/scheduler/requests accepts company_product_id
- GET /api/scheduler/requests/[id] returns company_product info

---

## Commit Checkpoint

```bash
git add -A
git commit -m "Phase 2: Scheduler system now supports company_product_id

- Updated scheduler types: CreateSchedulingRequestInput, UpdateSchedulingRequestInput,
  SchedulingRequestSummary with company_product_id
- Updated scheduler events: SchedulingRequestedEvent, SchedulerPrefillContext
- API endpoints accept and return company_product_id
- QuickBookModal shows product selection dropdown when company has products
- SchedulingRequestDetailModal displays product information
- Backwards compatible - deal_id still supported"
```

---

## Update Checklist

Edit `docs/migration/MIGRATION_CHECKLIST.md`:
1. Mark Phase 2 as ✅ Complete
2. Record timestamp
3. Record commit hash
4. List screenshots taken
5. Note any issues encountered

---

## Next Phase

```bash
cat docs/migration/PHASE_3_COMMAND_CENTER.md
```
