import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemV3dWNwYmt1em91a29tbmx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY4NDAzMiwiZXhwIjoyMDgxMjYwMDMyfQ.00nDqN7YUdppT03SG1roulgBwq29ToRzQZMd9lnjZsw';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generate compelling "Why Now" text based on what makes this item important
 * Priority: Value opportunity > Engagement signals > Risk signals > Strategic action > Fallback
 *
 * KEY INSIGHT: "Overdue" is never a good reason. Focus on business value.
 */
function generateWhyNow(item) {
  const {
    action_type,
    due_at,
    deal_value,
    deal_probability,
    deal_stage,
    score_factors,
    company_name,
    target_name,
    title,
  } = item;

  // Check if this is a very stale item (overdue > 30 days)
  const isStale = due_at && isOverdueDays(due_at) > 30;

  // 1. HIGH VALUE OPPORTUNITY - Most compelling
  if (deal_value && deal_value >= 50000) {
    const weighted = deal_value * (deal_probability || 0.5);
    const formattedValue = formatCurrency(weighted);
    const formattedTotal = formatCurrency(deal_value);

    if (deal_stage === 'negotiation') {
      return `${formattedTotal} deal in negotiation - this is close, keep momentum`;
    }
    if (deal_stage === 'trial') {
      return `${formattedTotal} deal in trial - ensure they see value before it expires`;
    }
    if (deal_stage === 'demo') {
      return `${formattedTotal} opportunity - demo is your chance to prove value`;
    }
    return `${formattedValue} weighted pipeline at stake`;
  }

  // 2. ENGAGEMENT SIGNALS - Buyer is active
  const engagementFactors = score_factors?.engagement;
  if (engagementFactors?.signals?.length > 0) {
    const signals = engagementFactors.signals;

    if (signals.includes('proposal_viewed')) {
      return 'Prospect reviewing your proposal - strike while engaged';
    }
    if (signals.includes('forwarded_internally')) {
      return 'Email forwarded internally - you\'re being discussed';
    }
    if (signals.includes('email_opened')) {
      return 'Multiple email opens - they\'re interested';
    }
    if (signals.includes('link_clicked')) {
      return 'Link clicked - curiosity is high';
    }
    if (signals.includes('meeting_accepted')) {
      return 'Meeting accepted - momentum building';
    }
  }

  // 3. RISK SIGNALS - Deal in jeopardy
  const riskFactors = score_factors?.risk;
  if (riskFactors?.signals?.length > 0) {
    const signals = riskFactors.signals;

    if (signals.includes('champion_going_dark')) {
      return 'Champion quiet - re-engage before losing the deal';
    }
    if (signals.includes('competitor_mentioned')) {
      return 'Competitor in the mix - differentiate now';
    }
    if (signals.includes('ghosting_risk')) {
      return 'Ghosting pattern - break through now';
    }
    if (signals.includes('health_score_drop')) {
      return 'Deal health dropping - intervention needed';
    }
    if (signals.includes('stale_deal')) {
      return 'Deal going cold - re-engage now';
    }
    if (signals.includes('stuck_stage')) {
      return 'Stuck in stage - identify the blocker';
    }
  }

  // 4. STALE ITEMS - Be honest, suggest cleanup
  if (isStale) {
    return 'Review: still relevant or ready to close out?';
  }

  // 5. MEDIUM VALUE OPPORTUNITY
  if (deal_value && deal_value >= 15000) {
    const formattedTotal = formatCurrency(deal_value);
    if (deal_stage === 'negotiation') {
      return `${formattedTotal} in negotiation - close it`;
    }
    if (deal_stage === 'trial') {
      return `${formattedTotal} in trial - ensure success`;
    }
    return `${formattedTotal} opportunity - keep it moving`;
  }

  // 6. STAGE-BASED CONTEXT (higher priority stages)
  if (deal_stage) {
    const stageMessages = {
      negotiation: 'Deal in negotiation - stay close to close',
      trial: 'Trial active - ensure they see value',
      demo: 'Demo stage - make it count',
    };
    if (stageMessages[deal_stage]) {
      return stageMessages[deal_stage];
    }
  }

  // 7. STRATEGIC ACTION TYPE (for high-value action types only)
  const strategicActions = {
    commitment_made: 'You committed - deliver to build trust',
    buying_signal: 'Buying signal - they\'re ready to move',
    executive_engaged: 'Executive engaged - don\'t make them wait',
    meeting_follow_up: 'Follow up while meeting is fresh',
    proposal_follow_up: 'Check in on the proposal',
  };
  if (strategicActions[action_type]) {
    return strategicActions[action_type];
  }

  // 8. COMPANY CONTEXT - If we at least have a company
  if (company_name) {
    // Check if title contains useful context
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('demo')) {
      return `Demo for ${company_name} - make it compelling`;
    }
    if (lowerTitle.includes('proposal')) {
      return `Proposal for ${company_name} - move it forward`;
    }
    if (lowerTitle.includes('trial')) {
      return `Trial for ${company_name} - ensure success`;
    }
    if (lowerTitle.includes('follow')) {
      return `Follow up with ${company_name}`;
    }
    return `Engage ${company_name}`;
  }

  // 9. TARGET CONTEXT
  if (target_name) {
    return `Engage ${target_name}`;
  }

  // 10. TITLE-BASED INFERENCE (fallback)
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('call') || lowerTitle.includes('phone')) {
    return 'Voice builds trust faster than email';
  }
  if (lowerTitle.includes('demo')) {
    return 'Demo is your chance to prove value';
  }
  if (lowerTitle.includes('proposal') || lowerTitle.includes('pricing')) {
    return 'Proposals move deals forward';
  }
  if (lowerTitle.includes('trial') || lowerTitle.includes('pilot')) {
    return 'Trials convert when you stay close';
  }
  if (lowerTitle.includes('follow up') || lowerTitle.includes('follow-up')) {
    return 'Timely follow-ups improve close rates';
  }
  if (lowerTitle.includes('schedule') || lowerTitle.includes('meeting')) {
    return 'Meetings accelerate relationships';
  }
  if (lowerTitle.includes('research') || lowerTitle.includes('prep')) {
    return 'Preparation drives better outcomes';
  }
  if (lowerTitle.includes('onboard')) {
    return 'Smooth onboarding ensures renewal';
  }
  if (lowerTitle.includes('review')) {
    return 'Review to ensure quality';
  }
  if (lowerTitle.includes('send') || lowerTitle.includes('email')) {
    return 'Outreach keeps you top of mind';
  }
  if (lowerTitle.includes('set up') || lowerTitle.includes('setup') || lowerTitle.includes('configure')) {
    return 'Setup enables the next step';
  }

  // 11. GENERIC FALLBACK
  return 'Move this forward today';
}

