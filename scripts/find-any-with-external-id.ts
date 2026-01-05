import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function find() {
  // Find any communications with external_id
  const { data: comms, error } = await supabase
    .from('communications')
    .select('id, external_id, contact_id, company_id, subject, direction, occurred_at')
    .not('external_id', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(5);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Communications with external_id:', comms?.length || 0);

  for (const c of comms || []) {
    console.log('\n----------------------------------------');
    console.log('Comm ID:', c.id);
    console.log('Subject:', c.subject?.substring(0, 50));
    console.log('Direction:', c.direction);
    console.log('Contact ID:', c.contact_id);
    console.log('Company ID:', c.company_id);
    console.log('external_id:', c.external_id?.substring(0, 40) + '...');

    // Check if there's a command center item for this contact
    if (c.contact_id) {
      const { data: ccItem } = await supabase
        .from('command_center_items')
        .select('id, title, status')
        .eq('contact_id', c.contact_id)
        .eq('status', 'pending')
        .limit(1)
        .single();

      if (ccItem) {
        console.log('HAS PENDING CC ITEM:', ccItem.id);
        console.log('  Title:', ccItem.title?.substring(0, 40));
      }
    }
  }
}

find().catch(console.error);
