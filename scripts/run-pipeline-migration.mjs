import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('Running pipeline tracking migration...\n');

  // Split the SQL into individual statements
  const statements = [
    // Meeting transcriptions columns
    `ALTER TABLE meeting_transcriptions ADD COLUMN IF NOT EXISTS cc_items_created BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE meeting_transcriptions ADD COLUMN IF NOT EXISTS cc_processed_at TIMESTAMPTZ`,

    // Email messages columns
    `ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS processed_for_cc BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS cc_processed_at TIMESTAMPTZ`,

    // Meeting prep columns
    `ALTER TABLE meeting_prep ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE meeting_prep ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ`,
    `ALTER TABLE meeting_prep ADD COLUMN IF NOT EXISTS has_external_attendees BOOLEAN DEFAULT FALSE`,

    // Command center items - transcription link
    `ALTER TABLE command_center_items ADD COLUMN IF NOT EXISTS transcription_id UUID REFERENCES meeting_transcriptions(id) ON DELETE SET NULL`,

    // Deals - last activity
    `ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ`,
  ];

  for (const sql of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        // Try direct query if rpc doesn't exist
        const { error: directError } = await supabase.from('_migrations').select('version').limit(0);
        console.log(`Statement: ${sql.substring(0, 60)}...`);
        console.log(`  Note: RPC not available, please run in Supabase dashboard\n`);
      } else {
        console.log(`✓ ${sql.substring(0, 60)}...`);
      }
    } catch (e) {
      console.log(`Statement: ${sql.substring(0, 60)}...`);
      console.log(`  Error: ${e.message}\n`);
    }
  }

  console.log('\nMigration complete. If errors occurred, run the SQL in Supabase dashboard.');
}

runMigration().catch(console.error);
