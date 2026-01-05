import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const requestId = 'fd360b3e-b42a-4d52-b612-94b6e8b0e294';

const { data: request, error } = await supabase
  .from('scheduling_requests')
  .select('*')
  .eq('id', requestId)
  .single();

if (error) {
  console.log('Error:', error);
} else {
  console.log('Final scheduling request state:');
  console.log('Status:', request.status);
  console.log('Selected time:', request.selected_time);
  console.log('Next action:', request.next_action_type);
  console.log('Last action at:', request.last_action_at);
  console.log('Proposed times:', request.proposed_times);
}

// Also check recent actions
const { data: actions } = await supabase
  .from('scheduling_actions')
  .select('action_type, actor, ai_reasoning, created_at')
  .eq('scheduling_request_id', requestId)
  .order('created_at', { ascending: false })
  .limit(5);

if (actions && actions.length > 0) {
  console.log('\nRecent actions:');
  for (const a of actions) {
    console.log(`- ${a.action_type} by ${a.actor} at ${a.created_at}`);
    if (a.ai_reasoning) console.log(`  Reasoning: ${a.ai_reasoning.substring(0, 100)}...`);
  }
}
