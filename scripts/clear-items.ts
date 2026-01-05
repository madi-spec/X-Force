import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  // Count before
  const { count: before } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'in_progress']);

  console.log(`Before: ${before} items`);

  // Delete all pending/in_progress items
  const { error } = await supabase
    .from('command_center_items')
    .delete()
    .in('status', ['pending', 'in_progress']);

  if (error) {
    console.log('Error:', error);
    return;
  }

  // Count after
  const { count: after } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'in_progress']);

  console.log(`After: ${after} items`);
  console.log(`Deleted: ${(before || 0) - (after || 0)} items`);
}

main().catch(console.error);
