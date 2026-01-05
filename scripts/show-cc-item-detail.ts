import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get the first email_ai_analysis item
  const { data: item } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('source', 'email_ai_analysis')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!item) {
    console.log('No email_ai_analysis item found');
    return;
  }

  console.log('='.repeat(70));
  console.log('COMMAND CENTER ITEM DETAIL');
  console.log('='.repeat(70));

  console.log(`\nID: ${item.id}`);
  console.log(`Title: ${item.title}`);
  console.log(`Target: ${item.target_name} @ ${item.company_name}`);
  console.log(`Source: ${item.source}`);

  console.log('\n--- CLASSIFICATION ---');
  console.log(`Tier: ${item.tier}`);
  console.log(`Tier Trigger: ${item.tier_trigger}`);
  console.log(`SLA Minutes: ${item.sla_minutes}`);
  console.log(`Why Now: ${item.why_now}`);

  console.log('\n--- BUYING SIGNALS ---');
  const signals = item.buying_signals as any[];
  if (signals && signals.length > 0) {
    for (const s of signals) {
      console.log(`  [${s.strength}] ${s.signal}`);
      if (s.quote) console.log(`    Quote: "${s.quote}"`);
      if (s.implication) console.log(`    Implication: ${s.implication}`);
    }
  } else {
    console.log('  (none)');
  }

  console.log('\n--- CONCERNS ---');
  const concerns = item.concerns as any[];
  if (concerns && concerns.length > 0) {
    for (const c of concerns) {
      console.log(`  [${c.severity}] ${c.concern}`);
      if (c.suggested_response) console.log(`    Response: ${c.suggested_response}`);
    }
  } else {
    console.log('  (none)');
  }

  console.log('\n--- SUGGESTED ACTIONS ---');
  const actions = item.suggested_actions as any[];
  if (actions && actions.length > 0) {
    for (const a of actions) {
      console.log(`  [${a.priority}] ${a.action}`);
      if (a.reasoning) console.log(`    Reason: ${a.reasoning}`);
    }
  } else {
    console.log('  (none)');
  }

  console.log('\n--- EMAIL DRAFT ---');
  const draft = item.email_draft as any;
  if (draft) {
    console.log(`Subject: ${draft.subject}`);
    console.log(`Confidence: ${draft.confidence}%`);
    console.log(`\nBody:\n${draft.body}`);
  } else {
    console.log('  (no draft)');
  }

  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
