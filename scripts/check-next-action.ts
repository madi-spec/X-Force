import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data } = await supabase
    .from('scheduling_requests')
    .select('id, title, status, next_action_type, next_action_at, last_action_at')
    .eq('id', 'e27a5c4d-bfa5-408b-b5db-25c69c2759ea')
    .single();

  console.log('=== Scheduling Request State ===');
  console.log('  Status:', data?.status);
  console.log('  Last Action At:', data?.last_action_at);
  console.log('  Next Action Type:', data?.next_action_type);
  console.log('  Next Action At:', data?.next_action_at);

  if (data?.next_action_at) {
    const scheduled = new Date(data.next_action_at);
    const now = new Date();
    console.log('');
    console.log('=== Deferred Processing ===');
    console.log('  Scheduled at:', scheduled.toISOString());
    console.log('  Current time:', now.toISOString());
    console.log('  Ready to process:', now >= scheduled ? 'YES - Can trigger manually' : 'NO - Still waiting');

    if (now >= scheduled) {
      console.log('');
      console.log('To manually trigger processing, run:');
      console.log('  npx tsx scripts/test-process-response.ts');
    }
  }
}

check().catch(console.error);
