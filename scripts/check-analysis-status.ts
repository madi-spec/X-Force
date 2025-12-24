import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check Frame's email
  const { data: frame } = await supabase
    .from('communications')
    .select('id, subject, analysis_status, current_analysis_id')
    .eq('id', 'eeba9402-69e5-470b-875f-eb5214d816ac')
    .single();

  console.log('Frame email:', JSON.stringify(frame, null, 2));

  // Count by analysis status
  const { data: pending } = await supabase
    .from('communications')
    .select('id', { count: 'exact' })
    .eq('analysis_status', 'pending');

  const { data: failed } = await supabase
    .from('communications')
    .select('id', { count: 'exact' })
    .eq('analysis_status', 'failed');

  console.log('\nPending:', pending?.length);
  console.log('Failed:', failed?.length);

  // Show failed ones
  if (failed && failed.length > 0) {
    const { data: failedComms } = await supabase
      .from('communications')
      .select('id, subject')
      .eq('analysis_status', 'failed')
      .limit(5);
    console.log('\nFailed communications:');
    failedComms?.forEach(c => console.log(`  - ${c.subject?.substring(0, 50)}`));
  }
}

main().catch(console.error);
