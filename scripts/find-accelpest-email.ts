import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function find() {
  console.log('=== Finding AccelPest/Receptionist Email ===\n');

  // Search communications for accelpest or receptionist
  const { data: comms } = await supabase
    .from('communications')
    .select('id, subject, external_id, direction, their_participants, our_participants, occurred_at')
    .or('subject.ilike.%receptionist%,subject.ilike.%accelpest%')
    .order('occurred_at', { ascending: false })
    .limit(10);

  console.log('Communications with receptionist/accelpest:', comms?.length || 0);
  comms?.forEach((c, idx) => {
    console.log(`\n${idx + 1}. ${c.subject}`);
    console.log('   Direction:', c.direction);
    console.log('   Their:', JSON.stringify(c.their_participants)?.substring(0, 100));
    console.log('   external_id:', c.external_id ? 'YES' : 'NULL');
    console.log('   occurred_at:', c.occurred_at);
  });

  // Search by email address
  console.log('\n\n=== Communications with david@accelpest.com ===\n');
  const { data: davidComms } = await supabase
    .from('communications')
    .select('id, subject, external_id, direction, their_participants, occurred_at')
    .contains('their_participants', [{ email: 'david@accelpest.com' }])
    .limit(10);

  console.log('Found:', davidComms?.length || 0);
  davidComms?.forEach((c, idx) => {
    console.log(`\n${idx + 1}. ${c.subject}`);
    console.log('   Direction:', c.direction);
    console.log('   external_id:', c.external_id ? c.external_id.substring(0, 40) + '...' : 'NULL');
  });

  // Search email_messages for accelpest
  console.log('\n\n=== Email Messages to/from accelpest ===\n');
  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, to_email, received_at')
    .or('from_email.ilike.%accelpest%,to_email.ilike.%accelpest%')
    .order('received_at', { ascending: false })
    .limit(10);

  console.log('Found:', emails?.length || 0);
  emails?.forEach((e, idx) => {
    console.log(`\n${idx + 1}. ${e.subject}`);
    console.log('   From:', e.from_email);
    console.log('   To:', e.to_email);
    console.log('   ID:', e.id);
  });

  // Check what the user just marked as done (most recent status change)
  console.log('\n\n=== Items marked done in last hour ===\n');
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentDone } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, email_id, status, updated_at, company_name')
    .eq('status', 'completed')
    .gte('updated_at', oneHourAgo)
    .order('updated_at', { ascending: false })
    .limit(10);

  console.log('Found:', recentDone?.length || 0);
  recentDone?.forEach((i, idx) => {
    console.log(`\n${idx + 1}. ${i.title?.substring(0, 60)}`);
    console.log('   Company:', i.company_name);
    console.log('   Source:', i.source);
    console.log('   source_id:', i.source_id);
    console.log('   email_id:', i.email_id);
    console.log('   updated_at:', i.updated_at);
  });
}

find().catch(console.error);
