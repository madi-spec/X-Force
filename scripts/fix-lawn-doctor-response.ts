import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const inboundId = '0f0f1617-b479-47b8-9b5f-9235bae7c3ed';
  const outboundId = 'b19e831f-6017-4734-b7a4-dac0e7637ef4';

  console.log('Fixing Lawn Doctor TX communication...\n');

  // Update the inbound email to mark as responded
  const { error } = await supabase
    .from('communications')
    .update({
      awaiting_our_response: false,
      responded_at: new Date().toISOString(),
    })
    .eq('id', inboundId);

  if (error) {
    console.log('Error updating:', error.message);
  } else {
    console.log('✓ Updated inbound email - marked as responded');
  }

  // Verify the update
  const { data: updated } = await supabase
    .from('communications')
    .select('subject, awaiting_our_response, responded_at')
    .eq('id', inboundId)
    .single();

  console.log('\nVerified state:');
  console.log(`  Subject: ${updated?.subject}`);
  console.log(`  Awaiting Response: ${updated?.awaiting_our_response}`);
  console.log(`  Responded At: ${updated?.responded_at}`);
}

run().catch(console.error);
