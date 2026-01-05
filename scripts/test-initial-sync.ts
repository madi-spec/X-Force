/**
 * Test Initial Historical Sync
 *
 * Tests the comprehensive sync flow with a real user.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== TEST INITIAL HISTORICAL SYNC ===\n');

  // Find a test user - first try Microsoft integration, then just first user
  let userId: string | null = null;

  const { data: msIntegration } = await supabase
    .from('microsoft_integrations')
    .select('user_id')
    .limit(1)
    .single();

  if (msIntegration) {
    userId = msIntegration.user_id;
    console.log('Found user with Microsoft integration');
  } else {
    // Fall back to first user
    const { data: firstUser } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .single();

    if (firstUser) {
      userId = firstUser.id;
      console.log('Using first available user (no MS integration - testing partial flow)');
    }
  }

  if (!userId) {
    console.log('No users found.');
    return;
  }
  console.log('Testing with user:', userId);

  // Check current sync status
  const { data: user } = await supabase
    .from('users')
    .select('id, initial_sync_complete, initial_sync_started_at, initial_sync_completed_at')
    .eq('id', userId)
    .single();

  console.log('\nCurrent sync status:');
  console.log('  initial_sync_complete:', user?.initial_sync_complete);
  console.log('  initial_sync_started_at:', user?.initial_sync_started_at);
  console.log('  initial_sync_completed_at:', user?.initial_sync_completed_at);

  // Reset sync status for testing
  console.log('\nResetting sync status for testing...');
  await supabase
    .from('users')
    .update({
      initial_sync_complete: false,
      initial_sync_started_at: null,
      initial_sync_completed_at: null,
    })
    .eq('id', userId);

  // Clear sync progress
  await supabase
    .from('sync_progress')
    .delete()
    .eq('user_id', userId);

  console.log('\n--- Starting Initial Sync ---\n');

  // Import the sync function
  const { runInitialHistoricalSync } = await import('../src/lib/sync/initialHistoricalSync');

  // Run the sync with progress logging
  const result = await runInitialHistoricalSync(userId, (message, phase, current, total) => {
    if (phase && current !== undefined && total !== undefined) {
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      console.log(`[${phase}] ${message} (${percent}%)`);
    } else if (phase) {
      console.log(`[${phase}] ${message}`);
    } else {
      console.log(message);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('SYNC RESULT');
  console.log('='.repeat(60));

  console.log('\nSuccess:', result.success);
  if (result.error) {
    console.log('Error:', result.error);
  }

  console.log('\n--- Phase Results ---');

  console.log('\nEmails:');
  console.log('  Imported:', result.phases.emails.imported);
  console.log('  Skipped:', result.phases.emails.skipped);
  console.log('  Errors:', result.phases.emails.errors.length);

  console.log('\nCalendar:');
  console.log('  Imported:', result.phases.calendar.imported);
  console.log('  Skipped:', result.phases.calendar.skipped);
  console.log('  Errors:', result.phases.calendar.errors.length);

  console.log('\nTranscripts:');
  console.log('  Count:', result.phases.transcripts.count);

  console.log('\nProcessing:');
  console.log('  Total:', result.phases.processing.total);
  console.log('  Processed:', result.phases.processing.processed);
  console.log('  RI Updates:', result.phases.processing.riUpdates);
  console.log('  Errors:', result.phases.processing.errors.length);

  console.log('\nCommand Center:');
  console.log('  Items Created:', result.phases.commandCenter.itemsCreated);
  console.log('  Tier 1:', result.phases.commandCenter.tier1);
  console.log('  Tier 2:', result.phases.commandCenter.tier2);
  console.log('  Tier 3:', result.phases.commandCenter.tier3);
  console.log('  Tier 4:', result.phases.commandCenter.tier4);

  console.log('\n--- Timing ---');
  console.log('Started:', result.startedAt);
  console.log('Completed:', result.completedAt);

  // Verify relationship intelligence was updated
  console.log('\n--- Verifying Relationship Intelligence ---');

  const { count: riCount } = await supabase
    .from('relationship_intelligence')
    .select('*', { count: 'exact', head: true })
    .not('interactions', 'is', null);

  console.log('RI records with interactions:', riCount);

  // Verify command center items
  console.log('\n--- Verifying Command Center Items ---');

  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select('id, title, tier, tier_trigger, why_now, source')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('tier', { ascending: true })
    .limit(10);

  console.log(`\nTop ${ccItems?.length || 0} pending items:`);
  for (const item of ccItems || []) {
    console.log(`\n  [Tier ${item.tier}] ${item.tier_trigger}`);
    console.log(`  Title: ${item.title?.substring(0, 60)}`);
    console.log(`  Why Now: ${item.why_now?.substring(0, 60)}`);
    console.log(`  Source: ${item.source}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
