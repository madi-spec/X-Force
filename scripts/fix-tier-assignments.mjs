import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemV3dWNwYmt1em91a29tbmx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY4NDAzMiwiZXhwIjoyMDgxMjYwMDMyfQ.00nDqN7YUdppT03SG1roulgBwq29ToRzQZMd9lnjZsw';

const supabase = createClient(supabaseUrl, supabaseKey);

// Map tier_trigger to correct tier
const TRIGGER_TO_TIER = {
  // Tier 1: RESPOND NOW
  demo_request: 1,
  pricing_request: 1,
  meeting_request: 1,
  direct_question: 1,
  email_reply: 1,
  form_submission: 1,
  calendly_booking: 1,

  // Tier 2: DON'T LOSE THIS
  deadline_critical: 2,
  deadline_approaching: 2,
  competitive_risk: 2,
  proposal_hot: 2,
  champion_dark: 2,
  urgency_keywords: 2,
  buying_signal: 2,
  budget_discussed: 2,
  going_stale: 2,

  // Tier 3: KEEP YOUR WORD
  transcript_commitment: 3,
  meeting_follow_up: 3,
  promise_made: 3,
  action_item: 3,

  // Tier 4: MOVE BIG DEALS
  high_value: 4,
  strategic_account: 4,
  csuite_contact: 4,
  deal_stale: 4,
};

async function fixTierAssignments() {
  console.log('=== Fixing Tier Assignments ===\n');

  // Get all items that have a tier_trigger but tier is 5
  const { data: items, error } = await supabase
    .from('command_center_items')
    .select('id, tier, tier_trigger, title')
    .eq('tier', 5)
    .not('tier_trigger', 'is', null)
    .eq('status', 'pending');

  if (error) {
    console.error('Error fetching items:', error.message);
    return;
  }

  console.log(`Found ${items?.length || 0} items with tier_trigger but tier=5\n`);

  if (!items || items.length === 0) {
    console.log('No items to fix.');
    return;
  }

  let fixed = 0;
  const fixedByTier = { 1: 0, 2: 0, 3: 0, 4: 0 };

  for (const item of items) {
    const correctTier = TRIGGER_TO_TIER[item.tier_trigger];

    if (correctTier && correctTier !== 5) {
      const { error: updateError } = await supabase
        .from('command_center_items')
        .update({ tier: correctTier })
        .eq('id', item.id);

      if (!updateError) {
        fixed++;
        fixedByTier[correctTier]++;
        console.log(`  Fixed: "${item.title?.substring(0, 50)}" -> Tier ${correctTier} (${item.tier_trigger})`);
      } else {
        console.log(`  Error fixing ${item.id}: ${updateError.message}`);
      }
    }
  }

  console.log(`\n=== Fixed ${fixed} items ===`);
  console.log(`  Tier 1: ${fixedByTier[1]}`);
  console.log(`  Tier 2: ${fixedByTier[2]}`);
  console.log(`  Tier 3: ${fixedByTier[3]}`);
  console.log(`  Tier 4: ${fixedByTier[4]}`);

  // Also show final tier distribution
  const { data: tierCounts } = await supabase
    .from('command_center_items')
    .select('tier')
    .eq('status', 'pending');

  const tiers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  (tierCounts || []).forEach(item => { tiers[item.tier || 5]++; });

  console.log('\nFinal Tier Distribution:');
  console.log(`  Tier 1 (RESPOND NOW): ${tiers[1]}`);
  console.log(`  Tier 2 (DON'T LOSE): ${tiers[2]}`);
  console.log(`  Tier 3 (KEEP WORD): ${tiers[3]}`);
  console.log(`  Tier 4 (BIG DEALS): ${tiers[4]}`);
  console.log(`  Tier 5 (PIPELINE): ${tiers[5]}`);
}

fixTierAssignments().catch(console.error);
