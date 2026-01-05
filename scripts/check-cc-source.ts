import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('command_center_items')
    .select('source, source_id, email_id')
    .limit(5);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Sample source values:');
  data?.forEach((item, i) => {
    console.log(`  ${i + 1}. source: ${item.source}, source_id: ${item.source_id}, email_id: ${item.email_id}`);
  });
}

check().catch(console.error);
