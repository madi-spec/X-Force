import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Check all users
const { data: users, error } = await supabase
  .from('users')
  .select('id, auth_id, name, email')
  .limit(10);

if (error) {
  console.log('Error:', error);
} else {
  console.log('Users in database:');
  for (const u of users) {
    console.log(`- ID: ${u.id}`);
    console.log(`  Auth ID: ${u.auth_id}`);
    console.log(`  Name: ${u.name}`);
    console.log(`  Email: ${u.email}`);
    console.log();
  }
}

// Check recent scheduling requests to see what user ID is being used
const { data: requests } = await supabase
  .from('scheduling_requests')
  .select('id, created_by, title, created_at')
  .order('created_at', { ascending: false })
  .limit(3);

if (requests) {
  console.log('Recent scheduling requests:');
  for (const r of requests) {
    console.log(`- ${r.title}`);
    console.log(`  ID: ${r.id}`);
    console.log(`  Created by: ${r.created_by}`);
    console.log(`  Created at: ${r.created_at}`);
    console.log();
  }
}
