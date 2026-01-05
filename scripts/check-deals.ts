import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const userId = '11111111-1111-1111-1111-111111111009';

async function main() {
  const { data: deals, count } = await supabase
    .from('deals')
    .select('id, title, company_id, stage', { count: 'exact' })
    .eq('user_id', userId);

  console.log('Total deals:', count);
  console.log('Deals with company_id:', deals?.filter(d => d.company_id).length);
  console.log('Sample deals:');
  deals?.slice(0, 5).forEach(d =>
    console.log('  ', d.title?.substring(0, 40), '| company_id:', d.company_id ? 'YES' : 'null')
  );

  // Also check what company_ids exist in RI
  const { data: riCompanies } = await supabase
    .from('relationship_intelligence')
    .select('company_id')
    .not('company_id', 'is', null);

  console.log('\nRI records with company_id:', riCompanies?.length);
}

main().catch(console.error);
