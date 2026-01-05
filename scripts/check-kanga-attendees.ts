import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const requestId = '06791f7a-94d4-4569-ae3b-b8da113916a4';

  // Check with correct column name
  const { data, error } = await supabase
    .from('scheduling_attendees')
    .select('*')
    .eq('scheduling_request_id', requestId);

  console.log('Query error:', error?.message || 'none');
  console.log('Attendees for Kanga request:', JSON.stringify(data, null, 2));

  // Also check all attendees
  const { count } = await supabase.from('scheduling_attendees').select('*', { count: 'exact', head: true });
  console.log('\nTotal attendees in table:', count);

  // Check scheduling_actions for this request
  const { data: actions } = await supabase
    .from('scheduling_actions')
    .select('*')
    .eq('scheduling_request_id', requestId);

  console.log('\nActions for this request:', JSON.stringify(actions, null, 2));
}

check().catch(console.error);
