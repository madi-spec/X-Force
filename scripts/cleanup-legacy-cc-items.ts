/**
 * Cleanup Legacy Command Center Items
 *
 * Marks old ai_recommendation items with generic "Review" titles as completed.
 * These items were created in bulk before the tier classification system was improved.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== CLEANUP LEGACY COMMAND CENTER ITEMS ===\n');

  // Find legacy ai_recommendation items
  const { data: items, count } = await supabase
    .from('command_center_items')
    .select('id, title, why_now', { count: 'exact' })
    .eq('source', 'ai_recommendation')
    .eq('status', 'pending')
    .or('title.ilike.Review sent email%,title.ilike.Review received email%,title.ilike.Review calendar event%');

  console.log(`Found ${count || 0} legacy "Review" items to clean up\n`);

  if (!items || items.length === 0) {
    console.log('No items to clean up.');
    return;
  }

  // Show sample of what we're cleaning up
  console.log('Sample items to be marked complete:');
  for (const item of items.slice(0, 5)) {
    console.log(`  - ${item.title?.substring(0, 60)}...`);
    console.log(`    Why Now: ${item.why_now || 'null'}`);
  }
  console.log(`  ... and ${items.length - 5} more\n`);

  // Confirm before proceeding (check for --confirm flag)
  const shouldProceed = process.argv.includes('--confirm');

  if (!shouldProceed) {
    console.log('To proceed with cleanup, run with --confirm flag:');
    console.log('  npx tsx scripts/cleanup-legacy-cc-items.ts --confirm\n');
    return;
  }

  console.log('Proceeding with cleanup...\n');

  // Mark them as completed
  const { error } = await supabase
    .from('command_center_items')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('source', 'ai_recommendation')
    .eq('status', 'pending')
    .or('title.ilike.Review sent email%,title.ilike.Review received email%,title.ilike.Review calendar event%');

  if (error) {
    console.error('Error during cleanup:', error.message);
    return;
  }

  console.log(`✓ Successfully marked ${items.length} legacy items as completed`);

  // Check remaining items
  const { count: remaining } = await supabase
    .from('command_center_items')
    .select('id', { count: 'exact' })
    .eq('status', 'pending');

  console.log(`\nRemaining pending items: ${remaining || 0}`);
}

main().catch(console.error);
