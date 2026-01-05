import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get one of the awaiting response communications with all fields
  const { data: comm, error } = await supabase
    .from('communications')
    .select('*')
    .eq('awaiting_our_response', true)
    .limit(1)
    .single();

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Sample communication awaiting response:');
  console.log('  id:', comm.id);
  console.log('  subject:', comm.subject);
  console.log('  company_id:', comm.company_id);
  console.log('  awaiting_our_response:', comm.awaiting_our_response);
  console.log('  responded_at:', comm.responded_at);
  console.log('  user_id:', comm.user_id);

  // Check if it has a company
  if (comm.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', comm.company_id)
      .single();
    console.log('  company:', company?.name);
  }
}
check().catch(e => console.error(e));
