import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function investigate() {
  // Find Michael Wheelock contact
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, email, company_id')
    .ilike('name', '%wheelock%');
  
  console.log('=== Wheelock Contacts ===');
  console.log(JSON.stringify(contacts, null, 2));

  // Check users table
  const { data: users } = await supabase
    .from('users')
    .select('id, email, name')
    .ilike('name', '%wheelock%');
  
  console.log('\n=== Wheelock Users ===');
  console.log(JSON.stringify(users, null, 2));

  // Check activities with wheelock in subject or body
  const { data: activities } = await supabase
    .from('activities')
    .select('id, type, subject, company_id, metadata')
    .or('subject.ilike.%wheelock%,body.ilike.%wheelock%')
    .limit(10);
  
  console.log('\n=== Activities mentioning Wheelock in subject/body ===');
  console.log('Count:', activities?.length);
  activities?.forEach(a => {
    console.log(`  - [${a.type}] ${a.subject}`);
  });

  // Check if there's a default user being used
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, email, name');
  
  console.log('\n=== All Users ===');
  allUsers?.forEach(u => console.log(`  - ${u.name} (${u.email})`));

  // Check activities count per user
  const { data: activityCounts } = await supabase
    .from('activities')
    .select('user_id')
    .limit(1000);
  
  const counts = {};
  activityCounts?.forEach(a => {
    counts[a.user_id] = (counts[a.user_id] || 0) + 1;
  });
  
  console.log('\n=== Activity counts by user_id ===');
  for (const [userId, count] of Object.entries(counts)) {
    const user = allUsers?.find(u => u.id === userId);
    console.log(`  - ${user?.name || userId}: ${count} activities`);
  }

  // Check PST import user setting
  console.log('\n=== Checking PST Import Config ===');
  const { data: pstUser } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', 'xraisales@affiliatedtech.com')
    .single();
  console.log('PST Import User:', pstUser);
}

investigate();
