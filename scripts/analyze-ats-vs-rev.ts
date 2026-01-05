import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BillingRow {
  atsId: number;
  customerName: string;
}

async function analyze() {
  console.log('Analyzing ATS IDs vs Rev IDs...\n');

  // Load X-RAI Billing to get ATS IDs
  const xraiBilling = XLSX.readFile('data/imports/X-RAI-Billing.xlsx');
  const sheetName = xraiBilling.SheetNames[0];
  const sheet = xraiBilling.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // Find header row
  let headerRowIdx = -1;
  for (let i = 0; i < rawData.length; i++) {
    if (rawData[i][0] === 'ATS ID') {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    console.log('Could not find ATS ID header row');
    return;
  }

  // Extract ATS customers
  const atsCustomers: BillingRow[] = [];
  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (row[0] && typeof row[0] === 'number' && row[1]) {
      atsCustomers.push({
        atsId: row[0],
        customerName: String(row[1]).trim()
      });
    }
  }

  console.log(`Found ${atsCustomers.length} customers with ATS IDs in X-RAI Billing\n`);

  // Get all companies from database
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, vfp_customer_id, status');

  if (error) {
    console.log('Error fetching companies:', error);
    return;
  }

  console.log(`Found ${companies.length} companies in database\n`);

  // Try to match ATS customers to companies
  let matchedByName = 0;
  let matchedByRevId = 0;
  let notFound = 0;
  const notFoundList: BillingRow[] = [];
  const duplicateMatches: Array<{ ats: BillingRow; matches: typeof companies }> = [];

  for (const atsCustomer of atsCustomers) {
    // Try to find matching company
    const normalizedAtsName = atsCustomer.customerName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const matches = companies.filter(c => {
      const normalizedDbName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalizedDbName.includes(normalizedAtsName) || normalizedAtsName.includes(normalizedDbName);
    });

    if (matches.length === 0) {
      notFound++;
      notFoundList.push(atsCustomer);
    } else if (matches.length === 1) {
      matchedByName++;
    } else {
      duplicateMatches.push({ ats: atsCustomer, matches });
      matchedByName++;
    }
  }

  console.log('--- Matching Results ---');
  console.log(`Matched by name: ${matchedByName}`);
  console.log(`Not found in DB: ${notFound}`);
  console.log(`Multiple matches: ${duplicateMatches.length}`);

  console.log('\n--- Not Found (first 10) ---');
  notFoundList.slice(0, 10).forEach(c => {
    console.log(`  ATS ${c.atsId}: ${c.customerName}`);
  });

  console.log('\n--- Multiple Matches (first 5) ---');
  duplicateMatches.slice(0, 5).forEach(({ ats, matches }) => {
    console.log(`\n  ATS ${ats.atsId}: ${ats.customerName}`);
    matches.forEach(m => {
      console.log(`    -> ${m.name} (Rev ID: ${m.vfp_customer_id || 'none'})`);
    });
  });

  // Now check for potential duplicates - same company with different IDs
  console.log('\n\n--- Potential Duplicates (ATS customer matching multiple DB records) ---');
  const potentialDupes = duplicateMatches.filter(d => d.matches.length > 1);
  console.log(`Found ${potentialDupes.length} ATS customers matching multiple DB records`);
}

analyze();
