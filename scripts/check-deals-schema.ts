import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('deals').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  console.log('Deals columns:', data ? Object.keys(data[0]) : []);

  // Also count total deals to migrate
  const { count } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .not('stage', 'in', '(closed_won,closed_lost)');

  console.log('Open deals count:', count);
}

run().then(() => process.exit(0));
