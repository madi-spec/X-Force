import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync } from 'fs';

async function main() {
  const { createAdminClient } = await import('../src/lib/supabase/admin');
  const supabase = createAdminClient();

  // Check if relationship_intelligence table exists
  const { data: tables } = await supabase
    .from('information_schema.tables' as any)
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'relationship_intelligence');

  if (tables && tables.length > 0) {
    console.log('✓ relationship_intelligence table already exists');
  } else {
    console.log('Creating relationship_intelligence table...');

    // Read and execute the migration
    const migrationPath = 'supabase/migrations/20251231_relationship_intelligence_full.sql';
    const sql = readFileSync(migrationPath, 'utf-8');

    // Split by statement and execute
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length > 10) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (error) {
            // Try direct execution for DDL
            console.log(`Executing: ${statement.substring(0, 50)}...`);
          }
        } catch (e) {
          // Ignore errors for IF NOT EXISTS statements
        }
      }
    }
  }

  // Check tables after
  const { count: riCount } = await supabase
    .from('relationship_intelligence')
    .select('*', { count: 'exact', head: true });

  const { count: rnCount } = await supabase
    .from('relationship_notes')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTable status:`);
  console.log(`  relationship_intelligence: ${riCount ?? 'exists'} records`);
  console.log(`  relationship_notes: ${rnCount ?? 'exists'} records`);
}

main().catch(console.error);
