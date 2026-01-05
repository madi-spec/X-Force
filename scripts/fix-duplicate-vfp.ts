import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fix() {
  console.log('Fixing duplicate Ivey Exterminating entry...\n');

  // Mark the older Dec 23 email as responded (since there's been newer activity)
  const { error } = await supabase
    .from('communications')
    .update({
      awaiting_our_response: false,
      responded_at: new Date().toISOString()
    })
    .eq('id', '13c3822e-7e89-4497-bd23-5fb66d7b1791');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✓ Marked older VFP email (Dec 23) as responded');
  }

  // Verify
  const { data } = await supabase
    .from('communications')
    .select('id, subject, occurred_at, awaiting_our_response')
    .ilike('subject', '%x-rai free trial form VFP%')
    .eq('awaiting_our_response', true);

  console.log('\nRemaining VFP emails awaiting response:');
  data?.forEach(d => console.log(`  [${d.occurred_at}] ${d.subject}`));
  console.log(`\nTotal: ${data?.length || 0}`);
}
fix();
