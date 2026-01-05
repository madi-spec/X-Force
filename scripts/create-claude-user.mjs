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

async function createClaudeUser() {
  const email = 'claude-test@xrailabs.com';
  const password = 'ClaudeTest2025!';

  try {
    console.log('Creating Claude test user...');

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('User already exists, updating password...');
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users?.find(u => u.email === email);
        if (existingUser) {
          await supabase.auth.admin.updateUserById(existingUser.id, { password });
          console.log('Password updated for existing user');
        }
      } else {
        throw authError;
      }
    } else {
      console.log('Created auth user:', authData.user.id);

      // Create entry in users table
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          auth_id: authData.user.id,
          email,
          name: 'Claude Test User',
          role: 'admin'
        });

      if (insertError && !insertError.message.includes('duplicate')) {
        console.warn('Note: Could not create users table entry:', insertError.message);
      } else {
        console.log('Created users table entry');
      }
    }

    console.log('\n✅ Claude test user ready!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('\nTo delete later, run: node scripts/delete-claude-user.mjs');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

createClaudeUser();
