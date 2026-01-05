/**
 * Test Tier Generation
 *
 * Runs createCommandCenterActionsFromCurrentState and verifies tier counts.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const userId = '11111111-1111-1111-1111-111111111009';

async function main() {
  console.log('='.repeat(70));
  console.log('TEST TIER GENERATION');
  console.log('='.repeat(70));

  // Step 1: Show current counts before
  console.log('\n--- BEFORE: Current Command Center Items by Tier ---\n');

  const { data: beforeItems } = await supabase
    .from('command_center_items')
    .select('tier, tier_trigger, status')
    .eq('user_id', userId)
    .eq('status', 'pending');

  const beforeCounts = { tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0 };
  for (const item of beforeItems || []) {
    const tier = item.tier as 1 | 2 | 3 | 4 | 5;
    beforeCounts[`tier${tier}`]++;
  }

  console.log('Tier 1 (RESPOND NOW):', beforeCounts.tier1);
  console.log('Tier 2 (DON\'T LOSE THIS):', beforeCounts.tier2);
  console.log('Tier 3 (KEEP YOUR WORD):', beforeCounts.tier3);
  console.log('Tier 4 (MOVE BIG DEALS):', beforeCounts.tier4);
  console.log('Tier 5 (BUILD PIPELINE):', beforeCounts.tier5);

  // Step 2: Clear existing items for fresh generation (only system-generated)
  console.log('\n--- Clearing system-generated pending items for fresh test ---\n');

  const { data: deleted } = await supabase
    .from('command_center_items')
    .delete()
    .eq('user_id', userId)
    .eq('source', 'system')
    .eq('status', 'pending')
    .select('id');

  console.log(`Deleted ${deleted?.length || 0} existing system items`);

  // Step 3: Import and run the function
  console.log('\n--- Running createActionsFromCurrentState ---\n');

  // Dynamic import to get the function
  const { createActionsFromCurrentState } = await import('../src/lib/sync/initialHistoricalSync');

  // We need to pass supabase to the function, but the current implementation
  // uses createAdminClient internally. Let's just call runInitialHistoricalSync
  // with only the command center phase or create a simplified test.

  // Actually, let's just call the full function but only look at the results
  const { runInitialHistoricalSync } = await import('../src/lib/sync/initialHistoricalSync');

  // Run with simplified progress tracking
  const result = await runInitialHistoricalSync(userId, (msg, phase) => {
    if (phase === 'commandCenter') {
      console.log(`  ${msg}`);
    }
  });

  // Step 4: Show results
  console.log('\n--- AFTER: Command Center Items Created ---\n');

  const cc = result.phases.commandCenter;
  console.log('Items created:', cc.itemsCreated);
  console.log('Tier 1 (RESPOND NOW):', cc.tier1);
  console.log('Tier 2 (DON\'T LOSE THIS):', cc.tier2);
  console.log('Tier 3 (KEEP YOUR WORD):', cc.tier3);
  console.log('Tier 4 (MOVE BIG DEALS):', cc.tier4);
  console.log('Tier 5 (BUILD PIPELINE):', cc.tier5);

  // Step 5: Show sample items from each tier
  console.log('\n--- Sample Tier 4 Items ---\n');

  const { data: tier4Items } = await supabase
    .from('command_center_items')
    .select('title, tier_trigger, why_now, company_name')
    .eq('user_id', userId)
    .eq('tier', 4)
    .eq('status', 'pending')
    .limit(5);

  if (tier4Items?.length) {
    tier4Items.forEach((item, i) => {
      console.log(`${i + 1}. ${item.title}`);
      console.log(`   Trigger: ${item.tier_trigger}`);
      console.log(`   Why now: ${item.why_now}`);
      console.log(`   Company: ${item.company_name || 'N/A'}`);
      console.log();
    });
  } else {
    console.log('No Tier 4 items found');
  }

  console.log('\n--- Sample Tier 5 Items ---\n');

  const { data: tier5Items } = await supabase
    .from('command_center_items')
    .select('title, tier_trigger, why_now, company_name, target_name')
    .eq('user_id', userId)
    .eq('tier', 5)
    .eq('status', 'pending')
    .limit(5);

  if (tier5Items?.length) {
    tier5Items.forEach((item, i) => {
      console.log(`${i + 1}. ${item.title}`);
      console.log(`   Trigger: ${item.tier_trigger}`);
      console.log(`   Why now: ${item.why_now}`);
      console.log(`   Target: ${item.target_name || item.company_name || 'N/A'}`);
      console.log();
    });
  } else {
    console.log('No Tier 5 items found');
  }

  // Step 6: Final summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const { data: finalItems } = await supabase
    .from('command_center_items')
    .select('tier, tier_trigger')
    .eq('user_id', userId)
    .eq('status', 'pending');

  const finalCounts = { tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0 };
  const triggerCounts: Record<string, number> = {};

  for (const item of finalItems || []) {
    const tier = item.tier as 1 | 2 | 3 | 4 | 5;
    finalCounts[`tier${tier}`]++;
    const trigger = item.tier_trigger || 'unknown';
    triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
  }

  console.log('\nFinal Tier Counts:');
  console.log('  Tier 1 (RESPOND NOW):', finalCounts.tier1);
  console.log('  Tier 2 (DON\'T LOSE THIS):', finalCounts.tier2);
  console.log('  Tier 3 (KEEP YOUR WORD):', finalCounts.tier3);
  console.log('  Tier 4 (MOVE BIG DEALS):', finalCounts.tier4);
  console.log('  Tier 5 (BUILD PIPELINE):', finalCounts.tier5);

  console.log('\nTrigger Breakdown:');
  Object.entries(triggerCounts).sort((a, b) => b[1] - a[1]).forEach(([trigger, count]) => {
    console.log(`  ${trigger}: ${count}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('DONE');
  console.log('='.repeat(70));
}

main().catch(console.error);
