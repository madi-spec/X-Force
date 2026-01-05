/**
 * Check Lookout meetings in activities
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // Check for Lookout meetings in activities
  const { data: lookoutMeetings } = await supabase
    .from('activities')
    .select('id, subject, type, company_id, occurred_at')
    .eq('type', 'meeting')
    .ilike('subject', '%lookout%')
    .order('occurred_at', { ascending: false })
    .limit(5);

  console.log('=== Lookout Meetings in Activities ===');
  if (lookoutMeetings && lookoutMeetings.length > 0) {
    for (const m of lookoutMeetings) {
      console.log(`  ${m.subject}`);
      console.log(`    ID: ${m.id}`);
      console.log(`    Company ID: ${m.company_id || '(none)'}`);
      console.log(`    Occurred: ${m.occurred_at}`);
    }
  } else {
    console.log('  No meetings found matching "Lookout"');
  }

  // Also check all upcoming meetings
  const now = new Date().toISOString();
  const { data: upcomingMeetings } = await supabase
    .from('activities')
    .select('id, subject, type, company_id, occurred_at')
    .eq('type', 'meeting')
    .gte('occurred_at', now)
    .order('occurred_at', { ascending: true })
    .limit(10);

  console.log('\n=== All Upcoming Meetings ===');
  if (upcomingMeetings && upcomingMeetings.length > 0) {
    for (const m of upcomingMeetings) {
      console.log(`  ${m.subject}`);
      console.log(`    Company ID: ${m.company_id || '(none)'}`);
      console.log(`    Occurred: ${m.occurred_at}`);
    }
  } else {
    console.log('  No upcoming meetings found');
  }
}

run().catch(console.error);
