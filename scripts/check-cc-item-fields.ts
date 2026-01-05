import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get all columns
  const { data, error } = await supabase
    .from('command_center_items')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('command_center_items columns:');
  console.log(Object.keys(data).filter(k => k.includes('source') || k.includes('comm') || k.includes('id')));

  console.log('\nSample values:');
  console.log('  source_type:', data.source_type);
  console.log('  source_id:', data.source_id);
  console.log('  communication_id:', data.communication_id);
}

check().catch(console.error);
