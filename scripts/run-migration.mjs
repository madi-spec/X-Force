/**
 * Run Activity Matching Migration
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('Running activity matching migration...');

  // Step 1: Create enum type (may already exist)
  console.log('1. Creating enum type...');
  const { error: enumError } = await supabase.rpc('exec_sql', {
    sql: `
      DO $$ BEGIN
        CREATE TYPE activity_match_status AS ENUM (
          'pending', 'matched', 'excluded', 'review_needed', 'unmatched'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `
  });

  if (enumError) {
    console.log('  Note: exec_sql not available, trying alternative approach...');

    // Alternative: Try to add columns directly and see what works
    // The columns will use TEXT type instead of enum if enum doesn't exist
  }

  // Step 2: Add columns one by one
  const columns = [
    { name: 'match_status', type: 'TEXT', default: "'pending'" },
    { name: 'match_confidence', type: 'DECIMAL(3,2)', default: null },
    { name: 'match_reasoning', type: 'TEXT', default: null },
    { name: 'matched_at', type: 'TIMESTAMPTZ', default: null },
    { name: 'exclude_reason', type: 'TEXT', default: null },
  ];

  for (const col of columns) {
    console.log(`2. Adding column ${col.name}...`);

    // Check if column exists by trying to select it
    const { error: checkError } = await supabase
      .from('activities')
      .select(col.name)
      .limit(1);

    if (checkError && checkError.message.includes('does not exist')) {
      // Column doesn't exist, need to add it via SQL
      // Since we can't run raw SQL easily, we'll note this
      console.log(`   Column ${col.name} needs to be added via Supabase Dashboard`);
    } else {
      console.log(`   Column ${col.name} already exists or accessible`);
    }
  }

  // Test if columns are accessible
  console.log('\n3. Testing column access...');
  const { data, error: testError } = await supabase
    .from('activities')
    .select('id, match_status, match_confidence')
    .limit(1);

  if (testError) {
    console.log('   Columns not yet added. Please run this SQL in Supabase Dashboard:');
    console.log(`
-- Run this in Supabase SQL Editor:
ALTER TABLE activities ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'pending';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS match_confidence DECIMAL(3,2);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS match_reasoning TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS exclude_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_activities_match_status ON activities(match_status);
    `);
    return false;
  }

  console.log('   Columns are accessible!');
  return true;
}

runMigration()
  .then(success => {
    if (success) {
      console.log('\nMigration complete!');
    } else {
      console.log('\nMigration needs manual steps - see above.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Migration error:', error);
    process.exit(1);
  });
