import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const productId = '3a85b501-2f05-43f3-8d6f-7a2927375ddf';

  console.log('=== Testing Pipeline Query ===\n');

  // Test the exact query from the page (fixed - no city/state)
  const { data: pipeline, error } = await supabase
    .from('company_products')
    .select(`
      *,
      company:companies(id, name, domain),
      current_stage:product_process_stages(id, name, slug, stage_order),
      owner_user:users(id, name)
    `)
    .eq('product_id', productId)
    .eq('status', 'in_sales')
    .order('stage_entered_at', { ascending: true });

  if (error) {
    console.log('ERROR:', error.message);
    console.log('Details:', error.details);
    console.log('Hint:', error.hint);
  } else {
    console.log('Success! Count:', pipeline?.length);
  }
}

debug().then(() => process.exit(0));
