import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debug() {
  console.log('=== Debugging AccelPest Email ===\n');

  // Find the command center item for this email
  const { data: items } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, email_id, status, company_name, target_name')
    .or('company_name.ilike.%accel%,target_name.ilike.%david%,title.ilike.%receptionist%')
    .order('updated_at', { ascending: false })
    .limit(5);

  console.log('Related command center items:');
  items?.forEach((i, idx) => {
    console.log(`\n${idx + 1}. ${i.title?.substring(0, 50)}`);
    console.log('   ID:', i.id);
    console.log('   Status:', i.status);
    console.log('   Source:', i.source);
    console.log('   source_id:', i.source_id);
    console.log('   email_id:', i.email_id);
    console.log('   Company:', i.company_name);
    console.log('   Target:', i.target_name);
  });

  // Also search communications for this email
  console.log('\n\n=== Related Communications ===\n');
  const { data: comms } = await supabase
    .from('communications')
    .select('id, subject, external_id, source_table, source_id, direction')
    .or('subject.ilike.%receptionist%,their_participants.cs.{david@accelpest.com}')
    .limit(5);

  console.log('Communications:');
  comms?.forEach((c, idx) => {
    console.log(`\n${idx + 1}. ${c.subject?.substring(0, 50)}`);
    console.log('   ID:', c.id);
    console.log('   Direction:', c.direction);
    console.log('   source_table:', c.source_table);
    console.log('   source_id:', c.source_id);
    console.log('   external_id:', c.external_id ? c.external_id.substring(0, 40) + '...' : 'NULL');
  });

  // Check recently completed items
  console.log('\n\n=== Recently Completed Items ===\n');
  const { data: recentCompleted } = await supabase
    .from('command_center_items')
    .select('id, title, source, source_id, email_id, status, completed_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(5);

  recentCompleted?.forEach((i, idx) => {
    console.log(`\n${idx + 1}. ${i.title?.substring(0, 50)}`);
    console.log('   ID:', i.id);
    console.log('   Source:', i.source);
    console.log('   source_id:', i.source_id);
    console.log('   email_id:', i.email_id);
    console.log('   completed_at:', i.completed_at);
  });
}

debug().catch(console.error);
