import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // See where communications with external_id come from
  const { data, error } = await supabase
    .from('communications')
    .select('id, external_id, source_table, source_id, channel, created_at')
    .not('external_id', 'is', null)
    .limit(3);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Communications with external_id:');
  data?.forEach((c, i) => {
    console.log(`\n${i + 1}. ID: ${c.id}`);
    console.log('   external_id:', c.external_id?.substring(0, 50) + '...');
    console.log('   source_table:', c.source_table);
    console.log('   source_id:', c.source_id);
    console.log('   channel:', c.channel);
    console.log('   created_at:', c.created_at);
  });
}

check().catch(console.error);
