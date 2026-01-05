import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Updating CC item with high momentum_score...');

  const { data, error } = await supabase
    .from('command_center_items')
    .update({
      momentum_score: 95  // High score to win deduplication
    })
    .eq('id', 'dc0a3bde-714e-4dc1-801a-52ef6f25c566')
    .select('id, title, company_id, company_name, action_type, momentum_score');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Updated:', data);
  }
}

main();
