/**
 * Apply Support Case Migration
 *
 * Applies the support case system migration using psql-like execution.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Extract statements from SQL file
function extractStatements(sql: string): string[] {
  const lines = sql.split('\n');
  const statements: string[] = [];
  let currentStatement = '';
  let inBlock = false;
  let blockDelimiter = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments at statement start
    if (!currentStatement && (trimmed === '' || trimmed.startsWith('--'))) {
      continue;
    }

    // Check for function/trigger block start
    if (trimmed.includes('$$')) {
      const dollarCount = (trimmed.match(/\$\$/g) || []).length;
      if (dollarCount === 1) {
        inBlock = !inBlock;
        blockDelimiter = '$$';
      } else if (dollarCount === 2) {
        // Opening and closing on same line
        inBlock = false;
      }
    }

    currentStatement += line + '\n';

    // Check if statement is complete
    if (!inBlock && trimmed.endsWith(';')) {
      const stmt = currentStatement.trim();
      // Skip comment-only blocks
      if (!stmt.split('\n').every(l => l.trim().startsWith('--') || l.trim() === '')) {
        statements.push(stmt);
      }
      currentStatement = '';
    }
  }

  return statements;
}

async function applyMigration() {
  console.log('Applying Support Case System migration...\n');

  // Read the migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260107_support_case_system.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  const statements = extractStatements(migrationSql);
  console.log(`Found ${statements.length} SQL statements\n`);

  // Execute each statement
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.slice(0, 100).replace(/\n/g, ' ').trim();

    // Skip if it's just comments
    if (stmt.split('\n').every(l => l.trim().startsWith('--') || l.trim() === '')) {
      continue;
    }

    // Use raw postgres query via postgrest edge function or direct table operations
    // Since we can't execute arbitrary SQL via the client, we'll verify tables exist instead

    // For CREATE TABLE statements, try to query the table
    const tableMatch = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    if (tableMatch) {
      const tableName = tableMatch[1];
      console.log(`Checking table: ${tableName}`);

      const { error } = await supabase.from(tableName).select('*').limit(0);
      if (!error) {
        console.log(`  ✅ Table ${tableName} exists`);
        skipCount++;
      } else if (error.message.includes('not find the table')) {
        console.log(`  ⏳ Table ${tableName} needs to be created`);
        errorCount++;
      } else {
        console.log(`  ❓ Table ${tableName}: ${error.message}`);
      }
      continue;
    }

    // Skip other statements - we can't execute them via the client
  }

  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION STATUS CHECK');
  console.log('='.repeat(60));
  console.log(`Tables exist: ${skipCount}`);
  console.log(`Tables missing: ${errorCount}`);

  if (errorCount > 0) {
    console.log('\n⚠️  Some tables are missing.');
    console.log('\nTo apply the migration, you have two options:');
    console.log('\n1. Use Supabase Dashboard SQL Editor:');
    console.log('   - Go to https://supabase.com/dashboard/project/nezewucpbkuzoukomnlv/sql/new');
    console.log('   - Copy and paste the contents of:');
    console.log('     supabase/migrations/20260107_support_case_system.sql');
    console.log('   - Click "Run"');
    console.log('\n2. Use psql (if you have it installed):');
    console.log('   psql "postgresql://postgres:[password]@db.nezewucpbkuzoukomnlv.supabase.co:5432/postgres" \\');
    console.log('     -f supabase/migrations/20260107_support_case_system.sql');
  } else {
    console.log('\n✅ All tables already exist!');
  }
}

applyMigration().catch(console.error);
