import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get a sample item to see its structure
  console.log('=== CC Items sample ===');
  const { data: sample, error: sampleError } = await supabase
    .from('command_center_items')
    .select('*')
    .limit(1)
    .single();
  
  if (sampleError) console.error('Sample Error:', sampleError);
  if (sample) console.log('Columns:', Object.keys(sample));
  console.log('Sample:', sample);

  console.log('\n=== CC Items with null company_id ===');
  const { data: nullItems, error: nullError } = await supabase
    .from('command_center_items')
    .select('id, title, company_id, deal_id, action_type, metadata')
    .is('company_id', null)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (nullError) console.error('Null Error:', nullError);
  console.log(nullItems);
}

main().catch(console.error);
