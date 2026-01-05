import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemV3dWNwYmt1em91a29tbmx2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY4NDAzMiwiZXhwIjoyMDgxMjYwMDMyfQ.00nDqN7YUdppT03SG1roulgBwq29ToRzQZMd9lnjZsw';

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// BASE PRIORITY SCORES
// ============================================

const BASE_PRIORITIES = {
  commitment_made: 35,
  buying_signal: 32,
  executive_engaged: 30,
  meeting_follow_up: 28,
  proposal_follow_up: 28,
  sla_breach: 25,
  competitor_mentioned: 25,
  meeting_prep: 22,
  email_respond: 20,
  call_with_prep: 18,
  call: 18,
  email_send_draft: 15,
  email_compose: 15,
  linkedin_touch: 12,
  research_account: 10,
  task_simple: 10,
  task_complex: 12,
  internal_sync: 8,
};

// ============================================
// TIME PRESSURE (new logic)
// ============================================

function getTimePressure(dueAt) {
  if (!dueAt) {
    return { value: 0, explanation: '' };
  }

  const now = new Date();
  const due = new Date(dueAt);
  const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Overdue
  if (hoursUntilDue < 0) {
    const overdueHours = Math.abs(hoursUntilDue);
    const overdueDays = overdueHours / 24;

    // Very stale (30+ days): Penalize
    if (overdueDays >= 30) {
      const penalty = Math.min(10, Math.round((overdueDays - 30) / 30));
      return {
        value: -penalty,
        explanation: `Stale (${Math.round(overdueDays)}d old) → -${penalty}`,
      };
    }

    // Moderately overdue (7-30 days): Decreasing urgency
    if (overdueDays >= 7) {
      const value = Math.max(5, 15 - Math.round((overdueDays - 7) * 0.5));
      return {
        value,
        explanation: `Overdue ${Math.round(overdueDays)}d → +${value}`,
      };
    }

    // Recently overdue (0-7 days): Genuine urgency
    const value = Math.min(20, 15 + Math.round(overdueDays));
    return {
      value,
      explanation: `Overdue ${Math.round(overdueDays)}d → +${value}`,
    };
  }

  // Due very soon (next 2 hours)
  if (hoursUntilDue <= 2) {
    return { value: 20, explanation: `Due in ${Math.round(hoursUntilDue * 60)} min → +20` };
  }

  // Due within work day (2-8 hours)
  if (hoursUntilDue <= 8) {
    const value = Math.round(18 - (hoursUntilDue - 2) * 2);
    return { value, explanation: `Due in ${Math.round(hoursUntilDue)}h → +${value}` };
  }

  // Due today (8-24 hours)
  if (hoursUntilDue <= 24) {
    const value = Math.max(2, Math.round(10 - (hoursUntilDue - 8) * 0.5));
    return { value, explanation: `Due today → +${value}` };
  }

  // Due this week
  if (hoursUntilDue <= 168) {
    const daysUntil = Math.ceil(hoursUntilDue / 24);
    const value = Math.max(0, 5 - daysUntil);
    if (value > 0) {
      return { value, explanation: `Due in ${daysUntil}d → +${value}` };
    }
  }

  return { value: 0, explanation: '' };
}

// ============================================
// VALUE SCORE
// ============================================

function getValueScore(dealValue, probability, avgDealSize = 30000) {
  if (!dealValue || dealValue <= 0) {
    return { value: 0, explanation: '' };
  }

  const prob = probability ?? 0.5;
  const weightedValue = dealValue * prob;
  const ratio = weightedValue / avgDealSize;
  const value = Math.min(20, Math.round(ratio * 10));

  const formatted = formatCurrency(weightedValue);
  return { value, explanation: `${formatted} weighted → +${value}` };
}

// ============================================
// CALCULATE FULL SCORE
// ============================================

