import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data } = await supabase
    .from('command_center_items')
    .select('id, title, conversation_id, email_id, source_id')
    .eq('source', 'email_inbound')
    .is('source_id', null)
    .limit(5);

  console.log('Email items missing source_id:\n');
  data?.forEach(item => {
    console.log(`ID: ${item.id.substring(0, 8)}...`);
    console.log(`Title: ${item.title?.substring(0, 50)}`);
    console.log(`Has conversation_id: ${item.conversation_id ? 'YES' : 'NO'}`);
    console.log(`Has email_id: ${item.email_id ? 'YES' : 'NO'}`);
    console.log('---');
  });
}
check().catch(console.error);
