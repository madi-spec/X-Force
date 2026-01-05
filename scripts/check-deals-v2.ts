import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const userId = '11111111-1111-1111-1111-111111111009';

async function main() {
  // Check deals without user filter
  const { data: allDeals, error: allErr } = await supabase
    .from('deals')
    .select('id, title, company_id, user_id')
    .limit(5);

  console.log('All deals sample:', allDeals);
  if (allErr) console.log('Error:', allErr.message);

  // Check deals for specific user
  const { data: userDeals, error: userErr } = await supabase
    .from('deals')
    .select('id, title, company_id')
    .eq('user_id', userId)
    .limit(5);

  console.log('\nUser deals:', userDeals);
  if (userErr) console.log('User error:', userErr.message);

  // Also get companies from RI records instead
  const { data: riRecords } = await supabase
    .from('relationship_intelligence')
    .select('company_id')
    .not('company_id', 'is', null);

  const companyIds = [...new Set((riRecords || []).map(r => r.company_id))];
  console.log('\nUnique companies from RI:', companyIds.length);

  // Check if these companies have intelligence_data
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, intelligence_data')
      .in('id', companyIds.slice(0, 10));

    console.log('\nCompanies with intelligence_data check:');
    for (const c of companies || []) {
      const keys = Object.keys(c.intelligence_data || {});
      console.log(`  ${c.name}: ${keys.length} keys (${keys.length < 3 ? 'MINIMAL' : 'ok'})`);
    }
  }
}

main().catch(console.error);
