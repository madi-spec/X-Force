import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fix() {
  const { error } = await supabase
    .from('products')
    .update({ icon: '🔄' })
    .eq('slug', 'xrai-migration');

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Icon updated to 🔄');
  }
}

fix();
