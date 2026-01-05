import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.local' });

async function applyMigration() {
  console.log('Applying Process-Aware AI migration...\n');

  // Extract connection string from supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Build postgres connection string
  const projectRef = supabaseUrl.split('//')[1].split('.')[0];
  const connectionString = `postgresql://postgres.${projectRef}:${serviceKey}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

  console.log('Connecting to database...');
  console.log('Project ref:', projectRef);

  const sql = postgres(connectionString, {
    ssl: 'require',
    connection: {
      application_name: 'process-aware-ai-migration'
    }
  });

  try {
    // Check if column already exists
    const check = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'default_process_type'
    `;

    if (check.length > 0) {
      console.log('Column default_process_type already exists:', check);
      console.log('Migration already applied. Skipping.');
      return;
    }

    console.log('Column does not exist. Applying migration...');

    // Add the column
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS default_process_type TEXT
      DEFAULT 'sales'
    `;
    console.log('Added default_process_type column');

    // Add check constraint
    await sql`
      ALTER TABLE users
      ADD CONSTRAINT users_default_process_type_check
      CHECK (default_process_type IN ('sales', 'onboarding', 'engagement', 'support'))
    `;
    console.log('Added check constraint');

    // Add comment
    await sql`
      COMMENT ON COLUMN users.default_process_type IS
      'Default process context for AI features. Onboarding specialists set to onboarding, etc.'
    `;
    console.log('Added column comment');

    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_default_process_type
      ON users(default_process_type)
    `;
    console.log('Created index');

    // Verify
    const verify = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'default_process_type'
    `;
    console.log('\nVerification - Column added:', verify);

    // Check a sample user
    const sample = await sql`
      SELECT id, name, email, default_process_type
      FROM users
      LIMIT 3
    `;
    console.log('\nSample users with new column:', sample);

    console.log('\n✅ Migration applied successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

applyMigration().catch(console.error);
