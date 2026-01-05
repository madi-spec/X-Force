import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../src/lib/supabase/admin';

async function check() {
  const supabase = createAdminClient();

  console.log('=== Checking Lookout Pest Meeting ===\n');

  // Check the transcript
  const { data: transcripts } = await supabase
    .from('meeting_transcriptions')
    .select('id, title, company_id, deal_id, created_at')
    .ilike('title', '%lookout%')
    .order('created_at', { ascending: false });

  console.log('Transcripts:', transcripts?.length || 0);
  transcripts?.forEach(t => {
    console.log('  -', t.title);
    console.log('    ID:', t.id);
    console.log('    Company:', t.company_id || 'NONE');
  });

  // Check CC items by title
  const { data: ccItems } = await supabase
    .from('command_center_items')
    .select('id, title, tier, status, source_type, created_at')
    .ilike('title', '%lookout%');

  console.log('\nCC Items (lookout):', ccItems?.length || 0);
  ccItems?.forEach(c => console.log('  -', c.title, '|', c.tier, '|', c.status));

  // Check CC items linked to transcript
  if (transcripts?.[0]) {
    const { data: linked } = await supabase
      .from('command_center_items')
      .select('id, title, tier, status')
      .eq('source_id', transcripts[0].id);
    console.log('\nCC linked to transcript:', linked?.length || 0);
    linked?.forEach(l => console.log('  -', l.title, '|', l.tier, '|', l.status));
  }

  // Check tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, status, source')
    .ilike('title', '%lookout%');

  console.log('\nTasks:', tasks?.length || 0);
  tasks?.forEach(t => console.log('  -', t.title, '|', t.status));

  // Check communications
  const { data: comms } = await supabase
    .from('communications')
    .select('id, subject, type, company_id')
    .ilike('subject', '%lookout%');

  console.log('\nCommunications:', comms?.length || 0);
  comms?.forEach(c => console.log('  -', c.subject, '|', c.type));
}

check().catch(console.error);
