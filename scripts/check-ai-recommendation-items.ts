import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check ai_recommendation items
  const { data: items } = await supabase
    .from('command_center_items')
    .select('id, source, title, why_now, tier, tier_trigger, action_type, target_name, company_name, created_at')
    .eq('source', 'ai_recommendation')
    .order('created_at', { ascending: false });

  console.log('=== AI RECOMMENDATION ITEMS ===\n');
  console.log('Total:', items?.length || 0);

  for (const item of (items || [])) {
    console.log('\n---');
    console.log('ID:', item.id);
    console.log('Title:', item.title);
    console.log('Target:', item.target_name, '@', item.company_name);
    console.log('Why Now:', item.why_now);
    console.log('Tier:', item.tier, '| Trigger:', item.tier_trigger);
    console.log('Action Type:', item.action_type);
    console.log('Created:', item.created_at);
  }

  // Count by status
  const { data: pending } = await supabase
    .from('command_center_items')
    .select('id', { count: 'exact' })
    .eq('source', 'ai_recommendation')
    .eq('status', 'pending');

  const { data: completed } = await supabase
    .from('command_center_items')
    .select('id', { count: 'exact' })
    .eq('source', 'ai_recommendation')
    .neq('status', 'pending');

  console.log('\n=== SUMMARY ===');
  console.log('Pending:', pending?.length || 0);
  console.log('Completed/Dismissed:', completed?.length || 0);
}

main().catch(console.error);
