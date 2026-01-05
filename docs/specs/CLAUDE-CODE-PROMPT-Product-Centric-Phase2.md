# Product-Centric Redesign: Phase 2 - Data Import

## Context

Read these first:
- `/docs/specs/X-FORCE-CRM-Project-State.md`
- `/docs/specs/X-FORCE-Product-Centric-Redesign-Spec.md`

Phase 1 is complete - database tables and Products page exist.

## Data Analysis Summary

We have 5 data sources:

| File | Content | Records |
|------|---------|---------|
| **KEEP** (sheet 'in') | Full VFP/VFT customer list | 1,487 |
| **Summary Note Billing** | AI Call Summaries+ @ $0.08 | ~84 |
| **Summary Billing** | AI Call Summaries @ $0.03229 | ~195 |
| **X-RAI Billing** | X-RAI 1.0/2.0 customers | ~51 |
| **Call Volume** | Call metrics per customer | 1,371 |

### Product Mapping

| Billing Service | Maps To Product | Notes |
|-----------------|-----------------|-------|
| Voice for Pest/Turf (KEEP) | `vfp` / `vft` | Base customer type |
| AI Call Summaries+ @ $0.08 | `smart-data-plus` | Premium tier |
| AI Call Summaries @ $0.03229 | `summary-note` | Standard tier |
| x-rai Basic/Pro/Silver/Gold/Platinum | `xrai-1` | First gen platform |
| x-rai 2.0 Platform | `xrai-2` | Next gen with modules |

### X-RAI Tier Mapping

| Billing Tier | Product | Tier |
|--------------|---------|------|
| Basic | xrai-1 | Silver |
| Pro | xrai-1 | Gold |
| Enterprise | xrai-1 | Platinum |
| Silver | xrai-1 | Silver |
| Gold | xrai-1 | Gold |
| Platinum | xrai-1 | Platinum |
| x-rai 2.0 Platform | xrai-2 | (no tier) |
| CUSTOM | xrai-1 | Platinum |

---

## Phase 2 Tasks

### Task 1: Verify Data Files

Data files should already be in `data/imports/`:

```
C:\users\tmort\x-force\data\imports\
├── KEEP-VFP-Customers.xlsx         (VFP/VFT customer list, use sheet 'in')
├── Smart-Data-Plus-Billing.xlsx    (Smart Data Plus @ $0.08)
├── Summary-Note-Billing.xlsx       (Summary Note @ $0.032)
├── X-RAI-Billing.xlsx              (X-RAI customers)
└── Call-Volume.xlsx                (Call metrics - optional)
```

Verify they exist:
```bash
ls -la data/imports/
```

### Task 2: Install Excel Reading Package

```bash
npm install xlsx
```

### Task 3: Create Import Script

Create `scripts/import-customer-data.ts`:

