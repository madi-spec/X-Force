import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Fixing CC item user_id to match auth_id...');

  // Update CC item user_id to Brent Allen's auth_id
  const { data, error } = await supabase
    .from('command_center_items')
    .update({
      user_id: '51c8f003-710b-4071-b3a4-d9cd141b1296'  // Brent Allen's auth_id
    })
    .eq('id', 'dc0a3bde-714e-4dc1-801a-52ef6f25c566')
    .select('id, title, user_id, action_type, momentum_score');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Updated:', data);
  }
}

main();
