import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createAdminClient } from '../src/lib/supabase/admin';

async function check() {
  const supabase = createAdminClient();

  // Check follow-up items by user
  const { data } = await supabase
    .from('command_center_items')
    .select('user_id, action_type')
    .eq('status', 'pending')
    .in('action_type', ['follow_up', 'meeting_follow_up', 'call']);

  const byUser: Record<string, number> = {};
  for (const item of data || []) {
    byUser[item.user_id] = (byUser[item.user_id] || 0) + 1;
  }
  
  console.log('Follow-up items (follow_up, meeting_follow_up, call) by user_id:');
  for (const [userId, count] of Object.entries(byUser)) {
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();
    console.log('  ' + (user?.email || userId) + ': ' + count);
  }
  
  console.log('\nTotal follow-up items:', (data || []).length);
}

check().catch(console.error);