```typescript
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// CONFIGURATION
// ============================================

const DATA_DIR = path.join(process.cwd(), 'data', 'imports');

// X-RAI tier mapping
const XRAI_TIER_MAP: Record<string, string> = {
  'Basic': 'silver',
  'Pro': 'gold',
  'Enterprise': 'platinum',
  'Silver': 'silver',
  'Gold': 'gold',
  'Platinum': 'platinum',
  'CUSTOM': 'platinum',
  'Bronze': 'silver',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function readExcel(filename: string, sheetName?: string): any[] {
  const filepath = path.join(DATA_DIR, filename);
  const workbook = XLSX.readFile(filepath);
  const sheet = sheetName 
    ? workbook.Sheets[sheetName] 
    : workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

function normalizeCompanyName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ');
}

async function findOrCreateCompany(
  name: string, 
  atsId: string | number | null,
  customerType: 'prospect' | 'vfp_customer' | 'vft_customer' = 'prospect',
  extraData: Record<string, any> = {}
): Promise<string | null> {
  const normalizedName = normalizeCompanyName(name);
  if (!normalizedName) return null;
  
  // Try to find by ATS ID first
  if (atsId) {
    const { data: byAts } = await supabase
      .from('companies')
      .select('id')
      .eq('vfp_customer_id', String(atsId))
      .single();
    
    if (byAts) return byAts.id;
  }
  
  // Try to find by name (fuzzy match)
  const { data: byName } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', normalizedName)
    .limit(1)
    .single();
  
  if (byName) {
    // Update with ATS ID if we have it
    if (atsId) {
      await supabase
        .from('companies')
        .update({ vfp_customer_id: String(atsId), ...extraData })
        .eq('id', byName.id);
    }
    return byName.id;
  }
  
  // Create new company
  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert({
      name: normalizedName,
      customer_type: customerType,
      vfp_customer_id: atsId ? String(atsId) : null,
      ...extraData,
    })
    .select('id')
    .single();
  
  if (error) {
    console.error(`Failed to create company: ${normalizedName}`, error);
    return null;
  }
  
  return newCompany.id;
}

async function getProductId(slug: string): Promise<string | null> {
  const { data } = await supabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single();
  return data?.id || null;
}

async function getTierId(productId: string, tierSlug: string): Promise<string | null> {
  const { data } = await supabase
    .from('product_tiers')
    .select('id')
    .eq('product_id', productId)
    .eq('slug', tierSlug)
    .single();
  return data?.id || null;
}

async function createCompanyProduct(
  companyId: string,
  productId: string,
  status: string = 'active',
  extraData: Record<string, any> = {}
): Promise<boolean> {
  // Check if already exists
  const { data: existing } = await supabase
    .from('company_products')
    .select('id')
    .eq('company_id', companyId)
    .eq('product_id', productId)
    .single();
  
  if (existing) {
    // Update
    await supabase
      .from('company_products')
      .update({ status, ...extraData, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    return true;
  }
  
  // Insert
  const { error } = await supabase
    .from('company_products')
    .insert({
      company_id: companyId,
      product_id: productId,
      status,
      activated_at: status === 'active' ? new Date().toISOString() : null,
      ...extraData,
    });
  
  if (error) {
    console.error(`Failed to create company_product:`, error);
    return false;
  }
  
  return true;
}

// ============================================
// IMPORT FUNCTIONS
// ============================================

async function importVFPCustomers() {
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTING VFP/VFT CUSTOMERS');
  console.log('='.repeat(60));
  
  const rows = readExcel('KEEP-VFP-Customers.xlsx', 'in');
  
  let imported = 0;
  let skipped = 0;
  
  const vfpProductId = await getProductId('vfp');
  const vftProductId = await getProductId('vft');
  
  for (const row of rows) {
    const customerName = row['Customer Name'];
    const revId = row['Rev ID'];
    const verticalMarket = row['Vertical Market'];
    const supportRep = row['Customer Success Rep'];
    const revenue = row['Total Monthly Revenue (Pre Tax)'];
    
    if (!customerName || !verticalMarket) {
      skipped++;
      continue;
    }
    
    // Determine customer type
    let customerType: 'prospect' | 'vfp_customer' | 'vft_customer' = 'prospect';
    let productId: string | null = null;
    
    if (verticalMarket.includes('Voice for Pest')) {
      customerType = 'vfp_customer';
      productId = vfpProductId;
    } else if (verticalMarket.includes('Voice for Turf')) {
      customerType = 'vft_customer';
      productId = vftProductId;
    } else if (verticalMarket === 'ATS' || verticalMarket === 'ATS/Networking' || verticalMarket === 'Networking') {
      // ATS customers - not VFP
      skipped++;
      continue;
    }
    
    // Create/find company
    const companyId = await findOrCreateCompany(
      customerName,
      revId,
      customerType,
      {
        vfp_support_contact: supportRep,
        became_customer_at: new Date().toISOString(),
      }
    );
    
    if (!companyId) {
      skipped++;
      continue;
    }
    
    // Create company_product for VFP/VFT
    if (productId) {
      await createCompanyProduct(companyId, productId, 'active', {
        mrr: revenue || null,
      });
    }
    
    imported++;
    if (imported % 100 === 0) {
      console.log(`  Processed ${imported} customers...`);
    }
  }
  
  console.log(`\n✓ Imported ${imported} VFP/VFT customers`);
  console.log(`  Skipped ${skipped} (ATS or invalid)`);
}

async function importSummaryNoteCustomers() {
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTING SUMMARY NOTE CUSTOMERS (AI Call Summaries @ $0.032)');
  console.log('='.repeat(60));
  
  // Read latest sheet from Summary Billing (the $0.032 one)
  const workbook = XLSX.readFile(path.join(DATA_DIR, 'Summary-Note-Billing.xlsx'));
  const sheetNames = workbook.SheetNames.filter(s => !s.includes('EXCLUDED'));
  const latestSheet = sheetNames[sheetNames.length - 1];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[latestSheet], { defval: null });
  
  const productId = await getProductId('summary-note');
  if (!productId) {
    console.error('Summary Note product not found!');
    return;
  }
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows as any[]) {
    const atsId = row['ATS ID'];
    const customerName = row['ATS Customer'];
    const total = row['Total'];
    const qty = row['QTY'];
    
    if (!customerName || !atsId) {
      skipped++;
      continue;
    }
    
    // Find company (should already exist from VFP import)
    const companyId = await findOrCreateCompany(customerName, atsId, 'vfp_customer');
    
    if (!companyId) {
      skipped++;
      continue;
    }
    
    // Create company_product
    await createCompanyProduct(companyId, productId, 'active', {
      mrr: total || null,
      notes: `Monthly volume: ${qty} calls`,
    });
    
    imported++;
  }
  
  console.log(`\n✓ Imported ${imported} Summary Note customers`);
  console.log(`  Skipped ${skipped}`);
}

async function importSmartDataPlusCustomers() {
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTING SMART DATA PLUS CUSTOMERS (AI Call Summaries+ @ $0.08)');
  console.log('='.repeat(60));
  
  // Read latest sheet from Note Billing (the $0.08 one)
  const workbook = XLSX.readFile(path.join(DATA_DIR, 'Smart-Data-Plus-Billing.xlsx'));
  const latestSheet = workbook.SheetNames[workbook.SheetNames.length - 1];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[latestSheet], { defval: null });
  
  const productId = await getProductId('smart-data-plus');
  if (!productId) {
    console.error('Smart Data Plus product not found!');
    return;
  }
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows as any[]) {
    const atsId = row['ATS ID'];
    const customerName = row['ATS Customer'];
    const total = row['Total'];
    const qty = row['QTY'];
    
    if (!customerName || !atsId) {
      skipped++;
      continue;
    }
    
    // Find company
    const companyId = await findOrCreateCompany(customerName, atsId, 'vfp_customer');
    
    if (!companyId) {
      skipped++;
      continue;
    }
    
    // Create company_product
    await createCompanyProduct(companyId, productId, 'active', {
      mrr: total || null,
      notes: `Monthly volume: ${qty} calls`,
    });
    
    imported++;
  }
  
  console.log(`\n✓ Imported ${imported} Smart Data Plus customers`);
  console.log(`  Skipped ${skipped}`);
}

async function importXRAICustomers() {
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTING X-RAI CUSTOMERS');
  console.log('='.repeat(60));
  
  // Read latest sheet
  const workbook = XLSX.readFile(path.join(DATA_DIR, 'X-RAI-Billing.xlsx'));
  const latestSheet = workbook.SheetNames[workbook.SheetNames.length - 1];
  
  // Read with header row at index 1
  const sheet = workbook.Sheets[latestSheet];
  const rows = XLSX.utils.sheet_to_json(sheet, { 
    defval: null,
    range: 1  // Skip first row, use second as header
  });
  
  const xrai1ProductId = await getProductId('xrai-1');
  const xrai2ProductId = await getProductId('xrai-2');
  
  if (!xrai1ProductId || !xrai2ProductId) {
    console.error('X-RAI products not found!');
    return;
  }
  
  let imported = 0;
  let skipped = 0;
  
  for (const row of rows as any[]) {
    // Handle column name variations
    const atsId = row['ATS ID'] || row['Unnamed: 0'];
    const customerName = row['ATS Customer'] || row['Unnamed: 1'];
    const packageType = row['x-rai package'] || row['Unnamed: 8'];
    const total = row['total'] || row['Unnamed: 27'];
    const agents = row['Agents'] || row['Unnamed: 9'];
    const perfCenter = row['Performance Center'] || row['Unnamed: 11'];
    const actionHub = row['Action Hub'] || row['Unnamed: 13'];
    const accountHub = row['Accountability Hub'] || row['Unnamed: 12'];
    
    // Skip summary rows
    if (!customerName || customerName === 'INVOICE TOTAL' || customerName === 'TOTAL' || 
        customerName.includes('CANCELLATION') || customerName.includes('NEW ACCOUNTS') ||
        customerName.includes('QUARTERLY') || customerName.includes('REV SHARE')) {
      skipped++;
      continue;
    }
    
    // Skip if no ATS ID
    if (!atsId || isNaN(Number(atsId))) {
      skipped++;
      continue;
    }
    
    // Find company
    const companyId = await findOrCreateCompany(customerName, atsId, 'vfp_customer');
    
    if (!companyId) {
      skipped++;
      continue;
    }
    
    // Determine product and tier
    let productId = xrai1ProductId;
    let tierSlug: string | null = null;
    const enabledModules: string[] = [];
    
    if (packageType === 'x-rai 2.0 Platform') {
      productId = xrai2ProductId;
      // Check which modules are enabled
      if (perfCenter && perfCenter > 0) enabledModules.push('performance-center');
      if (actionHub && actionHub > 0) enabledModules.push('action-hub');
      if (accountHub && accountHub > 0) enabledModules.push('accountability-hub');
    } else if (packageType && XRAI_TIER_MAP[packageType]) {
      tierSlug = XRAI_TIER_MAP[packageType];
    }
    
    // Get tier ID if applicable
    let tierId: string | null = null;
    if (tierSlug && productId === xrai1ProductId) {
      tierId = await getTierId(xrai1ProductId, tierSlug);
    }
    
    // Create company_product
    await createCompanyProduct(companyId, productId, 'active', {
      tier_id: tierId,
      enabled_modules: enabledModules,
      seats: agents ? Number(agents) : null,
      mrr: total || null,
    });
    
    imported++;
  }
  
  console.log(`\n✓ Imported ${imported} X-RAI customers`);
  console.log(`  Skipped ${skipped}`);
}

async function importCallVolume() {
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTING CALL VOLUME DATA');
  console.log('='.repeat(60));
  
  const rows = readExcel('Call-Volume.xlsx');
  
  let updated = 0;
  let skipped = 0;
  
  for (const row of rows) {
    const customerName = row['Customer Name'];
    const calls = row['Calls'];
    const mins = row['Mins'];
    const avg = row['Avg'];
    
    if (!customerName) {
      skipped++;
      continue;
    }
    
    // Find company by name (partial match)
    const normalizedName = normalizeCompanyName(customerName);
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .ilike('name', `%${normalizedName}%`)
      .limit(1)
      .single();
    
    if (!company) {
      skipped++;
      continue;
    }
    
    // Update company with call volume data (you could add these columns to companies table)
    // For now, just log
    updated++;
  }
  
  console.log(`\n✓ Matched ${updated} companies with call volume data`);
  console.log(`  Skipped ${skipped} (no match)`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('PRODUCT-CENTRIC DATA IMPORT');
  console.log('='.repeat(60));
  
  // Import in order
  await importVFPCustomers();
  await importSummaryNoteCustomers();    // $0.032 tier
  await importSmartDataPlusCustomers();  // $0.08 tier
  await importXRAICustomers();
  // await importCallVolume(); // Optional - uncomment if needed
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(60));
  
  // Get counts
  const { count: companyCount } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });
  
  const { count: cpCount } = await supabase
    .from('company_products')
    .select('*', { count: 'exact', head: true });
  
  const { data: byProduct } = await supabase
    .from('company_products')
    .select('product_id, products(name)')
    .eq('status', 'active');
  
  console.log(`\nTotal companies: ${companyCount}`);
  console.log(`Total company_products: ${cpCount}`);
  
  // Count by product
  const productCounts: Record<string, number> = {};
  for (const cp of byProduct || []) {
    const productName = (cp.products as any)?.name || 'Unknown';
    productCounts[productName] = (productCounts[productName] || 0) + 1;
  }
  
  console.log('\nActive customers by product:');
  for (const [product, count] of Object.entries(productCounts)) {
    console.log(`  ${product}: ${count}`);
  }
}

main().catch(console.error);
```

