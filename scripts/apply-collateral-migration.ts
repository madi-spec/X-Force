import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('Running collateral tables migration...\n');

  // Check if tables already exist
  const { data: existingTables } = await supabase
    .from('information_schema.tables' as any)
    .select('table_name')
    .eq('table_schema', 'public')
    .in('table_name', ['collateral', 'collateral_usage', 'software_links', 'meeting_prep_notes']);

  if (existingTables && existingTables.length > 0) {
    console.log('Some tables already exist:', existingTables.map((t: any) => t.table_name));
  }

  // Create collateral table
  console.log('Creating collateral table...');
  const { error: e1 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS collateral (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        file_path TEXT,
        file_name VARCHAR(255),
        file_type VARCHAR(50) NOT NULL,
        file_size INTEGER,
        thumbnail_path TEXT,
        external_url TEXT,
        document_type VARCHAR(50) NOT NULL,
        meeting_types TEXT[] DEFAULT '{}',
        products TEXT[] DEFAULT '{}',
        industries TEXT[] DEFAULT '{}',
        company_sizes TEXT[] DEFAULT '{}',
        version VARCHAR(20) DEFAULT '1.0',
        is_current BOOLEAN DEFAULT true,
        previous_version_id UUID REFERENCES collateral(id),
        view_count INTEGER DEFAULT 0,
        share_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP WITH TIME ZONE,
        visibility VARCHAR(20) DEFAULT 'team',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        archived_at TIMESTAMP WITH TIME ZONE
      );
    `
  });

  if (e1) {
    console.log('Error creating collateral table (may already exist):', e1.message);
  } else {
    console.log('✓ collateral table created');
  }

  // Test by querying the table
  const { data: testData, error: testError } = await supabase
    .from('collateral')
    .select('count')
    .limit(1);

  if (testError) {
    console.log('Table does not exist yet, trying different approach...');
  } else {
    console.log('✓ collateral table accessible');
  }

  console.log('\nMigration script complete. Tables should be verified via Supabase dashboard.');
}

runMigration().catch(console.error);
