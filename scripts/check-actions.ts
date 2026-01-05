import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const requestId = 'e27a5c4d-bfa5-408b-b5db-25c69c2759ea';

  const { data: actions } = await supabase
    .from('scheduling_actions')
    .select('id, action_type, actor, message_subject, ai_reasoning, created_at')
    .eq('scheduling_request_id', requestId)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('=== Recent Actions for Request ===\n');
  for (const a of actions || []) {
    console.log(a.created_at + ': ' + a.action_type + ' by ' + a.actor);
    if (a.message_subject) console.log('    Subject: ' + a.message_subject);
    if (a.ai_reasoning) console.log('    Reasoning: ' + a.ai_reasoning.substring(0, 100) + '...');
    console.log('');
  }

  // Check for email_sent actions with isDraft
  const { data: request } = await supabase
    .from('scheduling_requests')
    .select('status, next_action_type, next_action_at')
    .eq('id', requestId)
    .single();

  console.log('=== Request Status ===');
  console.log('Status:', request?.status);
  console.log('Next action:', request?.next_action_type);
  console.log('Next action at:', request?.next_action_at);
}

check().catch(console.error);
