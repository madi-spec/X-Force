import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearContextSummaries() {
  const { data, error } = await supabase
    .from('command_center_items')
    .update({ context_brief: null })
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Cleared context from', data?.length, 'items');
  }
}

clearContextSummaries();
