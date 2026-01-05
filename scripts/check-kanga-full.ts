import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('scheduling_requests')
    .select('*')
    .eq('id', '06791f7a-94d4-4569-ae3b-b8da113916a4')
    .single();

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Full scheduling request:');
  console.log(JSON.stringify(data, null, 2));

  // Also check if there's a contact for this company
  if (data?.company_id) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, phone')
      .eq('company_id', data.company_id);

    console.log('\nContacts for this company:');
    contacts?.forEach(c => {
      console.log(`  - ${c.name} <${c.email}> ${c.phone || ''}`);
    });
  }

  // Check scheduling_attendees table
  const { data: attendees } = await supabase
    .from('scheduling_attendees')
    .select('*')
    .eq('request_id', '06791f7a-94d4-4569-ae3b-b8da113916a4');

  console.log('\nAttendees for this request:');
  console.log(JSON.stringify(attendees, null, 2));
}

check().catch(console.error);
