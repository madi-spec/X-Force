/**
 * Check Tupelo scheduling request
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // Find scheduling request for Tupelo
  const companyId = '09a70f12-a280-4ddb-b602-7d8282ab6888';

  const { data: requests } = await supabase
    .from('scheduling_requests')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  console.log('=== Scheduling Requests for Tupelo ===');
  console.log('Found:', requests?.length || 0);

  for (const r of requests || []) {
    console.log('\nRequest ID:', r.id);
    console.log('Status:', r.status);
    console.log('Created:', r.created_at);
    console.log('Proposed times:', r.proposed_times);
    console.log('Scheduled time:', r.scheduled_time);
    console.log('Attempt count:', r.attempt_count);
    console.log('Next action:', r.next_action_type, 'at', r.next_action_at);

    console.log('\nConversation history:');
    for (const msg of r.conversation_history || []) {
      console.log('  [' + msg.direction + '] ' + msg.timestamp);
      console.log('    Subject:', msg.subject);
      console.log('    Body:', msg.body?.substring(0, 300));
    }
  }

  // Check scheduling actions
  console.log('\n\n=== All Recent Scheduling Actions ===');
  const { data: actions } = await supabase
    .from('scheduling_actions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  for (const a of actions || []) {
    console.log('\n---');
    console.log('Request ID:', a.scheduling_request_id);
    console.log('Action:', a.action_type);
    console.log('Created:', a.created_at);
    console.log('Actor:', a.actor);
    console.log('Subject:', a.message_subject);
    console.log('AI Reasoning:', a.ai_reasoning?.substring(0, 200));
    console.log('Content preview:', a.message_content?.substring(0, 200));
  }

  // Also search for any scheduling request that might be related
  console.log('\n\n=== Recent Scheduling Requests ===');
  const { data: allRequests } = await supabase
    .from('scheduling_requests')
    .select('id, company_id, status, created_at, next_action_type')
    .order('created_at', { ascending: false })
    .limit(10);

  for (const r of allRequests || []) {
    console.log('\n---');
    console.log('ID:', r.id);
    console.log('Company:', r.company_id);
    console.log('Status:', r.status);
    console.log('Created:', r.created_at);
    console.log('Next Action:', r.next_action_type);
  }
}

run().catch(console.error);