### Task 4: Add X-RAI 1.0 Tiers (if not already seeded)

The Phase 1 seed may have missed some tiers. Run this to ensure they exist:

```sql
-- Ensure X-RAI 1.0 tiers exist
INSERT INTO product_tiers (product_id, name, slug, display_order, price_monthly)
SELECT 
  (SELECT id FROM products WHERE slug = 'xrai-1'),
  tier.name,
  tier.slug,
  tier.display_order,
  tier.price
FROM (VALUES 
  ('Bronze', 'bronze', 0, 499),
  ('Silver', 'silver', 1, 999),
  ('Gold', 'gold', 2, 1999),
  ('Platinum', 'platinum', 3, 2999)
) AS tier(name, slug, display_order, price)
WHERE NOT EXISTS (
  SELECT 1 FROM product_tiers 
  WHERE product_id = (SELECT id FROM products WHERE slug = 'xrai-1')
  AND slug = tier.slug
);
```

### Task 5: Run the Import

```bash
npx ts-node scripts/import-customer-data.ts
```

### Task 6: Verify Import

Check the data in Supabase:

```sql
-- Company counts by type
SELECT customer_type, COUNT(*) 
FROM companies 
GROUP BY customer_type;

-- Company products by product and status
SELECT 
  p.name as product,
  cp.status,
  COUNT(*) as count
FROM company_products cp
JOIN products p ON cp.product_id = p.id
GROUP BY p.name, cp.status
ORDER BY p.name, cp.status;

-- X-RAI customers by tier
SELECT 
  pt.name as tier,
  COUNT(*) as count
FROM company_products cp
JOIN product_tiers pt ON cp.tier_id = pt.id
WHERE cp.product_id = (SELECT id FROM products WHERE slug = 'xrai-1')
GROUP BY pt.name;

-- X-RAI 2.0 customers with modules
SELECT 
  c.name as company,
  cp.enabled_modules,
  cp.seats
FROM company_products cp
JOIN companies c ON cp.company_id = c.id
WHERE cp.product_id = (SELECT id FROM products WHERE slug = 'xrai-2');
```

