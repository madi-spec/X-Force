/**
 * Apply the sync tracking migration manually
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Applying sync tracking migration...\n');

  // Add columns to users table
  console.log('1. Adding columns to users table...');
  const { error: usersError } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS initial_sync_complete BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS initial_sync_started_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS initial_sync_completed_at TIMESTAMPTZ;
    `
  });

  if (usersError) {
    // Try direct approach
    const { error: directError } = await supabase
      .from('users')
      .select('initial_sync_complete')
      .limit(1);

    if (directError?.message?.includes('does not exist')) {
      console.log('   Column does not exist, need to add it via SQL...');
      console.log('   Error:', usersError.message);
      console.log('\n   Please run this SQL manually in Supabase Dashboard:\n');
      console.log(`
ALTER TABLE users
ADD COLUMN IF NOT EXISTS initial_sync_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS initial_sync_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS initial_sync_completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS sync_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phase VARCHAR(50) NOT NULL DEFAULT 'init',
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  current_item TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sync_progress_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_progress_user_id ON sync_progress(user_id);
      `);
      return;
    } else {
      console.log('   Columns already exist.');
    }
  } else {
    console.log('   Done.');
  }

  // Check if sync_progress table exists
  console.log('\n2. Checking sync_progress table...');
  const { error: tableError } = await supabase
    .from('sync_progress')
    .select('id')
    .limit(1);

  if (tableError?.message?.includes('does not exist')) {
    console.log('   Table does not exist. Creating...');
    // Can't create table via client, need to do via dashboard
    console.log('   Please create the sync_progress table in Supabase Dashboard SQL editor.');
  } else {
    console.log('   Table exists.');
  }

  console.log('\nMigration check complete.');
}

main().catch(console.error);
