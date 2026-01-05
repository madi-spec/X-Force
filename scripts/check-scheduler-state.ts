import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get the most recent scheduling requests
  const { data: requests } = await supabase
    .from('scheduling_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('=== SCHEDULING REQUESTS ===\n');
  for (const r of requests || []) {
    console.log('ID:', r.id);
    console.log('Title:', r.title);
    console.log('Status:', r.status);
    console.log('Last Action At:', r.last_action_at);
    console.log('Selected Time:', r.selected_time);
    console.log('Calendar Event ID:', r.calendar_event_id);
    console.log('---');
  }

  // Get actions for the most recent request
  if (requests?.[0]) {
    const { data: actions } = await supabase
      .from('scheduling_actions')
      .select('*')
      .eq('scheduling_request_id', requests[0].id)
      .order('created_at', { ascending: false });

    console.log('\n=== ACTIONS FOR REQUEST', requests[0].id, '===\n');
    for (const a of actions || []) {
      console.log(a.created_at, '-', a.action_type, 'by', a.actor);
      if (a.message_content) {
        console.log('  Content:', a.message_content.substring(0, 100));
      }
    }
    console.log('\nTotal actions:', actions?.length || 0);
  }
}

check().catch(console.error);
