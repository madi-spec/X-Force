import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get the FW: email
  const { data } = await supabase
    .from('communications')
    .select('id, subject, full_content, content_preview, their_participants, our_participants')
    .ilike('subject', '%FW:%')
    .is('company_id', null)
    .limit(3);

  if (!data || data.length === 0) {
    console.log('No forwarded unlinked emails found');
    return;
  }

  for (const comm of data) {
    console.log('='.repeat(60));
    console.log('Subject:', comm.subject);
    console.log('Their participants:', JSON.stringify(comm.their_participants, null, 2));
    console.log('Our participants:', JSON.stringify(comm.our_participants, null, 2));
    console.log('\nContent Preview:');
    console.log(comm.content_preview?.substring(0, 500) || '(empty)');
    console.log('\n--- Full Content (first 1000 chars) ---');
    console.log(comm.full_content?.substring(0, 1000) || '(empty)');
    console.log('');
  }
}

check().catch(console.error);
