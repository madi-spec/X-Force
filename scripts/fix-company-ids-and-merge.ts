import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface KeepCustomer {
  name: string;
  revId: string;
  address: string;
  successRep: string;
}

interface AtsCustomer {
  name: string;
  atsId: string;
}

const DRY_RUN = process.argv.includes('--dry-run');

async function fixCompanyIdsAndMerge() {
  console.log('=== Company ID Fix and Merge Script ===');
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  console.log('');

  // Step 1: Check if ats_id column exists
  console.log('Step 1: Checking for ats_id column...');
  const { error: atsCheckError } = await supabase
    .from('companies')
    .select('ats_id')
    .limit(1);

  if (atsCheckError && atsCheckError.message.includes('column')) {
    console.log('\n⚠️  ats_id column does not exist!');
    console.log('\nPlease run the following SQL in the Supabase Dashboard SQL Editor:\n');
    console.log('----------------------------------------');
    console.log(`
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ats_id TEXT;
CREATE INDEX IF NOT EXISTS idx_companies_ats_id ON companies(ats_id);
    `);
    console.log('----------------------------------------\n');
    console.log('After running the SQL, re-run this script.');
    return;
  }
  console.log('  ✓ ats_id column exists\n');

  // Step 2: Load KEEP spreadsheet to get Rev IDs
  console.log('Step 2: Loading KEEP spreadsheet (Rev IDs)...');
  const keepCustomers = loadKeepCustomers();
  console.log(`  ✓ Loaded ${keepCustomers.size} customers from KEEP\n`);

  // Step 3: Load billing spreadsheets to get ATS IDs
  console.log('Step 3: Loading billing spreadsheets (ATS IDs)...');
  const atsCustomers = loadAtsCustomers();
  console.log(`  ✓ Loaded ${atsCustomers.size} customers from billing spreadsheets\n`);

  // Step 4: Get all companies from database
  console.log('Step 4: Fetching companies from database...');
  const { data: companies, error: fetchError } = await supabase
    .from('companies')
    .select('id, name, vfp_customer_id, ats_id, status, address, vfp_support_contact')
    .order('name');

  if (fetchError) {
    console.log('Error fetching companies:', fetchError);
    return;
  }
  console.log(`  ✓ Found ${companies.length} companies\n`);

  // Build sets of valid IDs for validation
  const validRevIds = new Set<string>();
  keepCustomers.forEach(c => validRevIds.add(c.revId));

  const allAtsIds = new Set<string>();
  atsCustomers.forEach(c => allAtsIds.add(c.atsId));

  // Step 5: Match companies to KEEP and billing data, update IDs
  console.log('Step 5: Matching companies to spreadsheet data...');
  let updatedCount = 0;
  let revIdUpdates = 0;
  let atsIdUpdates = 0;
  let invalidRevIdCleared = 0;

  for (const company of companies) {
    // Use state-aware matching helpers
    const keepMatch = findKeepMatch(company.name, keepCustomers);
    const atsMatch = findAtsMatch(company.name, atsCustomers);

    const updates: Record<string, any> = {};

    // Check if current Rev ID is actually an ATS ID (invalid)
    if (company.vfp_customer_id && !validRevIds.has(company.vfp_customer_id) && allAtsIds.has(company.vfp_customer_id)) {
      console.log(`  ⚠️  ${company.name}: Rev ID ${company.vfp_customer_id} is actually an ATS ID, clearing...`);
      updates.vfp_customer_id = null;
      updates.ats_id = company.vfp_customer_id; // Move to correct field if not already set
      invalidRevIdCleared++;
    }

    // Check if Rev ID needs updating
    if (keepMatch && company.vfp_customer_id !== keepMatch.revId) {
      updates.vfp_customer_id = keepMatch.revId;
      revIdUpdates++;
    }

    // Check if ATS ID needs updating
    if (atsMatch && company.ats_id !== atsMatch.atsId) {
      updates.ats_id = atsMatch.atsId;
      atsIdUpdates++;
    }

    // Also copy address and support rep from KEEP if missing
    if (keepMatch) {
      if (!company.address && keepMatch.address) {
        updates.address = keepMatch.address;
      }
      if (!company.vfp_support_contact && keepMatch.successRep) {
        updates.vfp_support_contact = keepMatch.successRep;
      }
    }

    if (Object.keys(updates).length > 0) {
      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('companies')
          .update(updates)
          .eq('id', company.id);

        if (updateError) {
          console.log(`  ⚠️  Error updating ${company.name}:`, updateError.message);
        }
      }
      updatedCount++;
      if (Object.keys(updates).length <= 2) {
        console.log(`  Updated: ${company.name}`, updates);
      }
    }
  }

  console.log(`\n  Summary: ${updatedCount} companies updated`);
  console.log(`    Rev ID updates: ${revIdUpdates}`);
  console.log(`    ATS ID updates: ${atsIdUpdates}`);
  if (invalidRevIdCleared > 0) {
    console.log(`    Invalid Rev IDs cleared: ${invalidRevIdCleared}`);
  }
  console.log('');

  // Step 6: Find and merge duplicates
  console.log('Step 6: Finding duplicate companies...');
  const duplicateGroups = findDuplicates(companies);
  console.log(`  Found ${duplicateGroups.length} duplicate groups\n`);

  // Step 7: Process each duplicate group
  console.log('Step 7: Processing duplicates...\n');
  let mergedCount = 0;
  let skippedCount = 0;

  for (const group of duplicateGroups) {
    // Determine the primary company
    const sorted = group.sort((a, b) => {
      // Prefer companies with Rev ID
      if (a.vfp_customer_id && !b.vfp_customer_id) return -1;
      if (!a.vfp_customer_id && b.vfp_customer_id) return 1;

      // Prefer customers over prospects
      if (a.status === 'customer' && b.status !== 'customer') return -1;
      if (b.status === 'customer' && a.status !== 'customer') return 1;

      // Prefer with address
      if (a.address && !b.address) return -1;
      if (b.address && !a.address) return 1;

      return 0;
    });

    const primary = sorted[0];
    const duplicates = sorted.slice(1);

    if (duplicates.length === 0) continue;

    // Check if these are different locations (not true duplicates)
    const isDifferentLocation = duplicates.some(d => {
      const primaryState = extractState(primary.name);
      const dupState = extractState(d.name);
      return primaryState && dupState && primaryState !== dupState;
    });

    if (isDifferentLocation) {
      console.log(`  Skipping (different locations): ${primary.name}`);
      duplicates.forEach(d => console.log(`    vs ${d.name}`));
      skippedCount++;
      continue;
    }

    console.log(`\n  Merging into: ${primary.name} (Rev: ${primary.vfp_customer_id || 'none'}, ATS: ${primary.ats_id || 'none'})`);

    // Collect IDs from duplicates
    const updates: Record<string, any> = {};
    for (const dup of duplicates) {
      console.log(`    <- ${dup.name} (Rev: ${dup.vfp_customer_id || 'none'}, ATS: ${dup.ats_id || 'none'})`);

      // Copy ATS ID if primary doesn't have one
      if (!primary.ats_id && dup.ats_id) {
        updates.ats_id = dup.ats_id;
        console.log(`       Copying ATS ID: ${dup.ats_id}`);
      }

      // Copy Rev ID if primary doesn't have one
      if (!primary.vfp_customer_id && dup.vfp_customer_id) {
        updates.vfp_customer_id = dup.vfp_customer_id;
        console.log(`       Copying Rev ID: ${dup.vfp_customer_id}`);
      }

      // Copy address if missing
      if (!primary.address && dup.address) {
        updates.address = dup.address;
      }

      // Copy support contact if missing
      if (!primary.vfp_support_contact && dup.vfp_support_contact) {
        updates.vfp_support_contact = dup.vfp_support_contact;
      }
    }

    if (!DRY_RUN) {
      // Update primary with collected data
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('companies')
          .update(updates)
          .eq('id', primary.id);
      }

      // Reassign related records from duplicates to primary
      for (const dup of duplicates) {
        // Move contacts
        await supabase
          .from('contacts')
          .update({ company_id: primary.id })
          .eq('company_id', dup.id);

        // Move deals
        await supabase
          .from('deals')
          .update({ company_id: primary.id })
          .eq('company_id', dup.id);

        // Move company_products
        await supabase
          .from('company_products')
          .update({ company_id: primary.id })
          .eq('company_id', dup.id);

        // Move activities
        await supabase
          .from('activities')
          .update({ company_id: primary.id })
          .eq('company_id', dup.id);

        // Move communications
        await supabase
          .from('communications')
          .update({ company_id: primary.id })
          .eq('company_id', dup.id);

        // Move email_conversations
        await supabase
          .from('email_conversations')
          .update({ company_id: primary.id })
          .eq('company_id', dup.id);

        // Move promises
        await supabase
          .from('promises')
          .update({ company_id: primary.id })
          .eq('company_id', dup.id);

        // Move meeting_prep
        await supabase
          .from('meeting_prep')
          .update({ company_id: primary.id })
          .eq('company_id', dup.id);

        // Delete the duplicate company
        const { error: deleteError } = await supabase
          .from('companies')
          .delete()
          .eq('id', dup.id);

        if (deleteError) {
          console.log(`    ⚠️  Error deleting ${dup.name}:`, deleteError.message);
        } else {
          console.log(`    ✓ Deleted duplicate: ${dup.name}`);
          mergedCount++;
        }
      }
    } else {
      console.log(`    [DRY RUN] Would merge ${duplicates.length} duplicates`);
      mergedCount += duplicates.length;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Companies updated with IDs: ${updatedCount}`);
  console.log(`Duplicate groups found: ${duplicateGroups.length}`);
  console.log(`Companies merged: ${mergedCount}`);
  console.log(`Skipped (different locations): ${skippedCount}`);

  if (DRY_RUN) {
    console.log('\n🔍 This was a DRY RUN. Run without --dry-run to apply changes.');
  }
}

function loadKeepCustomers(): Map<string, KeepCustomer> {
  const keepFile = XLSX.readFile('data/imports/KEEP-VFP-Customers.xlsx');
  const sheet = keepFile.Sheets['in'];
  const data = XLSX.utils.sheet_to_json(sheet) as any[];

  const customers = new Map<string, KeepCustomer>();
  data.forEach(row => {
    if (row['Customer Name'] && row['Rev ID']) {
      const name = row['Customer Name'];
      const state = extractState(name);
      const customer = {
        name,
        revId: String(row['Rev ID']),
        address: typeof row['Billing Address'] === 'string' ? row['Billing Address'] : '',
        successRep: row['Customer Success Rep'] || ''
      };

      // Store with multiple keys for better matching
      // 1. Normalized with state preserved (e.g., "fourseasons_VA")
      const normalizedWithState = normalizeCompanyName(name) + (state ? `_${state}` : '');
      customers.set(normalizedWithState, customer);

      // 2. Also store with just normalized (without state) if no state collision
      const normalized = normalizeCompanyName(name);
      if (!customers.has(normalized)) {
        customers.set(normalized, customer);
      }
    }
  });
  return customers;
}

// Helper to find best KEEP match for a company
function findKeepMatch(companyName: string, keepCustomers: Map<string, KeepCustomer>): KeepCustomer | undefined {
  const state = extractState(companyName);
  const normalized = normalizeCompanyName(companyName);
  const aggressive = normalizeAggressive(companyName);

  // Try matching strategies in order of specificity
  const strategies = [
    normalized + (state ? `_${state}` : ''),  // Exact with state
    normalized,                                // Without state
    aggressive + (state ? `_${state}` : ''),  // Aggressive with state
    aggressive                                 // Aggressive without state
  ];

  for (const key of strategies) {
    const match = keepCustomers.get(key);
    if (match) {
      // If the company has a state, verify the match also has same state (or no state)
      if (state) {
        const matchState = extractState(match.name);
        if (matchState && matchState !== state) continue; // Wrong state, try next
      }
      return match;
    }
  }

  return undefined;
}

// Helper to find best ATS match for a company
function findAtsMatch(companyName: string, atsCustomers: Map<string, AtsCustomer>): AtsCustomer | undefined {
  const state = extractState(companyName);
  const normalized = normalizeCompanyName(companyName);
  const aggressive = normalizeAggressive(companyName);

  // Try matching strategies in order of specificity
  const strategies = [
    normalized + (state ? `_${state}` : ''),  // Exact with state
    normalized,                                // Without state
    aggressive + (state ? `_${state}` : ''),  // Aggressive with state
    aggressive                                 // Aggressive without state
  ];

  for (const key of strategies) {
    const match = atsCustomers.get(key);
    if (match) {
      // If the company has a state, verify the match also has same state (or no state)
      if (state) {
        const matchState = extractState(match.name);
        if (matchState && matchState !== state) continue; // Wrong state, try next
      }
      return match;
    }
  }

  return undefined;
}

function loadAtsCustomers(): Map<string, AtsCustomer> {
  const customers = new Map<string, AtsCustomer>();

  // Load from all billing spreadsheets
  const billingFiles = [
    'data/imports/X-RAI-Billing.xlsx',
    'data/imports/Summary-Note-Billing.xlsx',
    'data/imports/Smart-Data-Plus-Billing.xlsx'
  ];

  for (const filePath of billingFiles) {
    try {
      const workbook = XLSX.readFile(filePath);

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        // Find header row with ATS ID
        let headerRowIdx = -1;
        let atsIdCol = -1;
        let customerNameCol = -1;

        for (let i = 0; i < Math.min(10, rawData.length); i++) {
          const row = rawData[i];
          if (!row) continue;

          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '').toLowerCase();
            if (cell.includes('ats id') || cell === 'ats id') {
              atsIdCol = j;
            }
            if (cell.includes('ats customer') || cell.includes('customer name')) {
              customerNameCol = j;
            }
          }

          if (atsIdCol >= 0 && customerNameCol >= 0) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx >= 0) {
          for (let i = headerRowIdx + 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row) continue;

            const atsId = row[atsIdCol];
            const customerName = row[customerNameCol];

            if (atsId && customerName && typeof atsId === 'number') {
              const name = String(customerName).trim();
              const state = extractState(name);
              const customer = {
                name,
                atsId: String(atsId)
              };

              // Store with multiple keys for better matching
              const normalizedWithState = normalizeCompanyName(name) + (state ? `_${state}` : '');
              if (!customers.has(normalizedWithState)) {
                customers.set(normalizedWithState, customer);
              }

              const normalized = normalizeCompanyName(name);
              if (!customers.has(normalized)) {
                customers.set(normalized, customer);
              }
            }
          }
        }
      }
    } catch (e) {
      // File might not exist, skip
    }
  }

  return customers;
}

function normalizeCompanyName(name: string): string {
  let normalized = name.toLowerCase();

  // Remove state abbreviations at end (with or without hyphen)
  const states = 'va|nc|sc|ga|fl|tx|ca|ny|oh|pa|il|az|nv|co|wa|or|ma|ct|nj|md|tn|ky|al|la|mo|mn|wi|ia|ks|ok|ar|ms|ut|ne|nm|wv|id|hi|me|nh|ri|mt|de|sd|nd|ak|vt|wy|dc';
  normalized = normalized.replace(new RegExp(`\\s*[-–]?\\s*(${states})\\s*$`, 'gi'), '');

  // Remove non-alphanumeric characters
  normalized = normalized.replace(/[^a-z0-9]/g, '');

  // Remove common industry terms (pest control, lawn care, etc.)
  const industryTerms = [
    'pestcontrol', 'pest', 'control', 'termite', 'termiteand',
    'lawncare', 'lawn', 'exterminating', 'exterminators', 'exterminator',
    'wildlife', 'services', 'service', 'management', 'solutions',
    'inc', 'llc', 'corp', 'company', 'co', 'the'
  ];

  for (const term of industryTerms) {
    // Remove term at end
    if (normalized.endsWith(term)) {
      normalized = normalized.slice(0, -term.length);
    }
    // Also try removing term at start
    if (normalized.startsWith('the')) {
      normalized = normalized.slice(3);
    }
  }

  // Remove trailing 'and'
  if (normalized.endsWith('and')) {
    normalized = normalized.slice(0, -3);
  }

  return normalized;
}

// Secondary normalization that strips even more for aggressive matching
function normalizeAggressive(name: string): string {
  let normalized = normalizeCompanyName(name);

  // Also remove these common words that might differ
  const extraTerms = ['pest', 'control', 'lawn', 'tree', 'termite', 'and', 'of'];
  for (const term of extraTerms) {
    normalized = normalized.replace(new RegExp(term, 'g'), '');
  }

  return normalized;
}

function extractState(name: string): string | null {
  // Match state at end with or without hyphen: "Company - VA" or "Company VA"
  const states = ['VA', 'NC', 'SC', 'GA', 'FL', 'TX', 'CA', 'NY', 'OH', 'PA', 'IL', 'AZ', 'NV', 'CO', 'WA', 'OR', 'MA', 'CT', 'NJ', 'MD', 'TN', 'KY', 'AL', 'LA', 'MO', 'MN', 'WI', 'IA', 'KS', 'OK', 'AR', 'MS', 'UT', 'NE', 'NM', 'WV', 'ID', 'HI', 'ME', 'NH', 'RI', 'MT', 'DE', 'SD', 'ND', 'AK', 'VT', 'WY', 'DC'];
  const match = name.match(/[-–]?\s*([A-Z]{2})\s*$/);
  if (match && states.includes(match[1])) {
    return match[1];
  }
  return null;
}

function findDuplicates(companies: any[]): any[][] {
  const groups: Map<string, any[]> = new Map();
  const aggressiveGroups: Map<string, any[]> = new Map();

  // First pass: standard normalization
  companies.forEach(c => {
    const normalized = normalizeCompanyName(c.name);
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized)!.push(c);

    // Also track aggressive normalization
    const aggressive = normalizeAggressive(c.name);
    if (!aggressiveGroups.has(aggressive)) {
      aggressiveGroups.set(aggressive, []);
    }
    aggressiveGroups.get(aggressive)!.push(c);
  });

  // Get duplicates from standard normalization
  const standardDupes = Array.from(groups.values()).filter(g => g.length > 1);

  // Get additional duplicates from aggressive normalization
  // (only if not already found in standard)
  const alreadyGrouped = new Set<string>();
  standardDupes.forEach(group => {
    group.forEach(c => alreadyGrouped.add(c.id));
  });

  const aggressiveDupes = Array.from(aggressiveGroups.values())
    .filter(g => g.length > 1)
    .filter(g => !g.every(c => alreadyGrouped.has(c.id)));

  // Combine, but mark aggressive ones for review
  return [...standardDupes, ...aggressiveDupes];
}

fixCompanyIdsAndMerge();
