import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDomains() {
  // Domains found in email bodies that didn't match
  const domains = [
    'danapestcontrol.com',
    'yardguardmt.com',
    'theangryocto.com',
    'trianglehomeservices.com',
    'superiorlawn.net',
    'accelpest.com',
    'nutrigreentulsa.com'
  ];

  console.log('Checking if domains exist in companies table...\n');

  for (const domain of domains) {
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, domain, website')
      .or(`domain.ilike.%${domain}%,website.ilike.%${domain}%`);

    if (companies && companies.length > 0) {
      console.log(`✓ ${domain}:`);
      companies.forEach(c => console.log(`    → ${c.name} (domain: ${c.domain}, website: ${c.website})`));
    } else {
      console.log(`✗ ${domain}: No matching company found`);
    }
  }

  // Also show total companies with domains
  const { count } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .not('domain', 'is', null);

  console.log(`\nTotal companies with domains: ${count}`);
}

checkDomains().catch(console.error);
