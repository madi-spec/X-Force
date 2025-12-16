import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixUserAttribution() {
  // Get Michael Wheelock's user ID
  const { data: mw } = await supabase
    .from('users')
    .select('id, name')
    .eq('name', 'Michael Wheelock')
    .single();

  // Get Brent Allen's user ID (the correct xraisales user)
  const { data: ba } = await supabase
    .from('users')
    .select('id, name')
    .eq('email', 'xraisales@affiliatedtech.com')
    .single();

  if (!mw || !ba) {
    console.error('Could not find users');
    console.log('Michael Wheelock:', mw);
    console.log('Brent Allen:', ba);
    return;
  }

  console.log('Michael Wheelock ID:', mw.id);
  console.log('Brent Allen ID:', ba.id);

  // Count activities to fix
  const { count } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', mw.id)
    .eq('metadata->>source', 'pst_import');

  console.log('\nActivities to fix (PST imports attributed to Michael Wheelock):', count);

  if (count === 0) {
    console.log('No activities need fixing.');
    return;
  }

  // Update all PST import activities from Michael Wheelock to Brent Allen
  const { error } = await supabase
    .from('activities')
    .update({ user_id: ba.id })
    .eq('user_id', mw.id)
    .eq('metadata->>source', 'pst_import');

  if (error) {
    console.error('Error updating activities:', error);
    return;
  }

  console.log('Successfully updated ' + count + ' activities from Michael Wheelock to Brent Allen');

  // Verify
  const { count: remainingCount } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', mw.id);

  console.log('\nRemaining activities for Michael Wheelock:', remainingCount);
}

fixUserAttribution();
