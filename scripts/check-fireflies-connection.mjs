import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function check() {
  // Check fireflies connections
  const { data: connections } = await supabase
    .from('fireflies_connections')
    .select('user_id, is_active, transcripts_synced, last_sync_at');

  console.log('=== Fireflies Connections ===');
  const { data: allUsers } = await supabase.from('users').select('id, name, email');

  for (const conn of connections || []) {
    const user = allUsers.find(u => u.id === conn.user_id);
    console.log('  - ' + (user ? user.name : conn.user_id) + ': ' + conn.transcripts_synced + ' synced, active=' + conn.is_active);
  }

  // Check meeting_transcriptions by user
  const { data: transcriptions } = await supabase
    .from('meeting_transcriptions')
    .select('user_id')
    .limit(500);

  const counts = {};
  transcriptions?.forEach(t => {
    counts[t.user_id] = (counts[t.user_id] || 0) + 1;
  });

  console.log('\n=== Meeting Transcriptions by User ===');
  for (const [userId, count] of Object.entries(counts)) {
    const user = allUsers.find(u => u.id === userId);
    console.log('  - ' + (user ? user.name : userId) + ': ' + count + ' transcriptions');
  }

  // Check Michael Wheelock's user_id
  const mw = allUsers.find(u => u.name === 'Michael Wheelock');

  // Check sample activities for Michael Wheelock
  console.log('\n=== Sample Activities for Michael Wheelock ===');
  const { data: mwActivities } = await supabase
    .from('activities')
    .select('id, type, subject, metadata, created_at')
    .eq('user_id', mw?.id)
    .order('created_at', { ascending: false })
    .limit(10);

  mwActivities?.forEach(a => {
    console.log('  - [' + a.type + '] ' + a.subject);
    console.log('    Source: ' + (a.metadata?.source || 'unknown'));
  });

  // Check what user initiated activities in batches (by looking at timestamps)
  console.log('\n=== Activity Sources for Michael Wheelock ===');
  const { data: mwActivitySources } = await supabase
    .from('activities')
    .select('metadata')
    .eq('user_id', mw?.id)
    .limit(100);

  const sources = {};
  mwActivitySources?.forEach(a => {
    const src = a.metadata?.source || 'no_source';
    sources[src] = (sources[src] || 0) + 1;
  });
  console.log(sources);
}

check();