function formatCurrency(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${Math.round(value)}`;
}

function isOverdueDays(dueAt) {
  const due = new Date(dueAt);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

async function populateWhyNow() {
  console.log('Generating compelling "Why Now" text for pending items...\n');

  // Get all pending items with their scoring data
  const { data: items, error } = await supabase
    .from('command_center_items')
    .select(`
      id,
      title,
      action_type,
      due_at,
      deal_value,
      deal_probability,
      deal_stage,
      score_factors,
      company_name,
      target_name,
      momentum_score
    `)
    .eq('status', 'pending')
    .order('momentum_score', { ascending: false });

  if (error) {
    console.error('Error fetching items:', error.message);
    return;
  }

  console.log(`Found ${items.length} pending items\n`);

  // Count stale items
  const staleItems = items.filter(i => i.due_at && isOverdueDays(i.due_at) > 30);
  if (staleItems.length > 0) {
    console.log(`⚠️  ${staleItems.length} items are >30 days overdue (consider cleanup)\n`);
  }

  let updated = 0;
  let failed = 0;

  for (const item of items) {
    const why_now = generateWhyNow(item);

    const { error: updateError } = await supabase
      .from('command_center_items')
      .update({ why_now })
      .eq('id', item.id);

    if (updateError) {
      console.log(`   ❌ Failed to update ${item.id}: ${updateError.message}`);
      failed++;
    } else {
      updated++;
    }
  }

  console.log(`✅ Updated ${updated} items with compelling why_now`);
  if (failed > 0) {
    console.log(`❌ Failed to update ${failed} items`);
  }

  // Show sample of updated items (top 10 by momentum)
  console.log('\n--- Top 10 items by momentum score ---\n');
  const { data: samples } = await supabase
    .from('command_center_items')
    .select('title, action_type, momentum_score, deal_value, due_at, why_now')
    .eq('status', 'pending')
    .order('momentum_score', { ascending: false })
    .limit(10);

  samples?.forEach((item, i) => {
    const value = item.deal_value ? ` | ${formatCurrency(item.deal_value)}` : '';
    const overdue = item.due_at ? ` | ${isOverdueDays(item.due_at)}d overdue` : '';
    console.log(`${i + 1}. [${item.momentum_score}] ${item.title.substring(0, 40)}...`);
    console.log(`   ${item.action_type}${value}${overdue}`);
    console.log(`   → ${item.why_now}\n`);
  });
}

populateWhyNow().catch(console.error);
