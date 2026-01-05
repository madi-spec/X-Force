import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProducts() {
  console.log('=== Product Diagnostic ===\n');

  // Get all products with all columns
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .limit(20);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log(`Found ${products?.length || 0} products\n`);

  if (products && products.length > 0) {
    console.log('Columns available:', Object.keys(products[0]));
    console.log('\nProducts:');
    products.forEach(p => {
      console.log(`  - ${p.name}`);
      console.log(`    slug: ${p.slug}`);
      console.log(`    is_sellable: ${p.is_sellable}`);
      console.log(`    is_active: ${p.is_active}`);
      console.log(`    all fields:`, JSON.stringify(p, null, 2));
      console.log('');
    });
  }
}

checkProducts().catch(console.error);
