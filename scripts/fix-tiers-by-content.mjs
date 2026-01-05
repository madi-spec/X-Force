import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemV3dWNwYmt1em91a29tbmx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY4NDAzMiwiZXhwIjoyMDgxMjYwMDMyfQ.00nDqN7YUdppT03SG1roulgBwq29ToRzQZMd9lnjZsw';

const supabase = createClient(supabaseUrl, supabaseKey);

// Tier 1 keywords (respond immediately)
const TIER1_PATTERNS = [
  { regex: /^demo request:/i, trigger: 'demo_request', sla: 15 },
  { regex: /^pricing[:]/i, trigger: 'pricing_request', sla: 120 },
  { regex: /^meeting request:/i, trigger: 'meeting_request', sla: 30 },
  { regex: /^question:/i, trigger: 'direct_question', sla: 240 },
  { regex: /^meeting:/i, trigger: 'meeting_request', sla: 30 },
];

// Tier 2 keywords (don't lose)
const TIER2_PATTERNS = [
  { regex: /^close deal:/i, trigger: 'deadline_critical' },
  { regex: /^close:/i, trigger: 'deadline_critical' },
  { regex: /^re-engage:/i, trigger: 'going_stale' },
  { regex: /^competitive positioning:/i, trigger: 'competitive_risk' },
  { regex: /^buying signal:/i, trigger: 'buying_signal' },
];

// Tier 3 keywords (keep your word)
const TIER3_PATTERNS = [
  { regex: /^promised:/i, trigger: 'promise_made' },
  { regex: /^follow.?up:/i, trigger: 'meeting_follow_up' },
  { regex: /^send /i, trigger: 'action_item' },
  { regex: /^provide /i, trigger: 'action_item' },
  { regex: /^schedule /i, trigger: 'action_item' },
  { regex: /^set up /i, trigger: 'action_item' },
  { regex: /^prepare /i, trigger: 'action_item' },
  { regex: /^research /i, trigger: 'action_item' },
  { regex: /^check /i, trigger: 'action_item' },
  { regex: /^get /i, trigger: 'action_item' },
  { regex: /^have /i, trigger: 'action_item' },
  { regex: /^explore /i, trigger: 'action_item' },
  { regex: /^process /i, trigger: 'action_item' },
  { regex: /^load /i, trigger: 'action_item' },
  { regex: /^type out /i, trigger: 'action_item' },
  { regex: /^reschedule /i, trigger: 'action_item' },
];

function classifyByTitle(title) {
  const t = title || '';

  // Check Tier 1 first
  for (const pattern of TIER1_PATTERNS) {
    if (pattern.regex.test(t)) {
      return { tier: 1, trigger: pattern.trigger, sla: pattern.sla };
    }
  }

  // Check Tier 2
  for (const pattern of TIER2_PATTERNS) {
    if (pattern.regex.test(t)) {
      return { tier: 2, trigger: pattern.trigger };
    }
  }

  // Check Tier 3
  for (const pattern of TIER3_PATTERNS) {
    if (pattern.regex.test(t)) {
      return { tier: 3, trigger: pattern.trigger };
    }
  }

  return null;
}

async function fixTiersByContent() {
  console.log('=== Fixing Tiers By Content Analysis ===\n');

  // Get all pending items
  const { data: items, error } = await supabase
    .from('command_center_items')
    .select('id, title, source, action_type, tier, tier_trigger')
    .eq('status', 'pending');

  if (error) {
    console.error('Error fetching items:', error.message);
    return;
  }

  console.log(`Found ${items?.length || 0} pending items\n`);

  const stats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unchanged: 0 };

  for (const item of items || []) {
    const classification = classifyByTitle(item.title);

    if (classification && classification.tier !== item.tier) {
      const updateData = {
        tier: classification.tier,
        tier_trigger: classification.trigger,
      };

      // Add SLA for Tier 1
      if (classification.sla) {
        updateData.sla_minutes = classification.sla;
        updateData.sla_status = 'on_track';
      }

      const { error: updateError } = await supabase
        .from('command_center_items')
        .update(updateData)
        .eq('id', item.id);

      if (!updateError) {
        stats[classification.tier]++;
        console.log(`  Tier ${classification.tier}: "${item.title?.substring(0, 50)}..."`);
      }
    } else {
      stats.unchanged++;
    }
  }

  console.log('\n=== Results ===');
  console.log(`  Fixed to Tier 1: ${stats[1]}`);
  console.log(`  Fixed to Tier 2: ${stats[2]}`);
  console.log(`  Fixed to Tier 3: ${stats[3]}`);
  console.log(`  Unchanged: ${stats.unchanged}`);

  // Show final distribution
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

fixTiersByContent().catch(console.error);