function calculateMomentumScore(item) {
  const base = BASE_PRIORITIES[item.action_type] || 10;
  const time = getTimePressure(item.due_at);
  const value = getValueScore(item.deal_value, item.deal_probability);

  // Engagement and risk would need more data - use 0 for now
  const engagement = { value: 0, explanation: 'No recent signals', signals: [] };
  const risk = { value: 0, explanation: '', signals: [] };

  const rawScore = base + time.value + value.value + engagement.value + risk.value;
  const score = Math.max(0, Math.min(100, rawScore));

  const explanation = [];
  explanation.push(`${formatActionType(item.action_type)} → +${base}`);
  if (time.value !== 0) explanation.push(time.explanation);
  if (value.value > 0) explanation.push(value.explanation);

  return {
    score,
    factors: {
      base: { value: base, explanation: `${formatActionType(item.action_type)} → +${base}` },
      time: { value: time.value, explanation: time.explanation },
      value: { value: value.value, explanation: value.explanation },
      engagement,
      risk,
    },
    explanation,
  };
}

function formatActionType(actionType) {
  return actionType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${Math.round(value)}`;
}

// ============================================
// MAIN
// ============================================

async function recalculateScores() {
  console.log('Recalculating momentum scores with updated logic...\n');

  const { data: items, error } = await supabase
    .from('command_center_items')
    .select('id, title, action_type, due_at, deal_value, deal_probability, momentum_score')
    .eq('status', 'pending');

  if (error) {
    console.error('Error fetching items:', error.message);
    return;
  }

  console.log(`Found ${items.length} pending items\n`);

  let updated = 0;
  let failed = 0;
  const changes = [];

  for (const item of items) {
    const result = calculateMomentumScore(item);
    const oldScore = item.momentum_score;
    const newScore = result.score;

    if (oldScore !== newScore) {
      changes.push({
        title: item.title.substring(0, 40),
        old: oldScore,
        new: newScore,
        diff: newScore - oldScore,
      });
    }

    const { error: updateError } = await supabase
      .from('command_center_items')
      .update({
        momentum_score: result.score,
        score_factors: result.factors,
        score_explanation: result.explanation,
        base_priority: result.factors.base.value,
        time_pressure: result.factors.time.value,
        value_score: result.factors.value.value,
        engagement_score: result.factors.engagement.value,
      })
      .eq('id', item.id);

    if (updateError) {
      console.log(`   ❌ Failed to update ${item.id}: ${updateError.message}`);
      failed++;
    } else {
      updated++;
    }
  }

  console.log(`✅ Updated ${updated} items`);
  if (failed > 0) console.log(`❌ Failed ${failed} items`);

  // Show biggest changes
  if (changes.length > 0) {
    console.log(`\n--- Score changes (${changes.length} items) ---\n`);
    changes
      .sort((a, b) => a.diff - b.diff) // Most negative first
      .slice(0, 10)
      .forEach((c) => {
        const sign = c.diff >= 0 ? '+' : '';
        console.log(`${c.title}...`);
        console.log(`   ${c.old} → ${c.new} (${sign}${c.diff})\n`);
      });
  }

  // Show new top 10
  console.log('\n--- New Top 10 by momentum score ---\n');
  const { data: top10 } = await supabase
    .from('command_center_items')
    .select('title, action_type, momentum_score, deal_value, due_at')
    .eq('status', 'pending')
    .order('momentum_score', { ascending: false })
    .limit(10);

  top10?.forEach((item, i) => {
    const value = item.deal_value ? ` | ${formatCurrency(item.deal_value)}` : '';
    const due = item.due_at ? formatDue(item.due_at) : '';
    console.log(`${i + 1}. [${item.momentum_score}] ${item.title.substring(0, 40)}...`);
    console.log(`   ${item.action_type}${value}${due}\n`);
  });
}

function formatDue(dueAt) {
  const due = new Date(dueAt);
  const now = new Date();
  const days = Math.round((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  if (days > 0) return ` | ${days}d overdue`;
  if (days < 0) return ` | due in ${Math.abs(days)}d`;
  return ' | due today';
}

recalculateScores().catch(console.error);
