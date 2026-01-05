import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Check the Enviro Management scheduling request
const requestId = '9818e288-9c29-4804-9554-b32fb63e0951';

console.log('=== URGENT: Checking Scheduling Request State ===\n');

const { data: request } = await supabase
  .from('scheduling_requests')
  .select('*')
  .eq('id', requestId)
  .single();

console.log('Status:', request?.status);
console.log('Scheduled Time:', request?.scheduled_time);
console.log('Calendar Event ID:', request?.calendar_event_id);
console.log('Meeting Link:', request?.meeting_link);
console.log('Last Action At:', request?.last_action_at);
console.log('Timezone:', request?.timezone);

if (request?.scheduled_time) {
  const scheduledDate = new Date(request.scheduled_time);
  console.log('\nScheduled Time Analysis:');
  console.log('  - Stored (UTC):', scheduledDate.toISOString());
  console.log('  - In ET:', scheduledDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

// Check recent activities/actions
console.log('\n=== Recent Scheduling Actions ===\n');

const { data: actions } = await supabase
  .from('scheduling_actions')
  .select('*')
  .eq('scheduling_request_id', requestId)
  .order('created_at', { ascending: false })
  .limit(10);

for (const action of actions || []) {
  console.log('---');
  console.log('Time:', action.created_at);
  console.log('Action:', action.action_type);
  console.log('Actor:', action.actor);
  console.log('Content:', action.message_content?.substring(0, 200));
}

// Check for any recent calendar events created
console.log('\n=== Recent Activities (meetings) ===\n');

const { data: activities } = await supabase
  .from('activities')
  .select('id, subject, occurred_at, created_at, external_id, metadata')
  .eq('type', 'meeting')
  .order('created_at', { ascending: false })
  .limit(5);

for (const act of activities || []) {
  console.log('---');
  console.log('Subject:', act.subject);
  console.log('Occurred At:', act.occurred_at);
  console.log('  - In ET:', new Date(act.occurred_at).toLocaleString('en-US', { timeZone: 'America/New_York' }));
  console.log('Created:', act.created_at);
  console.log('External ID:', act.external_id);
}
