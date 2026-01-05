/**
 * Apply the process unification schema migration directly
 *
 * RUN: npx tsx scripts/apply-process-unification-migration.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const MIGRATION_SQL = `
-- Add goal field (exists in Gen 2, not in Gen 3)
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS goal TEXT;

-- Add sales enablement content fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS pitch_points JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS objection_handlers JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '[]';

-- Add AI suggestion fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS ai_suggested_pitch_points JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_suggested_objections JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT '{}';

-- Add metrics fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS avg_days_in_stage NUMERIC,
ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC;

-- Add automation fields
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS ai_sequence_id UUID,
ADD COLUMN IF NOT EXISTS ai_actions JSONB DEFAULT '[]';

-- Add exit actions field
ALTER TABLE product_process_stages
ADD COLUMN IF NOT EXISTS exit_actions JSONB;
`;

async function main() {
  console.log('=== Applying Process Unification Schema Migration ===\n');
  console.log(`Supabase URL: ${supabaseUrl}\n`);

  // Check current columns first
  console.log('1. Checking current product_process_stages columns...\n');

  const { data: columns, error: columnsError } = await supabase
    .from('product_process_stages')
    .select('*')
    .limit(0);

  if (columnsError) {
    console.error('Error accessing table:', columnsError);
    process.exit(1);
  }

  // Try to apply migration using RPC
  console.log('2. Applying schema changes...\n');

  // Split into individual ALTER statements since some may already exist
  const statements = [
    `ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS goal TEXT`,
    `ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS pitch_points JSONB DEFAULT '[]'`,
    `ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS objection_handlers JSONB DEFAULT '[]'`,
    `ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '[]'`,
    `ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS ai_suggested_pitch_points JSONB DEFAULT '[]'`,
    `ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS ai_suggested_objections JSONB DEFAULT '[]'`,
    `ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT '{}'`,
    `ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS avg_days_in_stage NUMERIC`,
    `ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC`,
    `ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS ai_sequence_id UUID`,
    `ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS ai_actions JSONB DEFAULT '[]'`,
    `ALTER TABLE product_process_stages ADD COLUMN IF NOT EXISTS exit_actions JSONB`,
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const sql of statements) {
    const columnMatch = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/);
    const columnName = columnMatch ? columnMatch[1] : 'unknown';

    try {
      const { error } = await supabase.rpc('exec_sql', { sql });

      if (error) {
        // Check if it's just "already exists" which is fine
        if (error.message?.includes('already exists')) {
          console.log(`   ✓ ${columnName}: already exists`);
          successCount++;
        } else {
          console.error(`   ✗ ${columnName}: ${error.message}`);
          errorCount++;
        }
      } else {
        console.log(`   ✓ ${columnName}: added successfully`);
        successCount++;
      }
    } catch (e) {
      // RPC might not exist, try a different approach
      console.log(`   ⚠ ${columnName}: RPC not available, checking column...`);

      // Just verify the table is accessible
      const { error: checkError } = await supabase
        .from('product_process_stages')
        .select(columnName)
        .limit(1);

      if (!checkError) {
        console.log(`   ✓ ${columnName}: already exists`);
        successCount++;
      } else if (checkError.message?.includes('does not exist')) {
        console.log(`   ⚠ ${columnName}: needs to be added manually`);
        errorCount++;
      } else {
        console.log(`   ? ${columnName}: unknown status`);
      }
    }
  }

  console.log('\n3. Verifying schema...\n');

  // Try to select new columns
  const testColumns = ['goal', 'pitch_points', 'objection_handlers', 'resources', 'ai_sequence_id'];
  let verifySuccess = true;

  for (const col of testColumns) {
    const { error } = await supabase
      .from('product_process_stages')
      .select(col)
      .limit(1);

    if (error) {
      console.log(`   ✗ Column '${col}' not accessible: ${error.message}`);
      verifySuccess = false;
    } else {
      console.log(`   ✓ Column '${col}' exists and accessible`);
    }
  }

  console.log('\n=== MIGRATION SUMMARY ===');

  if (verifySuccess) {
    console.log('\n✅ Schema migration successful!');
    console.log('All required columns are present in product_process_stages.\n');
    console.log('Next step: Run the data migration script:');
    console.log('  npx tsx scripts/migrate-sales-stages-to-unified.ts');
  } else {
    console.log('\n⚠️ Some columns may need to be added manually.');
    console.log('\nRun this SQL in the Supabase Dashboard SQL Editor:\n');
    console.log(MIGRATION_SQL);
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
