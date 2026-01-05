/**
 * Fix existing scheduling requests that are missing attendees/data
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';

async function diagnoseAndFix() {
  const supabase = createAdminClient();

  console.log('=== Diagnosing Scheduling Requests ===\n');

  // 1. Get all scheduling requests
  const { data: requests, error: reqError } = await supabase
    .from('scheduling_requests')
    .select(`
      *,
      attendees:scheduling_attendees(*),
      company:companies(id, name, domain)
    `)
    .order('created_at', { ascending: false });

  if (reqError) {
    console.error('Error fetching requests:', reqError);
    return;
  }

  console.log(`Found ${requests?.length || 0} scheduling requests:\n`);

  for (const req of requests || []) {
    console.log(`--- Request: ${req.id} ---`);
    console.log(`  Title: ${req.title}`);
    console.log(`  Status: ${req.status}`);
    console.log(`  Company ID: ${req.company_id}`);
    console.log(`  Company Name: ${req.company?.name || 'NOT JOINED'}`);
    console.log(`  Created: ${req.created_at}`);
    console.log(`  Attendees: ${req.attendees?.length || 0}`);

    if (req.attendees?.length > 0) {
      for (const att of req.attendees) {
        console.log(`    - ${att.side}: ${att.name || 'No name'} <${att.email}> (organizer: ${att.is_organizer}, primary: ${att.is_primary_contact})`);
      }
    }
    console.log('');
  }

  // 2. Find requests with missing attendees
  const requestsWithNoAttendees = (requests || []).filter(r => !r.attendees || r.attendees.length === 0);

  console.log(`\n=== Requests Missing Attendees: ${requestsWithNoAttendees.length} ===\n`);

  for (const req of requestsWithNoAttendees) {
    console.log(`Request: ${req.title} (${req.id})`);
    console.log(`  Company: ${req.company?.name || 'Unknown'} (${req.company_id})`);

    // Try to find the source communication if we can identify it
    if (req.company_id) {
      // Look for recent communications from this company
      const { data: comms } = await supabase
        .from('communications')
        .select('id, subject, sender_email, sender_name, occurred_at')
        .eq('company_id', req.company_id)
        .eq('direction', 'inbound')
        .order('occurred_at', { ascending: false })
        .limit(3);

      if (comms?.length) {
        console.log('  Recent communications from this company:');
        for (const comm of comms) {
          console.log(`    - ${comm.subject} from ${comm.sender_name} <${comm.sender_email}> (${comm.occurred_at})`);
          console.log(`      ID: ${comm.id}`);
        }
      }
    }

    // Get the user who created this
    const { data: creator } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', req.created_by)
      .single();

    if (creator) {
      console.log(`  Created by: ${creator.name} <${creator.email}>`);
    }

    console.log('');
  }
}

diagnoseAndFix().catch(console.error);
