/**
 * Check Lookout meeting prep item
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // Find Lookout company
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, domain')
    .ilike('name', '%lookout%');

  console.log('=== Lookout Companies ===');
  if (companies && companies.length > 0) {
    for (const c of companies) {
      console.log(`  ${c.name} (${c.id})`);
      console.log(`    Domain: ${c.domain || '(none)'}`);
    }
  } else {
    console.log('  No companies found matching "Lookout"');
  }

  // Check calendar events for today/tomorrow
  console.log('\n=== Checking Calendar Events ===');

  // Get user's Microsoft connection
  const { data: connections } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('provider', 'microsoft')
    .limit(1);

  if (connections && connections.length > 0) {
    console.log('Found Microsoft connection for user:', connections[0].user_id);
  }

  // Check meeting_prep table if it exists
  const { data: meetingPreps, error: mpError } = await supabase
    .from('meeting_prep')
    .select('*')
    .ilike('meeting_title', '%lookout%')
    .limit(5);

  if (mpError) {
    console.log('\n=== Meeting Prep Table ===');
    console.log('  Error or table does not exist:', mpError.message);
  } else if (meetingPreps && meetingPreps.length > 0) {
    console.log('\n=== Meeting Prep Records ===');
    for (const mp of meetingPreps) {
      console.log(`  ${mp.meeting_title}`);
      console.log(`    Company ID: ${mp.company_id}`);
      console.log(`    Meeting ID: ${mp.meeting_id}`);
    }
  }

  // Check command center for meeting prep items
  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('category', 'meeting_prep')
    .limit(10);

  console.log('\n=== Command Center Meeting Prep Items ===');
  if (ccItems && ccItems.length > 0) {
    for (const item of ccItems) {
      console.log(`  ${item.title}`);
      console.log(`    Company ID: ${item.company_id}`);
      console.log(`    Status: ${item.status}`);
    }
  } else {
    console.log('  None found');
  }
}

run().catch(console.error);
