/**
 * Fix user auth mapping and reassign items
 *
 * Run with: npx tsx scripts/fix-user-auth.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  console.log('=== USER AUTH MAPPING ===\n');

  // Get all users with their auth_id
  const { data: users } = await supabase
    .from('users')
    .select('id, email, auth_id')
    .order('email');

  console.log('Internal users:');
  users?.forEach(u => {
    const authStatus = u.auth_id ? `auth_id: ${u.auth_id}` : 'NO AUTH_ID';
    console.log(`  ${u.email}`);
    console.log(`    internal: ${u.id}`);
    console.log(`    ${authStatus}`);
    console.log('');
  });

  // Get auth users from Supabase Auth
  const { data: authData } = await supabase.auth.admin.listUsers();

  console.log('\nAuth users:');
  authData?.users?.forEach(u => {
    console.log(`  ${u.email}`);
    console.log(`    auth_id: ${u.id}`);
    console.log('');
  });

  // Find mismatches
  console.log('\n=== FIXING MAPPINGS ===\n');

  for (const authUser of authData?.users || []) {
    const internalUser = users?.find(u => u.email === authUser.email);

    if (internalUser && !internalUser.auth_id) {
      console.log(`Linking ${authUser.email}:`);
      console.log(`  internal: ${internalUser.id}`);
      console.log(`  auth_id: ${authUser.id}`);

      const { error } = await supabase
        .from('users')
        .update({ auth_id: authUser.id })
        .eq('id', internalUser.id);

      if (error) {
        console.log(`  ERROR: ${error.message}`);
      } else {
        console.log(`  SUCCESS`);
      }
      console.log('');
    }
  }

  // Check items distribution
  console.log('\n=== ITEMS BY USER ===\n');

  const { data: items } = await supabase
    .from('command_center_items')
    .select('user_id')
    .in('status', ['pending', 'in_progress']);

  const itemCounts: Record<string, number> = {};
  items?.forEach(i => {
    itemCounts[i.user_id] = (itemCounts[i.user_id] || 0) + 1;
  });

  for (const [userId, count] of Object.entries(itemCounts)) {
    const user = users?.find(u => u.id === userId);
    console.log(`${user?.email || userId}: ${count} items`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
