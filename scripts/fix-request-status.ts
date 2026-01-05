import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fix() {
  console.log('Starting update...');

  const { data, error } = await supabase
    .from('scheduling_requests')
    .update({
      status: 'confirmed',
      scheduled_time: '2026-01-05T16:00:00.000Z'
    })
    .eq('id', 'e47e3443-914b-4f3d-818a-8a03f508dae6')
    .select();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Updated:', data);
  }
}

fix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
