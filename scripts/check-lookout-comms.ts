/**
 * Check Lookout communications
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LOOKOUT_ID = 'cf829e83-ecd6-4f11-ba36-a3bdb876c6be';

async function run() {
  const { data, count } = await supabase
    .from('communications')
    .select('id, subject, channel, direction, occurred_at', { count: 'exact' })
    .eq('company_id', LOOKOUT_ID)
    .order('occurred_at', { ascending: false })
    .limit(5);

  console.log('=== Lookout Communications ===');
  console.log(`Total: ${count || 0}`);

  if (data && data.length > 0) {
    for (const c of data) {
      const subject = c.subject ? c.subject.substring(0, 50) : '(no subject)';
      console.log(`  [${c.channel}] ${c.direction}: ${subject}`);
      console.log(`    ${c.occurred_at}`);
    }
  } else {
    console.log('  No communications found');
  }
}

run().catch(console.error);
