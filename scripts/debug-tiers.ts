/**
 * Debug tier classification
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();

  console.log('=== INVESTIGATING TIER CLASSIFICATION ===\n');

  // 1. Check current tier distribution
  console.log('--- Current Tier Distribution ---\n');

  const { data: items } = await supabase
    .from('command_center_items')
    .select('tier')
    .in('status', ['pending', 'in_progress']);

  const tierCounts: Record<number, number> = {};
  items?.forEach(i => {
    tierCounts[i.tier] = (tierCounts[i.tier] || 0) + 1;
  });

  Object.entries(tierCounts).sort(([a], [b]) => Number(a) - Number(b)).forEach(([tier, count]) => {
    const tierNames: Record<string, string> = {
      '1': 'RESPOND NOW',
      '2': "DON'T LOSE THIS",
      '3': 'KEEP YOUR WORD',
      '4': 'MOVE BIG DEALS',
      '5': 'BUILD PIPELINE',
    };
    console.log(`  Tier ${tier} (${tierNames[tier]}): ${count}`);
  });

  // 2. Check what email analyses actually contain for tier info
  console.log('\n--- Email Analysis Tier Info ---\n');

  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, subject, ai_analysis')
    .eq('analysis_complete', true)
    .not('ai_analysis', 'is', null)
    .limit(10);

  emails?.forEach((email, i) => {
    const analysis = email.ai_analysis as any;
    console.log(`${i + 1}. ${email.subject.substring(0, 50)}`);
    console.log(`   communication_type: ${analysis?.communication_type || 'N/A'}`);
    console.log(`   command_center_classification:`);
    if (analysis?.command_center_classification) {
      console.log(`     tier: ${analysis.command_center_classification.tier}`);
      console.log(`     tier_trigger: ${analysis.command_center_classification.tier_trigger}`);
      console.log(`     tier_reasoning: ${analysis.command_center_classification.tier_reasoning?.substring(0, 80)}...`);
    } else {
      console.log(`     NOT PRESENT - old format analysis`);
    }
    console.log('');
  });

  // 3. Check the tier_trigger field on items
  console.log('\n--- Item Tier Triggers ---\n');

  const { data: itemDetails } = await supabase
    .from('command_center_items')
    .select('title, tier, tier_trigger')
    .in('status', ['pending', 'in_progress'])
    .limit(15);

  itemDetails?.forEach(item => {
    console.log(`[T${item.tier}] ${item.title.substring(0, 40)}`);
    console.log(`   tier_trigger: ${item.tier_trigger}`);
  });
}

main().catch(console.error);
