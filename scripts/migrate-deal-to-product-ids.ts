/**
 * Data Migration Script: Populate company_product_id from deal_id
 *
 * Uses deal_conversions table to map legacy deal_id → company_product_id
 * Run this after schema migration is complete.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface MigrationResult {
  table: string;
  total: number;
  updated: number;
  skipped: number;
  errors: string[];
}

async function migrateTable(tableName: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    table: tableName,
    total: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  console.log(`\n📦 Migrating ${tableName}...`);

  // Get records with deal_id but no company_product_id
  const { data: records, error: fetchError, count } = await supabase
    .from(tableName)
    .select('id, deal_id', { count: 'exact' })
    .not('deal_id', 'is', null)
    .is('company_product_id', null)
    .limit(1000);

  if (fetchError) {
    result.errors.push(`Fetch error: ${fetchError.message}`);
    console.error(`  ❌ Fetch error: ${fetchError.message}`);
    return result;
  }

  result.total = count || 0;

  if (!records || records.length === 0) {
    console.log(`  ✓ No records to migrate (0 with deal_id and no company_product_id)`);
    return result;
  }

  console.log(`  Found ${records.length} records to migrate (of ${count} total needing migration)`);

  // Get unique deal IDs
  const dealIds = [...new Set(records.map(r => r.deal_id).filter(Boolean))];

  if (dealIds.length === 0) {
    console.log(`  ✓ No valid deal IDs found`);
    return result;
  }

  // Get mappings from deal_conversions
  const { data: conversions, error: convError } = await supabase
    .from('deal_conversions')
    .select('legacy_deal_id, company_product_id')
    .in('legacy_deal_id', dealIds);

  if (convError) {
    result.errors.push(`Conversion lookup error: ${convError.message}`);
    console.error(`  ❌ Conversion lookup error: ${convError.message}`);
    return result;
  }

  // Create mapping
  const dealToProduct = new Map<string, string>();
  conversions?.forEach(c => {
    dealToProduct.set(c.legacy_deal_id, c.company_product_id);
  });

  console.log(`  Found ${dealToProduct.size} deal→product mappings in deal_conversions`);

  // Update records in batches
  for (const record of records) {
    const companyProductId = dealToProduct.get(record.deal_id);

    if (companyProductId) {
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ company_product_id: companyProductId })
        .eq('id', record.id);

      if (updateError) {
        result.errors.push(`Update error for ${record.id}: ${updateError.message}`);
      } else {
        result.updated++;
      }
    } else {
      result.skipped++;
    }
  }

  console.log(`  ✓ Updated: ${result.updated}, Skipped (no mapping): ${result.skipped}`);
  if (result.errors.length > 0) {
    console.log(`  ⚠ Errors: ${result.errors.length}`);
  }

  return result;
}

async function checkDealConversionsTable(): Promise<boolean> {
  const { data, error } = await supabase
    .from('deal_conversions')
    .select('legacy_deal_id, company_product_id')
    .limit(1);

  if (error) {
    console.log('⚠ deal_conversions table not found or empty - migration will skip record updates');
    console.log('  This is OK if deals have not been converted yet.');
    return false;
  }

  const { count } = await supabase
    .from('deal_conversions')
    .select('*', { count: 'exact', head: true });

  console.log(`✓ deal_conversions table found with ${count || 0} mappings`);
  return true;
}

async function main() {
  console.log('🚀 Starting Deal → Product ID Migration\n');
  console.log('='.repeat(60));

  // Check if deal_conversions exists
  const hasConversions = await checkDealConversionsTable();

  const tables = [
    'activities',
    'tasks',
    'meeting_transcriptions',
    'scheduling_requests',
    'command_center_items',
  ];

  // Check for optional tables
  const optionalTables = ['ai_email_drafts', 'ai_signals', 'communications'];
  for (const table of optionalTables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (!error) {
      tables.push(table);
    }
  }

  console.log(`\nTables to migrate: ${tables.join(', ')}`);

  const results: MigrationResult[] = [];

  for (const table of tables) {
    try {
      const result = await migrateTable(table);
      results.push(result);
    } catch (err) {
      results.push({
        table,
        total: 0,
        updated: 0,
        skipped: 0,
        errors: [`Fatal error: ${err}`],
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary\n');

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  console.log('Table                      | Updated | Skipped | Errors');
  console.log('-'.repeat(60));

  for (const r of results) {
    const tablePadded = r.table.padEnd(26);
    console.log(`${tablePadded} | ${String(r.updated).padStart(7)} | ${String(r.skipped).padStart(7)} | ${r.errors.length}`);
    totalUpdated += r.updated;
    totalSkipped += r.skipped;
    totalErrors += r.errors.length;
  }

  console.log('-'.repeat(60));
  console.log(`${'TOTAL'.padEnd(26)} | ${String(totalUpdated).padStart(7)} | ${String(totalSkipped).padStart(7)} | ${totalErrors}`);

  if (!hasConversions) {
    console.log('\n⚠ Note: No deal_conversions found. Run deal conversion first to populate mappings.');
  }

  if (totalErrors > 0) {
    console.log('\n⚠ Some errors occurred. Review logs above.');
    process.exit(1);
  } else {
    console.log('\n✅ Migration complete!');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
