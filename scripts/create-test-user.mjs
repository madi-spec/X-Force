import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const supabaseUrl = 'https://nezewucpbkuzoukomnlv.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey || supabaseServiceKey === 'your-service-role-key') {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.log('You can find this in your Supabase dashboard under Settings > API');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:YOUR_PASSWORD@db.nezewucpbkuzoukomnlv.supabase.co:5432/postgres';
const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function createTestUser() {
  const testEmail = 'madi.chen@xrailabs.com';
  const testPassword = 'testpassword123';

  try {
    console.log('Creating test auth user...');

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('User already exists in auth, fetching...');
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users?.find(u => u.email === testEmail);
        if (existingUser) {
          console.log('Found existing auth user:', existingUser.id);
          // Update the users table to link
          await sql`UPDATE users SET auth_id = ${existingUser.id} WHERE email = ${testEmail}`;
          console.log('Linked to users table');
        }
      } else {
        throw authError;
      }
    } else {
      console.log('Created auth user:', authData.user.id);
      // Link to users table
      await sql`UPDATE users SET auth_id = ${authData.user.id} WHERE email = ${testEmail}`;
      console.log('Linked to users table');
    }

    console.log('\n✅ Test user ready!');
    console.log('Email:', testEmail);
    console.log('Password:', testPassword);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sql.end();
  }
}

createTestUser();
