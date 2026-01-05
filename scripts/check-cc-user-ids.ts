import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function checkUserIds() {
  const supabase = createAdminClient();

  // Get all unique user_ids from pending command_center_items
  const { data: items } = await supabase
    .from('command_center_items')
    .select('user_id')
    .eq('status', 'pending');

  const userIds = new Set<string>();
  for (const item of items || []) {
    if (item.user_id) userIds.add(item.user_id);
  }

  console.log('Unique user_ids in pending CC items:', userIds.size);

  // For each user_id, get user info and count
  for (const userId of userIds) {
    const { count } = await supabase
      .from('command_center_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('user_id', userId);

    const { data: user } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    console.log(`\nUser: ${user?.email || 'Unknown'} (${userId})`);
    console.log(`  Name: ${user?.name || 'N/A'}`);
    console.log(`  Pending items: ${count}`);
  }

  // Also get items with null user_id
  const { count: nullCount } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .is('user_id', null);

  if (nullCount && nullCount > 0) {
    console.log(`\nItems with NULL user_id: ${nullCount}`);
  }
}

checkUserIds().catch(console.error);
