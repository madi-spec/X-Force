import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, is_sellable, is_active')
    .order('name');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(JSON.stringify(data, null, 2));
}

main();
