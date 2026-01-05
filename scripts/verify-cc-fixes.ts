/**
 * Verify Command Center Fixes
 * Run with: npx tsx scripts/verify-cc-fixes.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('='.repeat(60));
  console.log('COMMAND CENTER FIX VERIFICATION');
  console.log('='.repeat(60));

  // 1. Check tier distribution
  console.log('\n📊 TIER DISTRIBUTION:');
  const { data: tierDist, error: tierError } = await supabase
    .from('command_center_items')
    .select('tier')
    .not('status', 'eq', 'completed');

  if (tierError) {
    console.error('Error:', tierError.message);
  } else {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    tierDist?.forEach(item => {
      counts[item.tier] = (counts[item.tier] || 0) + 1;
    });

    const total = tierDist?.length || 0;
    console.log('\n  Tier | Count | Percent | Description');
    console.log('  -----|-------|---------|-------------');
    console.log(`    1  |  ${String(counts[1]).padStart(4)} | ${((counts[1]/total)*100).toFixed(1).padStart(5)}% | RESPOND NOW`);
    console.log(`    2  |  ${String(counts[2]).padStart(4)} | ${((counts[2]/total)*100).toFixed(1).padStart(5)}% | DON'T LOSE THIS`);
    console.log(`    3  |  ${String(counts[3]).padStart(4)} | ${((counts[3]/total)*100).toFixed(1).padStart(5)}% | KEEP YOUR WORD`);
    console.log(`    4  |  ${String(counts[4]).padStart(4)} | ${((counts[4]/total)*100).toFixed(1).padStart(5)}% | MOVE BIG DEALS`);
    console.log(`    5  |  ${String(counts[5]).padStart(4)} | ${((counts[5]/total)*100).toFixed(1).padStart(5)}% | BUILD PIPELINE`);
    console.log(`  -----|-------|---------|-------------`);
    console.log(`  Total: ${total} pending items`);
  }

  // 2. Check source_id on recent items
  console.log('\n\n📋 RECENT ITEMS (source_id check):');
  const { data: recentItems, error: recentError } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentError) {
    console.error('Error:', recentError.message);
  } else {
    console.log('\n  Has source_id | Source              | Title');
    console.log('  --------------|---------------------|------');
    recentItems?.forEach(item => {
      const hasSourceId = item.source_id ? '✅' : '❌';
      const source = (item.source || 'unknown').padEnd(20);
      const title = (item.title || '').substring(0, 40);
      console.log(`       ${hasSourceId}        | ${source}| ${title}`);
    });
  }

  // 3. Check tier_trigger distribution
  console.log('\n\n🏷️  TIER TRIGGER DISTRIBUTION:');
  const { data: triggers, error: triggerError } = await supabase
    .from('command_center_items')
    .select('tier_trigger, tier')
    .not('status', 'eq', 'completed');

  if (triggerError) {
    console.error('Error:', triggerError.message);
  } else {
    const triggerCounts: Record<string, { count: number; tier: number }> = {};
    triggers?.forEach(item => {
      const trigger = item.tier_trigger || 'null';
      if (!triggerCounts[trigger]) {
        triggerCounts[trigger] = { count: 0, tier: item.tier };
      }
      triggerCounts[trigger].count++;
    });

    // Sort by count descending
    const sorted = Object.entries(triggerCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15);

    console.log('\n  Trigger                    | Tier | Count');
    console.log('  ---------------------------|------|------');
    sorted.forEach(([trigger, data]) => {
      console.log(`  ${trigger.padEnd(27)}|   ${data.tier}  | ${data.count}`);
    });
  }

  // 4. Check deal_stale items specifically
  console.log('\n\n🔍 DEAL_STALE ITEMS CHECK:');
  const { data: dealStale, error: dealStaleError } = await supabase
    .from('command_center_items')
    .select('tier, tier_trigger')
    .in('tier_trigger', ['deal_stale', 'going_stale']);

  if (dealStaleError) {
    console.error('Error:', dealStaleError.message);
  } else {
    const staleByTier: Record<string, Record<number, number>> = {};
    dealStale?.forEach(item => {
      const trigger = item.tier_trigger;
      if (!staleByTier[trigger]) {
        staleByTier[trigger] = { 2: 0, 4: 0, 5: 0 };
      }
      staleByTier[trigger][item.tier] = (staleByTier[trigger][item.tier] || 0) + 1;
    });

    console.log('\n  Trigger      | Tier 2 | Tier 4 | Tier 5 (wrong)');
    console.log('  -------------|--------|--------|---------------');
    Object.entries(staleByTier).forEach(([trigger, tiers]) => {
      const wrongTier5 = tiers[5] > 0 ? `❌ ${tiers[5]}` : '✅ 0';
      console.log(`  ${trigger.padEnd(13)}|   ${tiers[2] || 0}    |   ${tiers[4] || 0}    | ${wrongTier5}`);
    });

    if (Object.values(staleByTier).some(t => t[5] > 0)) {
      console.log('\n  ⚠️  Run the migration to fix Tier 5 deal_stale items:');
      console.log('     supabase/migrations/20251223_fix_deal_stale_tier.sql');
    }
  }

  // 5. Source_id null count
  console.log('\n\n📊 SOURCE_ID STATUS:');
  const { data: sourceIdStatus, error: sourceIdError } = await supabase
    .from('command_center_items')
    .select('source, source_id')
    .not('status', 'eq', 'completed');

  if (sourceIdError) {
    console.error('Error:', sourceIdError.message);
  } else {
    const bySource: Record<string, { total: number; hasSourceId: number }> = {};
    sourceIdStatus?.forEach(item => {
      const source = item.source || 'unknown';
      if (!bySource[source]) {
        bySource[source] = { total: 0, hasSourceId: 0 };
      }
      bySource[source].total++;
      if (item.source_id) bySource[source].hasSourceId++;
    });

    console.log('\n  Source              | Total | Has source_id | Missing');
    console.log('  --------------------|-------|---------------|--------');
    Object.entries(bySource)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([source, data]) => {
        const missing = data.total - data.hasSourceId;
        const status = missing > 0 ? `❌ ${missing}` : '✅ 0';
        console.log(`  ${source.padEnd(20)}|  ${String(data.total).padStart(4)} |     ${String(data.hasSourceId).padStart(4)}      | ${status}`);
      });
  }

  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
