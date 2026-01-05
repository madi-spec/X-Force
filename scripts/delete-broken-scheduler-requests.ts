/**
 * Delete broken scheduling requests that have no attendees
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../src/lib/supabase/admin';

async function deleteRequests() {
  const supabase = createAdminClient();

  const requestIds = [
    'e4269636-6db4-41ab-80a8-b9267cb80044', // Lawn Doctor of Warren
    'd45e7639-0821-4186-9692-078c57aa956e', // Nutrigreen
  ];

  console.log('=== Deleting Broken Scheduling Requests ===\n');

  for (const id of requestIds) {
    // Get request info first
    const { data: req } = await supabase
      .from('scheduling_requests')
      .select('id, title, status')
      .eq('id', id)
      .single();

    if (req) {
      console.log(`Deleting: ${req.title} (${req.status})`);

      // Delete any actions first
      const { error: actionsError } = await supabase
        .from('scheduling_actions')
        .delete()
        .eq('scheduling_request_id', id);

      if (actionsError) {
        console.log(`  Warning: Could not delete actions: ${actionsError.message}`);
      }

      // Delete any attendees (should be 0, but just in case)
      const { error: attendeesError } = await supabase
        .from('scheduling_attendees')
        .delete()
        .eq('scheduling_request_id', id);

      if (attendeesError) {
        console.log(`  Warning: Could not delete attendees: ${attendeesError.message}`);
      }

      // Delete the request
      const { error: reqError } = await supabase
        .from('scheduling_requests')
        .delete()
        .eq('id', id);

      if (reqError) {
        console.log(`  ERROR: ${reqError.message}`);
      } else {
        console.log(`  ✅ Deleted successfully`);
      }
    } else {
      console.log(`Request ${id} not found (already deleted?)`);
    }
  }

  // Verify
  console.log('\n=== Verification ===');
  const { data: remaining } = await supabase
    .from('scheduling_requests')
    .select('id, title')
    .order('created_at', { ascending: false });

  console.log(`Remaining scheduling requests: ${remaining?.length || 0}`);
  for (const r of remaining || []) {
    console.log(`  - ${r.title}`);
  }
}

deleteRequests().catch(console.error);
