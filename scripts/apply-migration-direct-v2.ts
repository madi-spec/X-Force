/**
 * Direct migration application using pg client
 * This bypasses the Supabase migration system
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  // Try to construct from Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('Missing DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
    console.log('\nAvailable env vars:');
    Object.keys(process.env).filter(k => k.includes('SUPA') || k.includes('DATA') || k.includes('POST')).forEach(k => {
      console.log(`  ${k}: ${process.env[k]?.substring(0, 30)}...`);
    });
    process.exit(1);
  }
}

const migrationSQL = `
-- Migration: Add company_product_id to tables with deal_id
-- This enables the deal → product transition while maintaining backwards compatibility

-- ============================================
-- 1. Activities table
-- ============================================
ALTER TABLE activities
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activities_company_product_id ON activities(company_product_id);

COMMENT ON COLUMN activities.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 2. Tasks table
-- ============================================
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_company_product_id ON tasks(company_product_id);

COMMENT ON COLUMN tasks.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 3. Meeting transcriptions table
-- ============================================
ALTER TABLE meeting_transcriptions
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_company_product_id ON meeting_transcriptions(company_product_id);

COMMENT ON COLUMN meeting_transcriptions.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 4. Scheduling requests table
-- ============================================
ALTER TABLE scheduling_requests
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_requests_company_product_id ON scheduling_requests(company_product_id);

COMMENT ON COLUMN scheduling_requests.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 5. Command center items table
-- ============================================
ALTER TABLE command_center_items
ADD COLUMN IF NOT EXISTS company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_command_center_items_company_product_id ON command_center_items(company_product_id);

COMMENT ON COLUMN command_center_items.company_product_id IS 'Reference to company_products - replaces deal_id';

-- ============================================
-- 6. AI email drafts table
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_email_drafts' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_email_drafts' AND column_name = 'company_product_id' AND table_schema = 'public') THEN
      ALTER TABLE ai_email_drafts
      ADD COLUMN company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

      CREATE INDEX idx_ai_email_drafts_company_product_id ON ai_email_drafts(company_product_id);
    END IF;
  END IF;
END $$;

-- ============================================
-- 7. AI signals table
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_signals' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_signals' AND column_name = 'company_product_id' AND table_schema = 'public') THEN
      ALTER TABLE ai_signals
      ADD COLUMN company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

      CREATE INDEX idx_ai_signals_company_product_id ON ai_signals(company_product_id);
    END IF;
  END IF;
END $$;

-- ============================================
-- 8. Communications table
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communications' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'communications' AND column_name = 'company_product_id' AND table_schema = 'public') THEN
      ALTER TABLE communications
      ADD COLUMN company_product_id UUID REFERENCES company_products(id) ON DELETE SET NULL;

      CREATE INDEX idx_communications_company_product_id ON communications(company_product_id);
    END IF;
  END IF;
END $$;
`;

async function runMigration() {
  console.log('🚀 Running direct migration...\n');

  // Get the pooler URL from supabase
  const projectRef = 'gvdwkeagstfuqrcqgxbp'; // From typical Supabase URL pattern
  const password = process.env.SUPABASE_DB_PASSWORD;

  if (!password) {
    console.log('Note: SUPABASE_DB_PASSWORD not found.');
    console.log('Please run the migration SQL manually in Supabase Dashboard > SQL Editor');
    console.log('\nSQL to run:');
    console.log(migrationSQL);
    return;
  }

  const dbUrl = `postgres://postgres.${projectRef}:${password}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    await client.query(migrationSQL);
    console.log('✓ Migration executed successfully!\n');

    // Verify
    const result = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE column_name = 'company_product_id'
      AND table_schema = 'public'
      AND table_name IN ('activities', 'tasks', 'meeting_transcriptions', 'scheduling_requests', 'command_center_items')
      ORDER BY table_name;
    `);

    console.log('Verified columns:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}.${row.column_name}`);
    });

  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

runMigration();
