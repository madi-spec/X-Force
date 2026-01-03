/* eslint-disable @typescript-eslint/no-require-imports */
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');

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
  'Bronze': 'bronze',
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

  // Try to find by name (exact match, case-insensitive)
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
        .update({
          vfp_customer_id: String(atsId),
          customer_type: customerType,
          ...extraData
        })
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
      segment: 'smb', // Default segment
      industry: 'pest', // Default industry for VFP/VFT customers (enum: pest, lawn, both)
      status: 'customer', // Default status for imported customers (enum: cold_lead, prospect, customer, churned)
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

    // Determine customer type and industry
    let customerType: 'prospect' | 'vfp_customer' | 'vft_customer' = 'prospect';
    let productId: string | null = null;
    let industry: 'pest' | 'lawn' | 'both' = 'pest';

    if (verticalMarket.includes('Voice for Pest')) {
      customerType = 'vfp_customer';
      productId = vfpProductId;
      industry = 'pest';
    } else if (verticalMarket.includes('Voice for Turf')) {
      customerType = 'vft_customer';
      productId = vftProductId;
      industry = 'lawn';
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
        industry,
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
  const sheetNames = workbook.SheetNames.filter((s: string) => !s.includes('EXCLUDED'));
  const latestSheet = sheetNames[sheetNames.length - 1];
  console.log(`  Using sheet: ${latestSheet}`);
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
  console.log(`  Using sheet: ${latestSheet}`);
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
  console.log(`  Using sheet: ${latestSheet}`);

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
        String(customerName).includes('CANCELLATION') || String(customerName).includes('NEW ACCOUNTS') ||
        String(customerName).includes('QUARTERLY') || String(customerName).includes('REV SHARE')) {
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
    let productId: string | null = xrai1ProductId;
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
  for (const [product, count] of Object.entries(productCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${product}: ${count}`);
  }
}

main().catch(console.error);
