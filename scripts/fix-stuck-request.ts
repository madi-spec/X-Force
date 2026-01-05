import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fix() {
  const { error } = await supabase
    .from('scheduling_requests')
    .update({ status: 'confirmed' })
    .eq('id', '8ffff46d-3eac-4f9b-9afc-0919179caa03');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Fixed! Status updated to confirmed');
  }
}

fix();
