import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function find() {
  // Search companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, domain, created_at')
    .ilike('name', '%superior%')
    .order('created_at', { ascending: false });

  console.log('Companies matching "Superior":');
  if (companies?.length) {
    companies.forEach(c => console.log(`  [${c.created_at}] ${c.name} (ID: ${c.id})`));
  } else {
    console.log('  None found');
  }

  // Check most recently created companies
  const { data: recent } = await supabase
    .from('companies')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\nMost recently created companies:');
  recent?.forEach(c => console.log(`  [${c.created_at}] ${c.name}`));
}
find();