### Task 7: Visit Products Page

Navigate to `/products` - you should now see:

- **Voice for Pest**: ~1000+ active
- **Voice for Turf**: ~100+ active  
- **Summary Note**: ~195 active (AI Call Summaries @ $0.032)
- **Smart Data Plus**: ~84 active (AI Call Summaries+ @ $0.08)
- **X-RAI 1.0**: ~45+ active (with tier breakdown)
- **X-RAI 2.0**: ~2-3 active (Gecko Green, Burgess Pest)

---

## Handling Existing Deals

If you have deals in the system that should be mapped to product sales:

### Task 8: Analyze Existing Deals

```sql
-- Check existing deals
SELECT 
  d.id,
  d.name,
  d.stage,
  d.status,
  c.name as company
FROM deals d
JOIN companies c ON d.company_id = c.id
LIMIT 50;
```

### Task 9: Create Deal Migration Script (Optional)

Create `scripts/migrate-deals-to-products.ts` if needed:

```typescript
// This would analyze deal names/notes to determine which product they're for
// Then create company_products records with status='in_sales' and appropriate stage
// For now, manual review recommended since deal data may be sparse
```

---

## Success Criteria

- [ ] VFP/VFT customers imported (1000+)
- [ ] Summary Note customers imported (~195) - the $0.032 tier
- [ ] Smart Data Plus customers imported (~84) - the $0.08 tier
- [ ] X-RAI 1.0 customers imported with tiers (~45)
- [ ] X-RAI 2.0 customers imported with modules (~2-3)
- [ ] Products page shows accurate counts
- [ ] No duplicate company_products records
- [ ] TypeScript compiles clean

---

## Troubleshooting

### "Product not found" errors
Run the Phase 1 seed SQL again to ensure products exist.

### Duplicate companies
The script tries to match by ATS ID first, then by name. If duplicates occur, run:
```sql
-- Find duplicates
SELECT name, COUNT(*) FROM companies GROUP BY name HAVING COUNT(*) > 1;
```

### Missing X-RAI data
The X-RAI billing sheet has a complex format. If data is missing, check:
- Sheet name (should be latest month)
- Column indices (header row is at index 1)
