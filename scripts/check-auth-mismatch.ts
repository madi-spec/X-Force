import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function check() {
  const supabase = createAdminClient();

  // Get the user from users table
  const { data: appUser } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('email', 'xraisales@affiliatedtech.com')
    .single();

  console.log('App user (users table):');
  console.log('  ID:', appUser?.id);
  console.log('  Email:', appUser?.email);

  // Check auth.users via admin API
  const { data: { users: authUsers }, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.log('\nError listing auth users:', error.message);
  }

  const authUser = authUsers?.find(u => u.email === 'xraisales@affiliatedtech.com');

  console.log('\nAuth user (auth.users):');
  console.log('  ID:', authUser?.id || 'NOT FOUND');
  console.log('  Email:', authUser?.email || 'N/A');

  // Check if they match
  if (appUser && authUser && appUser.id !== authUser.id) {
    console.log('\n⚠️  MISMATCH! App user ID and Auth user ID are different!');
    console.log('   Command center items have user_id:', appUser.id);
    console.log('   But auth.uid() returns:', authUser.id);
    console.log('\n   RLS policy checks auth.uid() = user_id, so queries return 0 rows');
    console.log('\n   FIX: Update command_center_items to use the auth user ID');
  } else if (appUser && authUser) {
    console.log('\n✅ IDs match!');
  }

  // Count items by user_id
  console.log('\n--- Command Center Items by user_id ---');
  const { data: items } = await supabase
    .from('command_center_items')
    .select('user_id')
    .eq('status', 'pending');

  const counts: Record<string, number> = {};
  for (const item of items || []) {
    counts[item.user_id] = (counts[item.user_id] || 0) + 1;
  }

  for (const [uid, count] of Object.entries(counts)) {
    console.log(`  ${uid}: ${count} items`);
  }
}

check().catch(console.error);
