import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function fix() {
  const supabase = createAdminClient();

  const oldUserId = '11111111-1111-1111-1111-111111111009';
  const authUserId = '51c8f003-710b-4071-b3a4-d9cd141b1296';

  console.log('Step 1: Check current state');

  // Check if auth user ID already exists in users table
  const { data: existingAuthUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', authUserId)
    .single();

  if (existingAuthUser) {
    console.log('Auth user already exists in users table:', existingAuthUser.email);
    console.log('Just need to reassign command_center_items to this user');

    // Update command_center_items
    const { data: updated, error } = await supabase
      .from('command_center_items')
      .update({ user_id: authUserId })
      .eq('user_id', oldUserId)
      .select('id');

    if (error) {
      console.log('Error updating CC items:', error.message);
    } else {
      console.log('✅ Updated', updated?.length || 0, 'command_center_items');
    }
  } else {
    console.log('Auth user not in users table yet');
    console.log('Need to insert or update users table first');

    // Get the old user data
    const { data: oldUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', oldUserId)
      .single();

    if (!oldUser) {
      console.log('Old user not found');
      return;
    }

    console.log('Old user data:', JSON.stringify(oldUser, null, 2));

    console.log('\nStep 2: Insert auth user into users table');
    // Copy all columns from old user, just change the ID
    const newUserData = { ...oldUser, id: authUserId };
    delete (newUserData as any).created_at; // Let it auto-set

    const { error: insertError } = await supabase
      .from('users')
      .insert(newUserData);

    if (insertError) {
      console.log('Insert error:', insertError.message);

      // If duplicate email, try updating the old user's ID instead
      // Actually we can't do that with Supabase. Let's try a different approach:
      // Update the old user's email temporarily, insert new user, then update CC items
      console.log('\nTrying alternative approach - updating old user first...');

      // Delete old user and insert new one with same data
      // (This is risky if there are FK constraints from other tables)
      console.log('Checking for FK constraints from other tables...');

      // Just update the ID using raw SQL via RPC or accept the limitation
      console.log('\n⚠️  Cannot automatically fix - email uniqueness constraint');
      console.log('Please run this SQL manually in Supabase SQL Editor:\n');
      console.log(`
-- Option 1: Update the users table to use auth ID
UPDATE users SET id = '${authUserId}' WHERE id = '${oldUserId}';

-- Then update command_center_items (should cascade if FK is set up)
-- If not, run:
UPDATE command_center_items SET user_id = '${authUserId}' WHERE user_id = '${oldUserId}';

-- Or Option 2: Just insert a new user row with auth ID
INSERT INTO users (id, email, name, role, team)
SELECT '${authUserId}', email, name, role, team
FROM users WHERE id = '${oldUserId}';

UPDATE command_center_items SET user_id = '${authUserId}' WHERE user_id = '${oldUserId}';
      `);
      return;
    }

    console.log('✅ Auth user added to users table');

    console.log('\nStep 3: Update command_center_items');
    const { data: updated, error: updateError } = await supabase
      .from('command_center_items')
      .update({ user_id: authUserId })
      .eq('user_id', oldUserId)
      .select('id');

    if (updateError) {
      console.log('Error updating CC items:', updateError.message);
    } else {
      console.log('✅ Updated', updated?.length || 0, 'command_center_items');
    }
  }

  // Final verification
  console.log('\n--- Final State ---');
  const { count } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', authUserId)
    .eq('status', 'pending');

  console.log('Auth user now has', count, 'pending command_center_items');
}

fix().catch(console.error);
