import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function find() {
  // Check the ai_recommendation items that have source_id
  const { data: items } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, status')
    .not('source_id', 'is', null)
    .eq('status', 'pending')
    .limit(5);

  console.log('Items with source_id:');
  for (const item of items || []) {
    console.log('\n----------------------------------------');
    console.log('Item:', item.id);
    console.log('Title:', item.title?.substring(0, 60));
    console.log('Source:', item.source);
    console.log('source_id:', item.source_id);

    // Check if source_id links to a communication with external_id
    const { data: comm } = await supabase
      .from('communications')
      .select('id, external_id, subject')
      .eq('id', item.source_id)
      .single();

    if (comm) {
      console.log('Links to communication:', comm.subject?.substring(0, 40));
      console.log('Has external_id:', comm.external_id ? 'YES ✓' : 'NO');
    } else {
      console.log('No communication found with this ID');
    }
  }

  // Also check the email_inbound items to see what fields they do have
  console.log('\n\n========================================');
  console.log('Checking an email_inbound item fields:');

  const { data: emailItem } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('source', 'email_inbound')
    .limit(1)
    .single();

  if (emailItem) {
    const fields = Object.entries(emailItem)
      .filter(([_, v]) => v !== null)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v.substring(0, 50) : v}`);
    console.log('Non-null fields:');
    fields.forEach(f => console.log('  ', f));
  }
}

find().catch(console.error);
