import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("=== COMMAND CENTER ITEMS ===\n");
  const { data: items } = await supabase
    .from('command_center_items')
    .select('id, tier, tier_trigger, why_now, source, target_name, company_name, buying_signals, concerns, email_draft')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`Found ${items?.length || 0} pending items\n`);

  if (items && items.length > 0) {
    for (const item of items) {
      console.log(`ID: ${item.id}`);
      console.log(`  Target: ${item.target_name} @ ${item.company_name}`);
      console.log(`  Source: ${item.source}`);
      console.log(`  Tier: ${item.tier} (${item.tier_trigger})`);
      console.log(`  Why Now: ${item.why_now || 'N/A'}`);
      const signals = item.buying_signals as any[];
      const concerns = item.concerns as any[];
      const draft = item.email_draft as any;
      console.log(`  Buying Signals: ${signals?.length || 0}`);
      console.log(`  Concerns: ${concerns?.length || 0}`);
      console.log(`  Has Draft: ${!!draft?.body}`);
      console.log('');
    }
  }
}

main().catch(console.error);
