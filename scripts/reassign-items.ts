/**
 * Reassign command center items to the correct user
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  // Find the user with auth_id (xraisales)
  const { data: targetUser } = await supabase
    .from('users')
    .select('id, email')
    .not('auth_id', 'is', null)
    .single();

  if (!targetUser) {
    console.log('No user with auth_id found!');
    return;
  }

  console.log(`Target user: ${targetUser.email} (${targetUser.id})`);

  // Count items to reassign
  const { count } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .neq('user_id', targetUser.id)
    .in('status', ['pending', 'in_progress']);

  console.log(`Items to reassign: ${count}`);

  // Reassign all items
  const { error } = await supabase
    .from('command_center_items')
    .update({ user_id: targetUser.id })
    .in('status', ['pending', 'in_progress']);

  if (error) {
    console.error('Error reassigning items:', error);
    return;
  }

  console.log(`Reassigned all items to ${targetUser.email}`);

  // Verify
  const { count: finalCount } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', targetUser.id)
    .in('status', ['pending', 'in_progress']);

  console.log(`Final count for ${targetUser.email}: ${finalCount} items`);
}

main().catch(console.error);
