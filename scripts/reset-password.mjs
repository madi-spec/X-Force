import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: user } = await supabase
  .from('users')
  .select('auth_id, email')
  .eq('email', 'xraisales@affiliatedtech.com')
  .single();

console.log('User:', user);

if (user && user.auth_id) {
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.auth_id,
    { password: 'Ergemedi25!' }
  );
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Password updated successfully!');
  }
} else {
  console.log('No auth_id found for user');
}
