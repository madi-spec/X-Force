# Fix X-RAI Import

The X-RAI billing file has a complex structure. Here's a standalone script to import just X-RAI customers.

Create `scripts/import-xrai-customers.ts`:

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
  'Bronze': 'bronze',
};

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTING X-RAI CUSTOMERS');
  console.log('='.repeat(60));

  // Read the X-RAI billing file
  const filepath = path.join(DATA_DIR, 'X-RAI-Billing.xlsx');
  const workbook = XLSX.readFile(filepath);
  
  // Use the latest sheet (December '25)
  const sheetNames = workbook.SheetNames;
  console.log('Available sheets:', sheetNames);
  
  const latestSheet = sheetNames[sheetNames.length - 1];
  console.log('Using sheet:', latestSheet);
  
  const sheet = workbook.Sheets[latestSheet];
  
  // Read raw data to see structure
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  console.log('\nFirst 5 rows (raw):');
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    console.log(`Row ${i}:`, rawData[i]?.slice(0, 5));
  }
  
  // Find header row (contains 'ATS ID' or 'ATS Customer')
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, rawData.length); i++) {
    const row = rawData[i];
    if (row && (row.includes('ATS ID') || row.includes('ATS Customer'))) {
      headerRowIndex = i;
      break;
    }
  }
  
  console.log(`\nHeader row index: ${headerRowIndex}`);
  console.log('Headers:', rawData[headerRowIndex]);
  
  // Parse with correct header row
  const rows = XLSX.utils.sheet_to_json(sheet, { 
    range: headerRowIndex,
    defval: null 
  }) as any[];
  
  console.log(`\nParsed ${rows.length} data rows`);
  console.log('First row keys:', rows[0] ? Object.keys(rows[0]) : 'none');
  console.log('First row:', rows[0]);
  
  // Get product IDs
  const { data: products } = await supabase
    .from('products')
    .select('id, slug, name');
  
  console.log('\nProducts in DB:', products?.map(p => `${p.name} (${p.slug})`));
  
  const xrai1 = products?.find(p => p.slug === 'xrai-1');
  const xrai2 = products?.find(p => p.slug === 'xrai-2');
  
  if (!xrai1 || !xrai2) {
    console.error('X-RAI products not found in database!');
    console.log('Available products:', products);
    return;
  }
  
  console.log(`\nX-RAI 1.0 ID: ${xrai1.id}`);
  console.log(`X-RAI 2.0 ID: ${xrai2.id}`);
  
  // Get tiers
  const { data: tiers } = await supabase
    .from('product_tiers')
    .select('id, slug, product_id');
  
  console.log('\nTiers in DB:', tiers);
  
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  
  for (const row of rows) {
    // Try multiple possible column names
    const atsId = row['ATS ID'] || row['Unnamed: 0'];
    const customerName = row['ATS Customer'] || row['Unnamed: 1'];
    const packageType = row['x-rai package'] || row['Unnamed: 8'];
    const total = row['total'] || row['Unnamed: 27'] || row['Unnamed: 16'];
    const agents = row['Agents'] || row['Unnamed: 9'];
    const perfCenter = row['Performance Center'] || row['Unnamed: 11'];
    const actionHub = row['Action Hub'] || row['Unnamed: 13'];
    const accountHub = row['Accountability Hub'] || row['Unnamed: 12'];
    
    // Skip non-data rows
    if (!customerName || !atsId) {
      continue;
    }
    
    // Skip summary/total rows
    const skipPatterns = ['INVOICE', 'TOTAL', 'CANCELLATION', 'NEW ACCOUNTS', 'QUARTERLY', 'REV SHARE'];
    if (skipPatterns.some(p => String(customerName).toUpperCase().includes(p))) {
      skipped++;
      continue;
    }
    
    // Skip if ATS ID is not a number
    if (isNaN(Number(atsId))) {
      skipped++;
      continue;
    }
    
    console.log(`\nProcessing: ${customerName} (ATS: ${atsId})`);
    console.log(`  Package: ${packageType}, Agents: ${agents}, Total: ${total}`);
    
    // Find company by ATS ID
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('vfp_customer_id', String(atsId))
      .single();
    
    if (!company) {
      // Try by name
      const { data: byName } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', `%${customerName.replace(/[^a-zA-Z0-9\s]/g, '')}%`)
        .limit(1)
        .single();
      
      if (!byName) {
        console.log(`  ⚠️ Company not found: ${customerName}`);
        errors.push(`Company not found: ${customerName} (ATS: ${atsId})`);
        skipped++;
        continue;
      }
      
      console.log(`  Found by name: ${byName.name}`);
    }
    
    const companyId = company?.id;
    if (!companyId) {
      skipped++;
      continue;
    }
    
    // Determine product and tier
    let productId = xrai1.id;
    let tierSlug: string | null = null;
    const enabledModules: string[] = [];
    
    if (packageType === 'x-rai 2.0 Platform') {
      productId = xrai2.id;
      if (perfCenter && Number(perfCenter) > 0) enabledModules.push('performance-center');
      if (actionHub && Number(actionHub) > 0) enabledModules.push('action-hub');
      if (accountHub && Number(accountHub) > 0) enabledModules.push('accountability-hub');
      console.log(`  X-RAI 2.0 with modules: ${enabledModules.join(', ')}`);
    } else if (packageType && XRAI_TIER_MAP[packageType]) {
      tierSlug = XRAI_TIER_MAP[packageType];
      console.log(`  X-RAI 1.0 tier: ${tierSlug}`);
    }
    
    // Get tier ID
    let tierId: string | null = null;
    if (tierSlug && productId === xrai1.id) {
      const tier = tiers?.find(t => t.slug === tierSlug && t.product_id === xrai1.id);
      tierId = tier?.id || null;
    }
    
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
        .update({
          status: 'active',
          tier_id: tierId,
          enabled_modules: enabledModules.length > 0 ? enabledModules : null,
          seats: agents ? Number(agents) : null,
          mrr: total ? Number(total) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      
      console.log(`  ✓ Updated existing record`);
    } else {
      // Insert
      const { error } = await supabase
        .from('company_products')
        .insert({
          company_id: companyId,
          product_id: productId,
          status: 'active',
          tier_id: tierId,
          enabled_modules: enabledModules.length > 0 ? enabledModules : [],
          seats: agents ? Number(agents) : null,
          mrr: total ? Number(total) : null,
          activated_at: new Date().toISOString(),
        });
      
      if (error) {
        console.log(`  ❌ Insert error:`, error.message);
        errors.push(`Insert failed for ${customerName}: ${error.message}`);
        skipped++;
        continue;
      }
      
      console.log(`  ✓ Created new record`);
    }
    
    imported++;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }
  
  // Final counts
  const { data: xrai1Count } = await supabase
    .from('company_products')
    .select('id', { count: 'exact' })
    .eq('product_id', xrai1.id)
    .eq('status', 'active');
  
  const { data: xrai2Count } = await supabase
    .from('company_products')
    .select('id', { count: 'exact' })
    .eq('product_id', xrai2.id)
    .eq('status', 'active');
  
  console.log(`\nX-RAI 1.0 active customers: ${xrai1Count?.length || 0}`);
  console.log(`X-RAI 2.0 active customers: ${xrai2Count?.length || 0}`);
}

main().catch(console.error);
```

Run it:
```bash
npx ts-node scripts/import-xrai-customers.ts
```

This script:
1. Automatically finds the header row
2. Logs what it's seeing to help debug
3. Shows column names and sample data
4. Tries to match companies by ATS ID first, then by name
5. Reports detailed progress and errors
