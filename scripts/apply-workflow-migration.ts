/**
 * Apply workflow steps migration directly
 * Run with: npx tsx scripts/apply-workflow-migration.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  console.log('Applying workflow steps migration...');

  const supabase = createAdminClient();

  // Check if columns already exist by trying to query them
  const { data: testItem, error: testError } = await supabase
    .from('command_center_items')
    .select('id, workflow_steps, source_hash, email_id')
    .limit(1);

  if (!testError) {
    console.log('Columns already exist! Migration may have already been applied.');
    console.log('Sample data:', testItem);
    return;
  }

  // If error, columns don't exist yet - need to apply via SQL
  console.log('Columns do not exist. Please run the following SQL in Supabase Dashboard:');
  console.log(`
-- Add workflow_steps column
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS workflow_steps JSONB DEFAULT NULL;

-- Add source_hash column
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS source_hash VARCHAR(64);

-- Add email_id column
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS email_id UUID;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_command_center_source_hash
ON command_center_items(source_hash)
WHERE source_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_command_center_email_id
ON command_center_items(email_id)
WHERE email_id IS NOT NULL;
  `);
}

main().catch(console.error);
