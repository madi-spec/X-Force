/**
 * Cleanup Script: Resolve Action Now items for confirmed meetings
 *
 * This script finds all CONFIRMED scheduling requests and cleans up any
 * leftover attention flags and communications that should have been resolved.
 *
 * Run with: npx tsx scripts/cleanup-confirmed-scheduling-items.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupConfirmedSchedulingItems() {
  console.log('='.repeat(60));
  console.log('Cleanup: Resolve items for confirmed scheduling requests');
  console.log('='.repeat(60));

  // 1. Find all CONFIRMED scheduling requests
  const { data: confirmedRequests, error: reqError } = await supabase
    .from('scheduling_requests')
    .select('id, company_id, email_thread_id, scheduled_time, status')
    .eq('status', 'confirmed');

  if (reqError) {
    console.error('Error fetching confirmed requests:', reqError);
    return;
  }

  console.log(`\nFound ${confirmedRequests?.length || 0} confirmed scheduling requests\n`);

  let totalFlagsResolved = 0;
  let totalCommsMarked = 0;

  for (const request of (confirmedRequests || [])) {
    console.log(`\n--- Processing request ${request.id} (company: ${request.company_id}) ---`);

    // 2. Resolve attention flags linked to this request by source_id
    const { data: flagsBySource, error: flagError1 } = await supabase
      .from('attention_flags')
      .select('id, flag_type')
      .eq('source_id', request.id)
      .eq('status', 'open');

    if (!flagError1 && flagsBySource && flagsBySource.length > 0) {
      console.log(`  Found ${flagsBySource.length} open flags by source_id`);
      const flagIds = flagsBySource.map(f => f.id);

      const { error: updateError } = await supabase
        .from('attention_flags')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_notes: `Auto-resolved by cleanup script: Meeting confirmed for ${request.scheduled_time}`,
        })
        .in('id', flagIds);

      if (updateError) {
        console.error('  Error resolving flags:', updateError);
      } else {
        console.log(`  ✓ Resolved ${flagIds.length} flags`);
        totalFlagsResolved += flagIds.length;
      }
    }

    // 3. Resolve BOOK_MEETING_APPROVAL flags for this company
    if (request.company_id) {
      const { data: companyFlags, error: flagError2 } = await supabase
        .from('attention_flags')
        .select('id, flag_type')
        .eq('company_id', request.company_id)
        .eq('status', 'open')
        .eq('flag_type', 'BOOK_MEETING_APPROVAL');

      if (!flagError2 && companyFlags && companyFlags.length > 0) {
        console.log(`  Found ${companyFlags.length} open BOOK_MEETING_APPROVAL flags for company`);
        const flagIds = companyFlags.map(f => f.id);

        const { error: updateError } = await supabase
          .from('attention_flags')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_notes: `Auto-resolved by cleanup script: Meeting confirmed for ${request.scheduled_time}`,
          })
          .in('id', flagIds);

        if (!updateError) {
          console.log(`  ✓ Resolved ${flagIds.length} BOOK_MEETING_APPROVAL flags`);
          totalFlagsResolved += flagIds.length;
        }
      }
    }

    // 4. Mark communications in the thread as responded
    if (request.email_thread_id) {
      const { data: threadComms, error: commError } = await supabase
        .from('communications')
        .select('id')
        .eq('thread_id', request.email_thread_id)
        .eq('awaiting_our_response', true);

      if (!commError && threadComms && threadComms.length > 0) {
        console.log(`  Found ${threadComms.length} communications in thread awaiting response`);
        const commIds = threadComms.map(c => c.id);

        const { error: updateError } = await supabase
          .from('communications')
          .update({
            awaiting_our_response: false,
            responded_at: request.scheduled_time || new Date().toISOString(),
          })
          .in('id', commIds);

        if (!updateError) {
          console.log(`  ✓ Marked ${commIds.length} communications as responded`);
          totalCommsMarked += commIds.length;
        }
      }
    }

    // 5. Also check communications by company for recent items
    if (request.company_id) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recentComms, error: commError2 } = await supabase
        .from('communications')
        .select('id')
        .eq('company_id', request.company_id)
        .eq('awaiting_our_response', true)
        .gte('created_at', sevenDaysAgo);

      if (!commError2 && recentComms && recentComms.length > 0) {
        console.log(`  Found ${recentComms.length} recent company communications awaiting response`);
        const commIds = recentComms.map(c => c.id);

        const { error: updateError } = await supabase
          .from('communications')
          .update({
            awaiting_our_response: false,
            responded_at: request.scheduled_time || new Date().toISOString(),
          })
          .in('id', commIds);

        if (!updateError) {
          console.log(`  ✓ Marked ${commIds.length} company communications as responded`);
          totalCommsMarked += commIds.length;
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('CLEANUP SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total attention flags resolved: ${totalFlagsResolved}`);
  console.log(`Total communications marked as responded: ${totalCommsMarked}`);
  console.log('='.repeat(60));
}

cleanupConfirmedSchedulingItems()
  .then(() => {
    console.log('\nCleanup complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
