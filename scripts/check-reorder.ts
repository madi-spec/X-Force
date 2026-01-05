import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, display_order, is_sellable, is_active')
    .is('parent_product_id', null)
    .eq('is_active', true)
    .eq('is_sellable', true)
    .order('display_order', { ascending: true });

  console.log('Products found:', data?.length);
  data?.forEach(p => console.log(` - ${p.name} | order: ${p.display_order} | sellable: ${p.is_sellable}`));
  if (error) console.log('Error:', error.message);
}

check();
