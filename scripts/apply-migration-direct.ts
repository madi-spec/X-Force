import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.local' });

async function applyMigration() {
  console.log('Applying migration: Allow null company_id in activities table...\n');

  // Extract connection string from supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Build postgres connection string
  // Supabase URL format: https://project-ref.supabase.co
  const projectRef = supabaseUrl.split('//')[1].split('.')[0];
  const connectionString = `postgresql://postgres.${projectRef}:${serviceKey}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

  console.log('Connecting to database...');
  console.log('Project ref:', projectRef);

  const sql = postgres(connectionString, {
    ssl: 'require',
    connection: {
      application_name: 'migration-script'
    }
  });

  try {
    // Check current state
    const check = await sql`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'activities' AND column_name = 'company_id'
    `;
    console.log('Current state:', check);

    // Apply migration
    await sql`ALTER TABLE activities ALTER COLUMN company_id DROP NOT NULL`;
    console.log('Successfully removed NOT NULL constraint');

    // Verify
    const verify = await sql`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'activities' AND column_name = 'company_id'
    `;
    console.log('After migration:', verify);

    // Create index for null company_id records
    await sql`
      CREATE INDEX IF NOT EXISTS idx_activities_null_company
      ON activities(user_id, occurred_at DESC)
      WHERE company_id IS NULL
    `;
    console.log('Created index for null company_id records');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sql.end();
  }
}

applyMigration().catch(console.error);
