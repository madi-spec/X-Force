/**
 * Backfill Response Linking
 *
 * Finds outbound emails that have matching inbound emails in the same thread
 * that weren't marked as responded, and fixes them.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('=== Backfill Response Linking ===\n');

  // Find all inbound communications that are still awaiting response
  const { data: pendingInbound, error: inboundError } = await supabase
    .from('communications')
    .select('id, subject, thread_id, occurred_at, company_id')
    .eq('direction', 'inbound')
    .eq('awaiting_our_response', true)
    .not('thread_id', 'is', null)
    .order('occurred_at', { ascending: false })
    .limit(500);

  if (inboundError) {
    console.error('Error fetching pending inbound:', inboundError);
    return;
  }

  console.log(`Found ${pendingInbound?.length || 0} pending inbound emails with thread_id\n`);

  let fixed = 0;
  let alreadyCorrect = 0;

  for (const inbound of pendingInbound || []) {
    // Check if there's an outbound email in the same thread that came after this one
    const { data: outbounds } = await supabase
      .from('communications')
      .select('id, subject, occurred_at')
      .eq('thread_id', inbound.thread_id)
      .eq('direction', 'outbound')
      .gt('occurred_at', inbound.occurred_at)
      .order('occurred_at', { ascending: true })
      .limit(1);

    if (outbounds && outbounds.length > 0) {
      const outbound = outbounds[0];

      // Mark the inbound as responded
      const { error: updateError } = await supabase
        .from('communications')
        .update({
          awaiting_our_response: false,
          responded_at: outbound.occurred_at,
        })
        .eq('id', inbound.id);

      if (updateError) {
        console.error(`Failed to update ${inbound.id}:`, updateError.message);
      } else {
        console.log(`Fixed: "${inbound.subject?.substring(0, 50)}"`);
        console.log(`  Inbound: ${inbound.occurred_at}`);
        console.log(`  Responded: ${outbound.occurred_at}`);
        console.log(`  Reply: "${outbound.subject?.substring(0, 50)}"\n`);
        fixed++;
      }
    } else {
      alreadyCorrect++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Fixed: ${fixed}`);
  console.log(`No response found (correct): ${alreadyCorrect}`);
}

run().catch(console.error);
