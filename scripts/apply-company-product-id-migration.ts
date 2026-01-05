/**
 * Apply the company_product_id migration directly via Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addColumnIfNotExists(tableName: string) {
  console.log(`\n📦 Processing ${tableName}...`);

  // Check if column already exists
  const { data: columns, error: checkError } = await supabase.rpc('exec_sql', {
    sql: `SELECT column_name FROM information_schema.columns
          WHERE table_name = '${tableName}'
          AND column_name = 'company_product_id'
          AND table_schema = 'public'`
  });

  if (checkError) {
    // RPC doesn't exist, try direct query approach
    console.log(`  ⚠ Using alternative check method...`);

    // Check via table query (this works for existing tables)
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
      console.log(`  ❌ Table ${tableName} not accessible: ${error.message}`);
      return;
    }

    // Check if column exists in the returned data structure
    if (data && data[0] && 'company_product_id' in data[0]) {
      console.log(`  ✓ Column already exists`);
      return;
    }

    // Column doesn't exist - but we can't add it via client
    console.log(`  ⚠ Column needs to be added via SQL migration`);
    return;
  }

  if (columns && columns.length > 0) {
    console.log(`  ✓ Column already exists`);
  } else {
    console.log(`  ⚠ Column needs to be added via SQL migration`);
  }
}

async function main() {
  console.log('🚀 Checking company_product_id migration status\n');
  console.log('='.repeat(60));

  const tables = [
    'activities',
    'tasks',
    'meeting_transcriptions',
    'scheduling_requests',
    'command_center_items',
    'ai_email_drafts',
    'ai_signals',
    'communications',
  ];

  for (const table of tables) {
    await addColumnIfNotExists(table);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n⚠ Note: Actual column addition must be done via SQL migration.');
  console.log('Run the migration SQL directly in Supabase Dashboard SQL Editor:');
  console.log('supabase/migrations/20260104_add_company_product_id_columns.sql');
}

main().catch(console.error);
