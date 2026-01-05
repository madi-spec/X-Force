import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function find() {
  // Get an email_inbound item with contact_id
  const { data: item } = await supabase
    .from('command_center_items')
    .select('id, title, contact_id, company_name, created_at')
    .eq('source', 'email_inbound')
    .not('contact_id', 'is', null)
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (!item) {
    console.log('No email_inbound item found with contact_id');
    return;
  }

  console.log('Test item:');
  console.log('  ID:', item.id);
  console.log('  Title:', item.title?.substring(0, 50));
  console.log('  Contact ID:', item.contact_id);
  console.log('  Company:', item.company_name);

  // Find communications for this contact with external_id
  const { data: comms } = await supabase
    .from('communications')
    .select('id, external_id, subject, direction, occurred_at')
    .eq('contact_id', item.contact_id)
    .not('external_id', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(3);

  console.log('\nCommunications with external_id for this contact:');
  comms?.forEach(c => {
    console.log('  -', c.direction, c.subject?.substring(0, 40));
    console.log('    external_id:', c.external_id?.substring(0, 50) + '...');
  });

  if (comms && comms.length > 0) {
    console.log('\n✓ We can test tagging! Use the command center to complete/snooze this item.');
    console.log('  Then check Outlook for X-FORCE category on the email.');
  }
}

find().catch(console.error);
