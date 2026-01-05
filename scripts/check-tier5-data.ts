import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check companies table structure
  const { data: companies, error: cErr } = await supabase.from('companies').select('id, name, user_id').limit(3);
  console.log('Companies sample:', companies);
  if (cErr) console.log('Companies error:', cErr.message);

  // Check contacts table
  const { data: contacts, error: ctErr } = await supabase.from('contacts').select('id, name, email, user_id, created_at').limit(3);
  console.log('\nContacts sample:', contacts);
  if (ctErr) console.log('Contacts error:', ctErr.message);

  // Check RI metrics - look for days_since_last_contact
  const { data: ri } = await supabase.from('relationship_intelligence').select('company_id, metrics').limit(5);
  console.log('\nRI metrics sample:');
  ri?.forEach(r => {
    console.log(`  ${r.company_id}: days_since_last_contact = ${r.metrics?.days_since_last_contact}`);
  });

  // Count total companies
  const { count: totalCompanies } = await supabase.from('companies').select('id', { count: 'exact', head: true });
  console.log('\nTotal companies:', totalCompanies);

  // Count total contacts
  const { count: totalContacts } = await supabase.from('contacts').select('id', { count: 'exact', head: true });
  console.log('Total contacts:', totalContacts);
}

main().catch(console.error);
