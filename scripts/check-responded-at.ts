import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check communications awaiting response with responded_at status
  const { data: comms, error } = await supabase
    .from('communications')
    .select('id, subject, awaiting_our_response, responded_at')
    .eq('awaiting_our_response', true)
    .limit(10);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Communications with awaiting_our_response=true:');
  comms?.forEach(c => {
    const status = c.responded_at === null ? 'NULL (should show)' : c.responded_at;
    console.log('  - responded_at:', status);
    console.log('    subject:', c.subject?.substring(0, 50));
  });

  // Check how many have responded_at IS NULL
  const { count: shouldShow } = await supabase
    .from('communications')
    .select('id', { count: 'exact', head: true })
    .eq('awaiting_our_response', true)
    .is('responded_at', null);

  console.log('\nCommunications that SHOULD show in Daily Driver:', shouldShow);

  // Check AI action log for excluded comms
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: aiHandled } = await supabase
    .from('ai_action_log')
    .select('communication_id')
    .eq('source', 'communications')
    .eq('status', 'success')
    .in('action_type', ['EMAIL_SENT', 'FLAG_CREATED'])
    .gte('created_at', twentyFourHoursAgo)
    .not('communication_id', 'is', null);

  console.log('AI-handled communications (excluded):', aiHandled?.length || 0);
}

check().catch(console.error);
