import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get a sample unknown company communication
  const { data: comms, error } = await supabase
    .from('communications')
    .select('id, subject, company_id, excluded_at, excluded_by')
    .is('company_id', null)
    .eq('awaiting_our_response', true)
    .limit(3);

  if (error) {
    console.log('Error querying:', error.message);
    return;
  }

  console.log('Unknown company communications:');
  if (comms && comms.length > 0) {
    comms.forEach(c => {
      console.log(`  ID: ${c.id}`);
      console.log(`  Subject: ${c.subject?.substring(0, 40)}`);
      console.log(`  Excluded: ${c.excluded_at || 'no'}`);
      console.log('');
    });
  } else {
    console.log('  None found');
  }
}

check().catch(e => console.error('Error:', e));
