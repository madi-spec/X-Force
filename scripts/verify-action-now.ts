import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  console.log('=== Verify Action Now Items ===\n');

  // Get all awaiting response items
  const { data: items } = await supabase
    .from('communications')
    .select(`
      id,
      subject,
      company_id,
      response_due_by,
      occurred_at,
      direction,
      channel,
      company:companies(name)
    `)
    .eq('awaiting_our_response', true)
    .is('responded_at', null)
    .order('occurred_at', { ascending: false })
    .limit(15);

  console.log(`Found ${items?.length || 0} items awaiting response:\n`);

  const now = new Date();
  items?.forEach((item, i) => {
    const company = Array.isArray(item.company) ? item.company[0] : item.company;
    let attentionLevel = 'soon'; // default

    if (item.response_due_by) {
      const dueDate = new Date(item.response_due_by);
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilDue < 0) {
        attentionLevel = 'NOW (OVERDUE)';
      } else if (hoursUntilDue <= 4) {
        attentionLevel = 'NOW (due soon)';
      } else if (hoursUntilDue <= 24) {
        attentionLevel = 'soon';
      } else {
        attentionLevel = 'monitor';
      }
    }

    console.log(`${i + 1}. ${company?.name || 'Unknown'}`);
    console.log(`   Subject: ${item.subject?.substring(0, 50)}`);
    console.log(`   Occurred: ${new Date(item.occurred_at).toLocaleString()}`);
    console.log(`   Due: ${item.response_due_by ? new Date(item.response_due_by).toLocaleString() : 'NOT SET'}`);
    console.log(`   → Attention Level: ${attentionLevel}`);
    console.log('');
  });

  // Summary
  const nowItems = items?.filter(item => {
    if (!item.response_due_by) return false;
    const hoursUntilDue = (new Date(item.response_due_by).getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilDue < 0 || hoursUntilDue <= 4;
  });

  console.log('=== SUMMARY ===');
  console.log(`Total awaiting response: ${items?.length || 0}`);
  console.log(`Items in NOW level (should appear in Action Now): ${nowItems?.length || 0}`);
}

verify().catch(console.error);
