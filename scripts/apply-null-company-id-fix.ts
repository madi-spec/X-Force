import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function applyFix() {
  console.log('Applying fix: Allow null company_id in activities table...\n');

  // Check current constraint
  const { data: constraints } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'activities' AND column_name = 'company_id'
      `
    });

  console.log('Current constraint:', constraints);

  // Use raw SQL to alter the table
  const { error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE activities ALTER COLUMN company_id DROP NOT NULL;`
  });

  if (error) {
    console.error('Error applying fix:', error);
    // Try alternate approach
    console.log('Trying alternate approach...');
  } else {
    console.log('Successfully removed NOT NULL constraint from company_id');
  }
}

applyFix().catch(console.error);
