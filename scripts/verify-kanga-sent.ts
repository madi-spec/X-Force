import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data } = await supabase
    .from('scheduling_requests')
    .select('id, status, attempt_count, last_action_at, email_thread_id')
    .eq('id', '06791f7a-94d4-4569-ae3b-b8da113916a4')
    .single();

  console.log('Kanga request status:', data?.status);
  console.log('Attempt count:', data?.attempt_count);
  console.log('Last action:', data?.last_action_at);
  console.log('Email thread ID:', data?.email_thread_id ? 'Set' : 'Not set');

  const { data: actions } = await supabase
    .from('scheduling_actions')
    .select('action_type, created_at, message_subject')
    .eq('scheduling_request_id', '06791f7a-94d4-4569-ae3b-b8da113916a4')
    .order('created_at', { ascending: false });

  console.log('\nActions:');
  actions?.forEach(a => {
    console.log(`  - ${a.action_type}: ${a.message_subject || 'N/A'} (${a.created_at})`);
  });
}

check().catch(console.error);
