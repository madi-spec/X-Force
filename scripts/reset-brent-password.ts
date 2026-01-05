import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Resetting password for xraisales@affiliatedtech.com...');

  const { data, error } = await supabase.auth.admin.updateUserById(
    '51c8f003-710b-4071-b3a4-d9cd141b1296',
    { password: 'TestPassword2025!' }
  );

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Password reset successfully');
    console.log('Email: xraisales@affiliatedtech.com');
    console.log('Password: TestPassword2025!');
  }
}

main();
