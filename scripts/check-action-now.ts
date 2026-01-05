import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check recent communications that are awaiting response
  const { data: awaitingResponse, error: e1 } = await supabase
    .from('communications')
    .select('id, subject, company_id, awaiting_our_response, responded_at, created_at')
    .eq('awaiting_our_response', true)
    .is('responded_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('=== Awaiting Response (should show in Action Now) ===');
  console.log('Count:', awaitingResponse?.length || 0);
  awaitingResponse?.forEach(c => {
    console.log(`  [${c.created_at}] ${c.subject?.substring(0, 60)}`);
  });

  // Check most recent communications regardless of status
  const { data: recent, error: e2 } = await supabase
    .from('communications')
    .select('id, subject, company_id, awaiting_our_response, responded_at, created_at, direction')
    .order('created_at', { ascending: false })
    .limit(15);

  console.log('\n=== 15 Most Recent Communications ===');
  recent?.forEach(c => {
    const responded = c.responded_at ? 'YES' : 'NO';
    const awaiting = c.awaiting_our_response ? 'YES' : 'NO';
    console.log(`  [${c.created_at}] ${c.direction} | awaiting=${awaiting} responded=${responded} | ${c.subject?.substring(0, 40)}`);
  });

  // Check if email sync has run recently
  const { data: syncLogs } = await supabase
    .from('sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n=== Recent Sync Logs ===');
  syncLogs?.forEach(s => {
    console.log(`  [${s.created_at}] ${s.sync_type} - ${s.status} (${s.items_processed || 0} items)`);
  });
}

check().catch(console.error);
