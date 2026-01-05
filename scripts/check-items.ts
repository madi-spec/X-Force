import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  // Check items in database
  const { data: items, count } = await supabase
    .from('command_center_items')
    .select('id, title, tier, status, user_id, created_at, action_type, workflow_steps', { count: 'exact' })
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`Total active items: ${count}\n`);

  if (items?.length) {
    console.log('Recent items:');
    items.forEach((item, i) => {
      console.log(`${i + 1}. [T${item.tier}] ${item.title.substring(0, 50)}`);
      console.log(`   Status: ${item.status}, Type: ${item.action_type}`);
      console.log(`   User: ${item.user_id}`);
      console.log(`   Created: ${item.created_at}`);
      console.log(`   Workflow steps: ${item.workflow_steps ? (item.workflow_steps as any[]).length : 0}`);
      console.log('');
    });
  }

  // Check users
  const { data: users } = await supabase
    .from('users')
    .select('id, email, auth_id')
    .limit(5);

  console.log('\nUsers in system:');
  users?.forEach(u => {
    console.log(`  ${u.id} - ${u.email} (auth: ${u.auth_id?.substring(0, 8)}...)`);
  });

  // Check if items match user
  const { data: itemsByUser } = await supabase
    .from('command_center_items')
    .select('user_id')
    .in('status', ['pending', 'in_progress']);

  const userIds = new Set(itemsByUser?.map(i => i.user_id));
  console.log(`\nItems belong to ${userIds.size} unique user(s):`);
  userIds.forEach(id => console.log(`  ${id}`));
}

main().catch(console.error);
