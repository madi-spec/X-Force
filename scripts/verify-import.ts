import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check how many companies have domain set
  const { count: withDomain } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .not('domain', 'is', null);

  const { count: withAgentCount } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .gt('agent_count', 0);

  const { count: totalContacts } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true });

  console.log('Companies with domain:', withDomain);
  console.log('Companies with agent_count > 0:', withAgentCount);
  console.log('Total contacts now:', totalContacts);

  // Sample of newly created contacts
  const { data: recentContacts } = await supabase
    .from('contacts')
    .select('name, email, phone, company:companies(name)')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\nRecent contacts:');
  recentContacts?.forEach((c) => {
    console.log(`  - ${c.name} <${c.email}> ${c.phone || ''} @ ${(c.company as { name: string })?.name}`);
  });
}

check().catch(console.error);
