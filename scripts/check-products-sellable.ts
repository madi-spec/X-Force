import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data: products, error } = await supabase
    .from('products')
    .select('name, slug, is_sellable, is_active')
    .is('parent_product_id', null)
    .order('display_order');

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('All products:');
  for (const p of products || []) {
    console.log(`  - ${p.name} | is_sellable: ${p.is_sellable} | is_active: ${p.is_active}`);
  }
}

check().catch(e => console.error(e));
