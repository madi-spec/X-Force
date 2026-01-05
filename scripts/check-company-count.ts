import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get exact count
  const { count, error } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });

  console.log('Total companies in database:', count);

  if (count && count > 1000) {
    console.log('\n⚠️  More than 1000 companies! Supabase default limit is 1000.');
    console.log('Newer companies may not appear in lists without pagination.');
  }

  // Check if Superior Lawn Management would be included in first 1000 by name order
  const { data: ordered } = await supabase
    .from('companies')
    .select('name')
    .order('name')
    .limit(1000);

  const superiorInList = ordered?.some(c => c.name === 'Superior Lawn Management');
  console.log('\n"Superior Lawn Management" in first 1000 (by name order):', superiorInList ? 'YES' : 'NO');

  // Find its position
  const { data: all } = await supabase
    .from('companies')
    .select('name')
    .order('name');

  const position = all?.findIndex(c => c.name === 'Superior Lawn Management');
  console.log('Position in alphabetical list:', position !== undefined && position >= 0 ? position + 1 : 'Not found');
}
check();
