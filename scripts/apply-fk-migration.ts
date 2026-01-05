/**
 * Apply FK migration: Switch company_products FK from product_sales_stages to product_process_stages
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('=== Applying FK Migration ===\n');

  // Step 1: Check current FK constraints
  console.log('Step 1: Checking current FK constraints...');
  const { data: constraints, error: constraintError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT tc.constraint_name, ccu.table_name as references_table
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'company_products'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_schema = 'public'
        AND (ccu.table_name = 'product_sales_stages' OR ccu.table_name = 'product_process_stages');
    `
  });

  if (constraintError) {
    console.log('Cannot query constraints via RPC, will try direct SQL...');

    // Try dropping and adding directly
    console.log('\nStep 2: Attempting to drop old FK and add new FK...');

    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE company_products
        DROP CONSTRAINT IF EXISTS company_products_current_stage_id_fkey;
      `
    });

    if (dropError) {
      console.log('Drop via RPC failed:', dropError.message);
      console.log('\nThe migration needs to be run directly in Supabase SQL editor.');
      console.log('Please run the following SQL:');
      console.log('');
      console.log('----------------------------------------');
      console.log(`
-- Drop existing FK to product_sales_stages
ALTER TABLE company_products
DROP CONSTRAINT IF EXISTS company_products_current_stage_id_fkey;

-- Add new FK to product_process_stages
ALTER TABLE company_products
ADD CONSTRAINT company_products_current_stage_id_fkey
FOREIGN KEY (current_stage_id)
REFERENCES product_process_stages(id)
ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_company_products_current_stage_id
ON company_products(current_stage_id);
      `);
      console.log('----------------------------------------');
      return;
    }
  } else {
    console.log('Current constraints:', constraints);
  }

  console.log('\n✅ Migration instructions provided above.');
  console.log('After running the SQL, refresh the product page to verify.');
}

applyMigration().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
