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
    .select('id, source, source_id, email_id, source_links')
    .eq('source', 'email_inbound')
    .limit(3);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Email-based command center items:');
  data?.forEach((item, i) => {
    console.log(`\n${i + 1}. ID: ${item.id}`);
    console.log(`   source: ${item.source}`);
    console.log(`   source_id: ${item.source_id}`);
    console.log(`   email_id: ${item.email_id}`);
    console.log(`   source_links: ${JSON.stringify(item.source_links)}`);
  });
}

check().catch(console.error);
