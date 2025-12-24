import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Resetting failed analyses to pending...\n');

  const { data, error } = await supabase
    .from('communications')
    .update({ analysis_status: 'pending' })
    .eq('analysis_status', 'failed')
    .select('id, subject');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Reset ${data?.length} communications to pending`);
  data?.slice(0, 5).forEach(c => console.log(`  - ${c.subject?.substring(0, 50)}`));
}

main().catch(console.error);
