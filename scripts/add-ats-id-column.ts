import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function addAtsIdColumn() {
  console.log('Adding ats_id column to companies table...\n');

  // First, let's try to update a company with ats_id to see if the column exists
  const { error: testError } = await supabase
    .from('companies')
    .update({ ats_id: null })
    .eq('id', '00000000-0000-0000-0000-000000000000'); // Non-existent ID

  if (testError && testError.message.includes('column')) {
    console.log('Column does not exist. Please run the following SQL in Supabase Dashboard SQL Editor:');
    console.log('\n--- SQL to run ---');
    console.log(`
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ats_id TEXT;
CREATE INDEX IF NOT EXISTS idx_companies_ats_id ON companies(ats_id);
COMMENT ON COLUMN companies.ats_id IS 'ATS system ID from billing spreadsheets (X-RAI, Summary Note, etc.)';
COMMENT ON COLUMN companies.vfp_customer_id IS 'Rev ID from KEEP spreadsheet (Revenue system)';
    `);
    console.log('--- End SQL ---\n');
    return false;
  }

  console.log('Column ats_id already exists or was added successfully!');
  return true;
}

addAtsIdColumn();
