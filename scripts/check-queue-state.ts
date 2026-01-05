/**
 * Quick check of queue state after cleanup
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkQueue() {
  // Check communications for the specific company
  const { data: comms } = await supabase
    .from('communications')
    .select('id, subject, awaiting_our_response, responded_at, created_at')
    .eq('company_id', '09a70f12-a280-4ddb-b602-7d8282ab6888')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Recent communications for the company:');
  for (const c of (comms || [])) {
    console.log(`  - ${c.subject?.substring(0, 50) || '(no subject)'}`);
    console.log(`    awaiting_our_response: ${c.awaiting_our_response}, responded_at: ${c.responded_at || 'null'}`);
  }

  // Check open attention flags
  const { data: flags } = await supabase
    .from('attention_flags')
    .select('id, flag_type, status, reason')
    .eq('company_id', '09a70f12-a280-4ddb-b602-7d8282ab6888')
    .eq('status', 'open');

  console.log('\nOpen attention flags for the company:');
  console.log(`  Count: ${flags?.length || 0}`);
  for (const f of (flags || [])) {
    console.log(`  - ${f.flag_type}: ${f.reason?.substring(0, 60) || '(no reason)'}`);
  }

  // Check all needs_reply items across all companies
  const { data: allNeedsReply } = await supabase
    .from('communications')
    .select('id, company_id, subject')
    .eq('awaiting_our_response', true)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\nAll communications awaiting response (max 20):');
  console.log(`  Total count: ${allNeedsReply?.length || 0}`);
}

checkQueue().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
