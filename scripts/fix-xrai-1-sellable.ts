import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Marking X-RAI 1.0 as not sellable (legacy product)...');

  // Mark X-RAI 1.0 as not sellable (legacy product)
  const { data, error } = await supabase
    .from('products')
    .update({ is_sellable: false })
    .eq('slug', 'xrai-1')
    .select('name, slug, is_sellable');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Updated:', data);

  // Verify the change
  const { data: verify } = await supabase
    .from('products')
    .select('name, is_sellable')
    .eq('slug', 'xrai-1')
    .single();

  console.log('Verification:', verify);
}

main().catch(console.error);
