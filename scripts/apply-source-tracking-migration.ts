/**
 * Apply source_communication_id migration to scheduling_requests
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';

async function applyMigration() {
  const supabase = createAdminClient();

  console.log('Applying source_communication_id migration...');

  // Check if column already exists
  const { data: columns, error: checkError } = await supabase
    .rpc('to_regclass', { name: 'scheduling_requests' });

  // Just run the SQL directly
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE scheduling_requests
      ADD COLUMN IF NOT EXISTS source_communication_id UUID REFERENCES communications(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_scheduling_requests_source_comm
      ON scheduling_requests(source_communication_id)
      WHERE source_communication_id IS NOT NULL;

      COMMENT ON COLUMN scheduling_requests.source_communication_id IS 'The communication/email that triggered this scheduling request (for Daily Driver integration)';
    `
  });

  if (error) {
    // If RPC doesn't exist, try a direct query approach
    console.log('RPC approach failed, trying direct approach...');

    // Try to add column through a workaround - select to test
    const { data: testData, error: testError } = await supabase
      .from('scheduling_requests')
      .select('source_communication_id')
      .limit(1);

    if (testError && testError.message.includes('source_communication_id')) {
      console.log('Column does not exist - needs manual migration');
      console.log('\nPlease run this SQL in the Supabase SQL Editor:');
      console.log(`
ALTER TABLE scheduling_requests
ADD COLUMN IF NOT EXISTS source_communication_id UUID REFERENCES communications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_requests_source_comm
ON scheduling_requests(source_communication_id)
WHERE source_communication_id IS NOT NULL;

COMMENT ON COLUMN scheduling_requests.source_communication_id IS 'The communication/email that triggered this scheduling request (for Daily Driver integration)';
      `);
    } else if (!testError) {
      console.log('✅ Column source_communication_id already exists!');
    } else {
      console.error('Error:', testError.message);
    }
  } else {
    console.log('✅ Migration applied successfully!');
  }
}

applyMigration().catch(console.error);
