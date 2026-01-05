import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Get all columns for one communication
  const { data, error } = await supabase
    .from('communications')
    .select('*')
    .eq('direction', 'inbound')
    .limit(1)
    .single();

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('All columns in communications:');
  console.log(Object.keys(data));

  console.log('\nSample values:');
  console.log('  source_id:', data.source_id);
  console.log('  external_id:', data.external_id);
  console.log('  metadata:', JSON.stringify(data.metadata)?.slice(0, 200));
}

check().catch(console.error);
