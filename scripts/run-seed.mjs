import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get database URL from environment or use default
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres';

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 1,
  idle_timeout: 20,
  connect_timeout: 30,
});

async function runSeed() {
  try {
    console.log('Reading seed file...');
    const seedPath = join(__dirname, '..', 'supabase', 'migrations', '00009_comprehensive_seed.sql');
    const seedSql = readFileSync(seedPath, 'utf8');

    console.log('Running seed migration...');
    await sql.unsafe(seedSql);

    console.log('Seed completed successfully!');

    // Verify counts
    const [users] = await sql`SELECT COUNT(*) as count FROM users`;
    const [companies] = await sql`SELECT COUNT(*) as count FROM companies`;
    const [contacts] = await sql`SELECT COUNT(*) as count FROM contacts`;
    const [deals] = await sql`SELECT COUNT(*) as count FROM deals`;
    const [activities] = await sql`SELECT COUNT(*) as count FROM activities`;

    console.log('\nData summary:');
    console.log(`  Users: ${users.count}`);
    console.log(`  Companies: ${companies.count}`);
    console.log(`  Contacts: ${contacts.count}`);
    console.log(`  Deals: ${deals.count}`);
    console.log(`  Activities: ${activities.count}`);

  } catch (error) {
    console.error('Error running seed:', error.message);
    if (error.position) {
      console.error('Error position:', error.position);
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runSeed();
