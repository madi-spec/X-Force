import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  console.log('=== Testing Daily Driver Logic ===\n');

  // Simulate what the API does
  const now = new Date();

  // 1. Get needs reply communications
  const { data: needsReplyRaw, error } = await supabase
    .from('communications')
    .select(`
      id,
      company_id,
      contact_id,
      user_id,
      subject,
      content_preview,
      response_due_by,
      created_at,
      updated_at,
      current_analysis_id,
      company:companies(id, name),
      contact:contacts(id, name, email)
    `)
    .eq('awaiting_our_response', true)
    .is('responded_at', null)
    .order('response_due_by', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total awaiting response:', needsReplyRaw?.length || 0);

  // Group by attention level
  const now_items: typeof needsReplyRaw = [];
  const soon_items: typeof needsReplyRaw = [];
  const monitor_items: typeof needsReplyRaw = [];

  needsReplyRaw?.forEach(row => {
    const responseDueBy = row.response_due_by;
    let attentionLevel = 'soon'; // Default

    if (responseDueBy) {
      const dueDate = new Date(responseDueBy);
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilDue < 0) {
        attentionLevel = 'now'; // Overdue
      } else if (hoursUntilDue <= 4) {
        attentionLevel = 'now'; // Due very soon
      } else if (hoursUntilDue <= 24) {
        attentionLevel = 'soon'; // Due today
      } else {
        attentionLevel = 'monitor'; // Has time
      }
    }

    if (attentionLevel === 'now') now_items.push(row);
    else if (attentionLevel === 'soon') soon_items.push(row);
    else monitor_items.push(row);
  });

  console.log('\n=== BY ATTENTION LEVEL ===');
  console.log(`NOW (Action Now queue): ${now_items.length}`);
  now_items.forEach(item => {
    const company = Array.isArray(item.company) ? item.company[0] : item.company;
    console.log(`  - ${company?.name || 'Unknown'}: ${item.subject?.substring(0, 50)}`);
  });

  console.log(`\nSOON: ${soon_items.length}`);
  console.log(`MONITOR: ${monitor_items.length}`);

  console.log('\n=== EXPECTED API RESPONSE ===');
  console.log(`byAttentionLevel.now: ${now_items.length} items`);
  console.log(`byAttentionLevel.soon: ${soon_items.length} items`);
  console.log(`byAttentionLevel.monitor: ${monitor_items.length} items`);

  if (now_items.length > 0) {
    console.log('\n✅ There ARE items that should appear in Action Now queue');
    console.log('If they\'re not appearing, the issue is in the UI rendering');
  } else {
    console.log('\n⚠️ NO items qualify for Action Now (all have attention_level="soon" or "monitor")');
  }
}

test().catch(console.error);
