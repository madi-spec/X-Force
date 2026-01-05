import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deleteClaudeUser() {
  const email = 'claude-test@xrailabs.com';

  try {
    console.log('Finding Claude test user...');

    // Find the user
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === email);

    if (!user) {
      console.log('User not found in auth');
    } else {
      // Delete from users table first
      const { error: deleteUserError } = await supabase
        .from('users')
        .delete()
        .eq('email', email);

      if (deleteUserError) {
        console.warn('Note: Could not delete from users table:', deleteUserError.message);
      } else {
        console.log('Deleted from users table');
      }

      // Delete from auth
      const { error: authError } = await supabase.auth.admin.deleteUser(user.id);

      if (authError) {
        throw authError;
      }

      console.log('Deleted from auth');
    }

    console.log('\n✅ Claude test user deleted!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

deleteClaudeUser();
