import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check communications awaiting response
  const { data: needsReply, count } = await supabase
    .from('communications')
    .select('id, subject, direction, awaiting_our_response, company_id', { count: 'exact' })
    .eq('awaiting_our_response', true)
    .limit(5);

  console.log('=== Communications Awaiting Response ===');
  console.log('Count:', count);
  if (needsReply?.length) {
    needsReply.forEach(c => {
      console.log(`  - ${c.subject?.substring(0, 50)} (${c.direction})`);
    });
  }

  // Check attention_flags
  const { data: flags, count: flagCount } = await supabase
    .from('attention_flags')
    .select('id, flag_type, severity, reason', { count: 'exact' })
    .eq('status', 'open')
    .limit(5);

  console.log('\n=== Open Attention Flags ===');
  console.log('Count:', flagCount);
  if (flags?.length) {
    flags.forEach(f => {
      console.log(`  - [${f.flag_type}] ${f.reason?.substring(0, 50)}`);
    });
  }

  // Check command_center_items by source type
  const { data: ccByType } = await supabase
    .from('command_center_items')
    .select('source_type')
    .eq('status', 'pending');

  const counts: Record<string, number> = {};
  ccByType?.forEach(item => {
    counts[item.source_type] = (counts[item.source_type] || 0) + 1;
  });
  console.log('\n=== Command Center Items by Type ===');
  Object.entries(counts).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });

  // Check recent email_messages
  const { data: recentEmails } = await supabase
    .from('email_messages')
    .select('id, subject, from_address, received_at')
    .order('received_at', { ascending: false })
    .limit(5);

  console.log('\n=== Recent Emails ===');
  recentEmails?.forEach(e => {
    console.log(`  - ${e.subject?.substring(0, 50)} from ${e.from_address}`);
  });

  // Check if emails have matching communications
  const { count: emailsWithComms } = await supabase
    .from('communications')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'email');

  console.log('\n=== Email-related Communications ===');
  console.log('Count:', emailsWithComms);
}

check().catch(console.error);
