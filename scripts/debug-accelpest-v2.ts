import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debug() {
  console.log('=== Debugging AccelPest Email v2 ===\n');

  // Search for anything with "accel" or "receptionist" in various fields
  console.log('Searching command_center_items...');
  const { data: items } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, email_id, status, company_name, description, updated_at')
    .or('title.ilike.%accel%,description.ilike.%accel%,title.ilike.%agreement%,description.ilike.%agreement%')
    .order('updated_at', { ascending: false })
    .limit(10);

  console.log('Items found:', items?.length || 0);
  items?.forEach((i, idx) => {
    console.log(`\n${idx + 1}. ${i.title?.substring(0, 60)}`);
    console.log('   Status:', i.status);
    console.log('   Source:', i.source);
    console.log('   source_id:', i.source_id);
    console.log('   email_id:', i.email_id);
    console.log('   updated_at:', i.updated_at);
  });

  // Search communications for accelpest
  console.log('\n\n=== Communications with accelpest ===\n');
  const { data: comms } = await supabase
    .from('communications')
    .select('id, subject, external_id, source_table, source_id, direction, their_participants')
    .ilike('subject', '%agreement%')
    .limit(10);

  console.log('Communications found:', comms?.length || 0);
  comms?.forEach((c, idx) => {
    console.log(`\n${idx + 1}. ${c.subject?.substring(0, 60)}`);
    console.log('   Direction:', c.direction);
    console.log('   Participants:', JSON.stringify(c.their_participants)?.substring(0, 80));
    console.log('   external_id:', c.external_id ? 'YES' : 'NULL');
  });

  // Check email_messages table
  console.log('\n\n=== Email Messages with agreement ===\n');
  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, to_email')
    .ilike('subject', '%agreement%')
    .limit(5);

  console.log('Email messages found:', emails?.length || 0);
  emails?.forEach((e, idx) => {
    console.log(`\n${idx + 1}. ${e.subject}`);
    console.log('   From:', e.from_email);
    console.log('   To:', e.to_email);
    console.log('   ID:', e.id);
  });

  // Most recently updated completed items
  console.log('\n\n=== Most Recently Updated Completed Items ===\n');
  const { data: recent } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, email_id, status, updated_at')
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(5);

  recent?.forEach((i, idx) => {
    console.log(`\n${idx + 1}. ${i.title?.substring(0, 60)}`);
    console.log('   Source:', i.source);
    console.log('   source_id:', i.source_id);
    console.log('   email_id:', i.email_id);
    console.log('   updated_at:', i.updated_at);
  });
}

debug().catch(console.error);
