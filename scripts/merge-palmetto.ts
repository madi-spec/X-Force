/**
 * Find and merge Palmetto Exterminators duplicates
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // Find both companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, domain, created_at')
    .ilike('name', '%palmetto%')
    .order('created_at', { ascending: true });

  console.log('=== Companies matching Palmetto ===\n');

  if (!companies || companies.length === 0) {
    console.log('No companies found');
    return;
  }

  for (const c of companies) {
    console.log(`${c.name}`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Domain: ${c.domain || '(none)'}`);
    console.log(`  Created: ${c.created_at}`);
    console.log();
  }

  if (companies.length < 2) {
    console.log('Only one company found, nothing to merge');
    return;
  }

  // Keep the older one (first created), merge from the newer one
  const keepCompany = companies[0];
  const mergeCompany = companies[1];

  console.log('=== Merge Plan ===');
  console.log(`KEEP: ${keepCompany.name} (${keepCompany.id})`);
  console.log(`MERGE FROM: ${mergeCompany.name} (${mergeCompany.id})`);
  console.log();

  // Check what needs to be moved
  const tables = [
    { name: 'communications', column: 'company_id' },
    { name: 'contacts', column: 'company_id' },
    { name: 'company_products', column: 'company_id' },
    { name: 'attention_flags', column: 'company_id' },
    { name: 'command_center_items', column: 'company_id' },
    { name: 'activities', column: 'company_id' },
    { name: 'deals', column: 'company_id' },
  ];

  console.log('=== Records to move ===');
  for (const table of tables) {
    const { count } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true })
      .eq(table.column, mergeCompany.id);

    if (count && count > 0) {
      console.log(`  ${table.name}: ${count} records`);
    }
  }

  // Perform the merge
  console.log('\n=== Performing Merge ===');

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table.name)
      .update({ [table.column]: keepCompany.id })
      .eq(table.column, mergeCompany.id)
      .select('id');

    if (error) {
      console.log(`  ${table.name}: Error - ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`  ${table.name}: Moved ${data.length} records`);
    }
  }

  // Delete the duplicate company
  console.log('\n=== Deleting duplicate company ===');
  const { error: deleteError } = await supabase
    .from('companies')
    .delete()
    .eq('id', mergeCompany.id);

  if (deleteError) {
    console.log(`Error deleting: ${deleteError.message}`);
  } else {
    console.log(`Deleted: ${mergeCompany.name}`);
  }

  console.log('\n=== Merge Complete ===');
  console.log(`All records now under: ${keepCompany.name}`);
}

run().catch(console.error);
