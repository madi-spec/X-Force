import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const companyId = 'c81482f1-8e0b-4359-9ab4-eaaae8fb6aa7'; // Lawn Doctor TX

  // Get all recent communications for this company
  console.log('=== Communications for Lawn Doctor TX ===\n');

  const { data: comms } = await supabase
    .from('communications')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(10);

  comms?.forEach(c => {
    console.log(`ID: ${c.id}`);
    console.log(`  Direction: ${c.direction}`);
    console.log(`  From: ${c.from_email}`);
    console.log(`  To: ${c.to_email}`);
    console.log(`  Subject: ${c.subject?.substring(0, 60)}`);
    console.log(`  Created: ${c.created_at}`);
    console.log(`  Awaiting Response: ${c.awaiting_our_response}`);
    console.log(`  Responded At: ${c.responded_at || 'NULL'}`);
    console.log(`  Excluded At: ${c.excluded_at || 'NULL'}`);
    console.log(`  Thread ID: ${c.thread_id || 'NULL'}`);
    console.log(`  In Reply To: ${c.in_reply_to || 'NULL'}`);
    console.log('');
  });

  // Check attention flags for this company
  console.log('\n=== Attention Flags for Lawn Doctor TX ===\n');

  const { data: flags } = await supabase
    .from('attention_flags')
    .select('*')
    .eq('company_id', companyId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false });

  if (flags?.length) {
    flags.forEach(f => {
      console.log(`Flag ID: ${f.id}`);
      console.log(`  Type: ${f.flag_type}`);
      console.log(`  Level: ${f.attention_level}`);
      console.log(`  Reason: ${f.reason}`);
      console.log(`  Source: ${f.source_type} - ${f.source_id}`);
      console.log(`  Created: ${f.created_at}`);
      console.log('');
    });
  } else {
    console.log('No unresolved attention flags');
  }

  // Check command center items
  console.log('\n=== Command Center Items for Lawn Doctor TX ===\n');

  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select('*')
    .eq('company_id', companyId)
    .is('completed_at', null)
    .order('created_at', { ascending: false });

  if (ccItems?.length) {
    ccItems.forEach(i => {
      console.log(`CC Item ID: ${i.id}`);
      console.log(`  Type: ${i.item_type}`);
      console.log(`  Priority: ${i.priority}`);
      console.log(`  Title: ${i.title}`);
      console.log(`  Source: ${i.source_type} - ${i.source_id}`);
      console.log('');
    });
  } else {
    console.log('No pending command center items');
  }
}

run().catch(console.error);
