import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('='.repeat(70));
  console.log('COMMAND CENTER ITEM AUDIT');
  console.log('='.repeat(70));

  // Get sample items from different tiers
  const { data: items } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('status', 'pending')
    .order('tier', { ascending: true })
    .limit(5);

  console.log('\n--- Sample Items (one per tier if available) ---\n');

  const seenTiers = new Set<number>();
  for (const item of items || []) {
    if (seenTiers.has(item.tier)) continue;
    seenTiers.add(item.tier);

    console.log(`\n=== TIER ${item.tier} ITEM ===`);
    console.log('Title:', item.title);
    console.log('Tier Trigger:', item.tier_trigger);
    console.log('Action Type:', item.action_type);
    console.log('---');
    console.log('Source:', item.source);
    console.log('Source ID:', item.source_id);
    console.log('Created At:', item.created_at);
    console.log('Received At:', item.received_at);
    console.log('---');
    console.log('Company ID:', item.company_id);
    console.log('Company Name:', item.company_name);
    console.log('Contact ID:', item.contact_id);
    console.log('Target Name:', item.target_name);
    console.log('Deal ID:', item.deal_id);
    console.log('Conversation ID:', item.conversation_id);
    console.log('Meeting ID:', item.meeting_id);
    console.log('---');
    console.log('Why Now:', item.why_now);
    console.log('Description:', item.description?.substring(0, 100));
    console.log('---');
    console.log('All keys:', Object.keys(item).filter(k => item[k] !== null && item[k] !== undefined).join(', '));
  }

  // Check what sources exist
  console.log('\n\n--- SOURCE DISTRIBUTION ---\n');
  const { data: sources } = await supabase
    .from('command_center_items')
    .select('source, tier')
    .eq('status', 'pending');

  const sourceCount: Record<string, number> = {};
  for (const s of sources || []) {
    sourceCount[s.source] = (sourceCount[s.source] || 0) + 1;
  }
  console.log('Source counts:', sourceCount);

  // Check what tier_triggers exist
  console.log('\n--- TIER TRIGGER DISTRIBUTION ---\n');
  const { data: triggers } = await supabase
    .from('command_center_items')
    .select('tier_trigger, tier')
    .eq('status', 'pending');

  const triggerCount: Record<string, number> = {};
  for (const t of triggers || []) {
    const key = `T${t.tier}:${t.tier_trigger}`;
    triggerCount[key] = (triggerCount[key] || 0) + 1;
  }
  Object.entries(triggerCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  // Check what contact/company linking looks like
  console.log('\n--- LINKING STATS ---\n');
  const { data: linking } = await supabase
    .from('command_center_items')
    .select('company_id, contact_id, deal_id, conversation_id, meeting_id')
    .eq('status', 'pending');

  let withCompany = 0, withContact = 0, withDeal = 0, withConversation = 0, withMeeting = 0;
  for (const l of linking || []) {
    if (l.company_id) withCompany++;
    if (l.contact_id) withContact++;
    if (l.deal_id) withDeal++;
    if (l.conversation_id) withConversation++;
    if (l.meeting_id) withMeeting++;
  }
  console.log(`Total items: ${linking?.length}`);
  console.log(`With company_id: ${withCompany} (${((withCompany / (linking?.length || 1)) * 100).toFixed(0)}%)`);
  console.log(`With contact_id: ${withContact} (${((withContact / (linking?.length || 1)) * 100).toFixed(0)}%)`);
  console.log(`With deal_id: ${withDeal} (${((withDeal / (linking?.length || 1)) * 100).toFixed(0)}%)`);
  console.log(`With conversation_id: ${withConversation} (${((withConversation / (linking?.length || 1)) * 100).toFixed(0)}%)`);
  console.log(`With meeting_id: ${withMeeting} (${((withMeeting / (linking?.length || 1)) * 100).toFixed(0)}%)`);

  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
