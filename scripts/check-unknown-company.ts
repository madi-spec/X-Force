import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Check communications with null company_id
  const { data: comms, count } = await supabase
    .from('communications')
    .select('id, subject, response_due_by, created_at, excluded_at, responded_at')
    .is('company_id', null)
    .eq('awaiting_our_response', true)
    .is('excluded_at', null)
    .is('responded_at', null);

  console.log(`Found ${count} communications without company that are awaiting response`);
  if (comms && comms.length > 0) {
    comms.forEach(c => {
      const responseDueBy = c.response_due_by;
      let attentionLevel = 'soon';
      if (responseDueBy) {
        const dueDate = new Date(responseDueBy);
        const now = new Date();
        const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilDue < 0) {
          attentionLevel = 'now (overdue)';
        } else if (hoursUntilDue <= 4) {
          attentionLevel = 'now (due soon)';
        } else if (hoursUntilDue <= 24) {
          attentionLevel = 'soon';
        } else {
          attentionLevel = 'monitor';
        }
      }
      console.log(`  - [${attentionLevel}] ${c.subject?.substring(0, 50)} (due: ${c.response_due_by || 'none'})`);
    });
  }
}

main().catch(console.error);
