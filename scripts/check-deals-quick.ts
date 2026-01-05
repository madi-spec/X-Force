import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: deals, error, count } = await supabase
    .from('deals')
    .select('id, name, stage, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Total deals:', count);
  console.log('Error:', error);
  console.log('\nRecent deals:');
  deals?.forEach(d => console.log(`  - ${d.name} | stage: ${d.stage}`));
}

main().catch(console.error);
