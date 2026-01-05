import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.argv.includes('--dry-run');

interface BillingCustomer {
  atsId: string;
  customerName: string;
}

// Map billing spreadsheet to product slug
const billingToProduct: Record<string, string> = {
  'X-RAI-Billing.xlsx': 'xrai-1',
  'Summary-Note-Billing.xlsx': 'summary-note',
  'Smart-Data-Plus-Billing.xlsx': 'smart-data-plus'
};

async function syncBillingProducts() {
  console.log('=== Sync Billing Products to Company Products ===');
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Get all companies with ATS IDs
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('id, name, ats_id')
    .not('ats_id', 'is', null);

  if (companyError) {
    console.log('Error fetching companies:', companyError.message);
    return;
  }

  console.log(`Found ${companies.length} companies with ATS IDs\n`);

  // Build a map of ATS ID to companies (multiple companies can share an ATS ID)
  const atsToCompanies = new Map<string, Array<{ id: string; name: string }>>();
  companies.forEach(c => {
    if (c.ats_id) {
      if (!atsToCompanies.has(c.ats_id)) {
        atsToCompanies.set(c.ats_id, []);
      }
      atsToCompanies.get(c.ats_id)!.push({ id: c.id, name: c.name });
    }
  });

  // Get all products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug');

  const productBySlug = new Map<string, { id: string; name: string }>();
  products?.forEach(p => {
    productBySlug.set(p.slug, { id: p.id, name: p.name });
  });

  // Get existing company_products to avoid duplicates
  const { data: existingCPs } = await supabase
    .from('company_products')
    .select('company_id, product_id');

  const existingSet = new Set<string>();
  existingCPs?.forEach(cp => {
    existingSet.add(`${cp.company_id}:${cp.product_id}`);
  });

  // Process each billing spreadsheet
  const billingFiles = [
    'data/imports/X-RAI-Billing.xlsx',
    'data/imports/Summary-Note-Billing.xlsx',
    'data/imports/Smart-Data-Plus-Billing.xlsx'
  ];

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const filePath of billingFiles) {
    const fileName = filePath.split('/').pop()!;
    const productSlug = billingToProduct[fileName];
    const product = productBySlug.get(productSlug);

    if (!product) {
      console.log(`⚠️ Product not found for ${fileName} (slug: ${productSlug})`);
      continue;
    }

    console.log(`\n--- Processing ${fileName} → ${product.name} ---`);

    try {
      const workbook = XLSX.readFile(filePath);
      const customersInBilling = new Set<string>();

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        // Find header row
        let headerRowIdx = -1;
        let atsIdCol = -1;

        for (let i = 0; i < Math.min(10, rawData.length); i++) {
          const row = rawData[i];
          if (!row) continue;
          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '').toLowerCase();
            if (cell.includes('ats id') || cell === 'ats id') {
              atsIdCol = j;
              headerRowIdx = i;
              break;
            }
          }
          if (headerRowIdx >= 0) break;
        }

        if (headerRowIdx >= 0 && atsIdCol >= 0) {
          for (let i = headerRowIdx + 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row) continue;
            const atsId = row[atsIdCol];
            if (atsId && typeof atsId === 'number') {
              customersInBilling.add(String(atsId));
            }
          }
        }
      }

      console.log(`  Found ${customersInBilling.size} unique ATS IDs`);

      // Add company_products for each customer
      let added = 0;
      let skipped = 0;

      for (const atsId of customersInBilling) {
        const companies = atsToCompanies.get(atsId);
        if (!companies || companies.length === 0) {
          continue; // Company not in our system
        }

        // Add product to ALL companies that share this ATS ID
        for (const company of companies) {
          const key = `${company.id}:${product.id}`;
          if (existingSet.has(key)) {
            skipped++;
            continue; // Already has this product
          }

          if (!DRY_RUN) {
            const { error } = await supabase
              .from('company_products')
              .insert({
                company_id: company.id,
                product_id: product.id,
                status: 'active'
              });

            if (error) {
              console.log(`  ⚠️ Error adding ${product.name} to ${company.name}:`, error.message);
            } else {
              added++;
              existingSet.add(key); // Track to avoid duplicates
            }
          } else {
            added++;
            console.log(`  Would add: ${company.name} → ${product.name}`);
          }
        }
      }

      console.log(`  Added: ${added}, Skipped (already exists): ${skipped}`);
      totalAdded += added;
      totalSkipped += skipped;

    } catch (e: any) {
      console.log(`  Error reading ${fileName}:`, e.message);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total products added: ${totalAdded}`);
  console.log(`Total skipped (already exist): ${totalSkipped}`);

  if (DRY_RUN) {
    console.log('\n🔍 This was a DRY RUN. Run without --dry-run to apply changes.');
  }
}

syncBillingProducts();
