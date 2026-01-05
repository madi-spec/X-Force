/**
 * Fix orphaned command_center_items
 *
 * These items have user_id set to xraisales' auth_id instead of their actual user_id.
 * This script updates them to the correct user_id.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixOrphanedCCItems() {
  const WRONG_USER_ID = '51c8f003-710b-4071-b3a4-d9cd141b1296'; // xraisales' auth_id (wrong)
  const CORRECT_USER_ID = '11111111-1111-1111-1111-111111111009'; // xraisales' actual user_id

  console.log('Checking for orphaned command_center_items...');

  // Count items to fix
  const { count, error: countError } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', WRONG_USER_ID);

  if (countError) {
    console.error('Error counting items:', countError);
    return;
  }

  console.log(`Found ${count} items with wrong user_id`);

  if (!count || count === 0) {
    console.log('No items to fix');
    return;
  }

  // Update items
  console.log(`Updating ${count} items from ${WRONG_USER_ID} to ${CORRECT_USER_ID}...`);

  const { data, error } = await supabase
    .from('command_center_items')
    .update({ user_id: CORRECT_USER_ID })
    .eq('user_id', WRONG_USER_ID)
    .select('id');

  if (error) {
    console.error('Error updating items:', error);
    return;
  }

  console.log(`Successfully updated ${data?.length || 0} items`);

  // Verify
  const { count: remainingCount } = await supabase
    .from('command_center_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', WRONG_USER_ID);

  console.log(`Remaining items with wrong user_id: ${remainingCount || 0}`);
}

fixOrphanedCCItems()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  });
