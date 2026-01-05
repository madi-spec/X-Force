import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REQUEST_ID = '150ceedc-2230-4778-8de2-ca63a65be074';

async function debug() {
  console.log('=== Debugging Scheduling Request ===\n');

  // 1. Get the scheduling request
  const { data: request, error: reqError } = await supabase
    .from('scheduling_requests')
    .select('id, title, status, created_by')
    .eq('id', REQUEST_ID)
    .single();

  if (reqError) {
    console.log('Error fetching request:', reqError);
    return;
  }

  console.log('Scheduling Request:');
  console.log('  ID:', request.id);
  console.log('  Title:', request.title);
  console.log('  Status:', request.status);
  console.log('  Created By (user_id):', request.created_by);
  console.log();

  // 2. Look up the user by ID
  const userId = request.created_by;
  console.log('Looking up user with ID:', userId);

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, name, email, auth_id')
    .eq('id', userId)
    .single();

  if (userError) {
    console.log('ERROR: User lookup failed!');
    console.log('  Error code:', userError.code);
    console.log('  Error message:', userError.message);
    console.log('  Error details:', userError.details);
    console.log('  Error hint:', userError.hint);
  } else if (!user) {
    console.log('ERROR: No user found with ID:', userId);
  } else {
    console.log('User found:');
    console.log('  ID:', user.id);
    console.log('  Name:', user.name);
    console.log('  Email:', user.email);
    console.log('  Auth ID:', user.auth_id);
  }
  console.log();

  // 3. Also check if there's an issue with the ID format
  console.log('Checking user ID format:');
  console.log('  Length:', userId?.length);
  console.log('  Type:', typeof userId);
  console.log('  Is valid UUID pattern:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || ''));
  console.log();

  // 4. List all users to compare
  console.log('All users in database:');
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, email')
    .limit(10);

  for (const u of allUsers || []) {
    console.log(`  - ${u.id} | ${u.name} | ${u.email}`);
  }
}

debug().catch(console.error);
