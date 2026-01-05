import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check the 6 awaiting response items and their response_due_by
  const { data: items } = await supabase
    .from('communications')
    .select('id, subject, response_due_by, created_at, company_id')
    .eq('awaiting_our_response', true)
    .is('responded_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('=== Awaiting Response Items - Attention Level Analysis ===\n');

  const now = new Date();
  items?.forEach(item => {
    let attentionLevel = 'soon'; // default
    if (item.response_due_by) {
      const dueDate = new Date(item.response_due_by);
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilDue < 0) {
        attentionLevel = 'now (OVERDUE)';
      } else if (hoursUntilDue <= 4) {
        attentionLevel = 'now (due soon)';
      } else if (hoursUntilDue <= 24) {
        attentionLevel = 'soon';
      } else {
        attentionLevel = 'monitor';
      }
      console.log(`${item.subject?.substring(0, 50)}`);
      console.log(`  response_due_by: ${item.response_due_by}`);
      console.log(`  hours until due: ${hoursUntilDue.toFixed(1)}`);
      console.log(`  attention_level: ${attentionLevel}\n`);
    } else {
      console.log(`${item.subject?.substring(0, 50)}`);
      console.log(`  response_due_by: NULL`);
      console.log(`  attention_level: soon (no due date)\n`);
    }
  });

  console.log('\n=== Summary ===');
  console.log(`Total awaiting response: ${items?.length || 0}`);
  console.log(`Without response_due_by means they show as "soon", not "now"`);
  console.log(`Only "now" items appear in Action Now queue`);
}

check().catch(console.error);
