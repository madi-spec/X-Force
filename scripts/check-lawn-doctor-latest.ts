import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('=== Lawn Doctor TX Timeline ===\n');

  const companyId = 'c81482f1-8e0b-4359-9ab4-eaaae8fb6aa7';
  const threadId = 'c372ec98-764e-433e-b914-156378177c8e';

  // Get all communications in this thread, ordered by time
  const { data: comms } = await supabase
    .from('communications')
    .select('id, subject, direction, occurred_at, awaiting_our_response, responded_at, source_table')
    .eq('thread_id', threadId)
    .order('occurred_at', { ascending: true });

  console.log('Thread timeline (oldest to newest):\n');
  comms?.forEach((c, i) => {
    const time = new Date(c.occurred_at).toLocaleString();
    const status = c.awaiting_our_response ? '⚠️ NEEDS RESPONSE' : '✓';
    console.log(`${i + 1}. ${time} - ${c.direction.toUpperCase()} ${status}`);
    console.log(`   Subject: ${c.subject}`);
    console.log(`   Source: ${c.source_table}`);
    if (c.responded_at) {
      console.log(`   Responded at: ${c.responded_at}`);
    }
    console.log('');
  });

  // Check if there are any outbound emails AFTER the latest inbound
  const awaitingInbound = comms?.filter(c => c.direction === 'inbound' && c.awaiting_our_response);

  if (awaitingInbound?.length) {
    console.log('Items still needing response:');
    awaitingInbound.forEach(c => {
      console.log(`  - ${c.subject} (${c.id})`);
    });

    // Check for later outbounds
    const latestAwaitingTime = awaitingInbound[awaitingInbound.length - 1].occurred_at;
    const laterOutbounds = comms?.filter(c =>
      c.direction === 'outbound' &&
      new Date(c.occurred_at) > new Date(latestAwaitingTime)
    );

    if (laterOutbounds?.length) {
      console.log('\nFound outbound emails after the latest awaiting inbound:');
      laterOutbounds.forEach(c => {
        console.log(`  - ${c.subject} at ${c.occurred_at}`);
      });

      // This means we should mark the inbound as responded
      console.log('\nFixing: marking inbound as responded...');

      for (const inbound of awaitingInbound) {
        const laterReply = laterOutbounds.find(o =>
          new Date(o.occurred_at) > new Date(inbound.occurred_at)
        );
        if (laterReply) {
          const { error } = await supabase
            .from('communications')
            .update({
              awaiting_our_response: false,
              responded_at: laterReply.occurred_at,
            })
            .eq('id', inbound.id);

          if (error) {
            console.log(`Error: ${error.message}`);
          } else {
            console.log(`Fixed: ${inbound.subject}`);
          }
        }
      }
    } else {
      console.log('\nNo outbound emails found after these - they genuinely need responses.');
    }
  } else {
    console.log('All items in this thread have been responded to.');
  }
}

run().catch(console.error);
