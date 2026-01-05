import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function fix() {
  const supabase = createAdminClient();

  const oldUserId = '11111111-1111-1111-1111-111111111009';
  const newUserId = '51c8f003-710b-4071-b3a4-d9cd141b1296';

  console.log('Updating command_center_items user_id...');
  console.log('  From:', oldUserId);
  console.log('  To:', newUserId);

  const { data, error } = await supabase
    .from('command_center_items')
    .update({ user_id: newUserId })
    .eq('user_id', oldUserId)
    .select('id');

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('✅ Updated', data?.length || 0, 'items');
  }

  // Verify
  const { count } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', newUserId)
    .eq('status', 'pending');

  console.log('\nVerification: User', newUserId, 'now has', count, 'pending items');
}

fix().catch(console.error);
