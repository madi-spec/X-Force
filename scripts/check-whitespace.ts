import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkWhitespace() {
  console.log('=== Whitespace Diagnostic ===\n');

  // 1. Check products table structure
  console.log('1. Checking products table...');
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, slug, base_price_monthly, is_sellable, is_active')
    .limit(20);

  if (productsError) {
    console.log('Products error:', productsError.message);
  } else {
    console.log(`Found ${products?.length || 0} products:`);
    products?.forEach(p => {
      console.log(`  - ${p.name} (${p.slug}): sellable=${p.is_sellable}, active=${p.is_active}, price=${p.base_price_monthly}`);
    });
  }

  // 2. Check for VFP/VFT products specifically
  console.log('\n2. Checking for VFP/VFT products...');
  const { data: vfpProducts } = await supabase
    .from('products')
    .select('id, name, slug')
    .or('slug.eq.vfp,slug.eq.vft');

  console.log('VFP/VFT products found:', vfpProducts?.length || 0);
  vfpProducts?.forEach(p => console.log(`  - ${p.name} (${p.slug})`));

  // 3. Check company_products with VFP
  console.log('\n3. Checking company_products with VFP/VFT...');
  const { data: vfpCompanyProducts, error: cpError } = await supabase
    .from('company_products')
    .select(`
      id,
      company_id,
      product_id,
      status,
      product:products(id, name, slug)
    `)
    .in('status', ['active', 'in_sales'])
    .limit(50);

  if (cpError) {
    console.log('Company products error:', cpError.message);
  } else {
    console.log(`Found ${vfpCompanyProducts?.length || 0} active company_products`);

    // Filter to VFP
    const vfpOnly = (vfpCompanyProducts || []).filter(cp => {
      const product = Array.isArray(cp.product) ? cp.product[0] : cp.product;
      return product && ['vfp', 'vft'].includes(product.slug);
    });
    console.log(`Of those, ${vfpOnly.length} are VFP/VFT`);

    // Show first few
    vfpOnly.slice(0, 5).forEach(cp => {
      const product = Array.isArray(cp.product) ? cp.product[0] : cp.product;
      console.log(`  - company_id: ${cp.company_id}, product: ${product?.slug}, status: ${cp.status}`);
    });
  }

  // 4. Check distinct statuses
  console.log('\n4. Checking distinct statuses in company_products...');
  const { data: statuses } = await supabase
    .from('company_products')
    .select('status')
    .limit(1000);

  const uniqueStatuses = [...new Set(statuses?.map(s => s.status) || [])];
  console.log('Unique statuses:', uniqueStatuses);

  // 5. Count total company_products
  console.log('\n5. Counting company_products by status...');
  for (const status of uniqueStatuses) {
    const { count } = await supabase
      .from('company_products')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);
    console.log(`  ${status}: ${count}`);
  }

  // 6. Check if is_sellable column exists
  console.log('\n6. Checking products with is_sellable = true...');
  const { data: sellableProducts, error: sellableError } = await supabase
    .from('products')
    .select('id, name, slug')
    .eq('is_sellable', true);

  if (sellableError) {
    console.log('Sellable query error:', sellableError.message);
    console.log('The is_sellable column may not exist!');
  } else {
    console.log(`Found ${sellableProducts?.length || 0} sellable products`);
  }

  // 7. Try query without is_sellable filter
  console.log('\n7. Products excluding VFP/VFT (without is_sellable filter)...');
  const { data: nonVfpProducts } = await supabase
    .from('products')
    .select('id, name, slug, base_price_monthly')
    .not('slug', 'in', '("vfp","vft")');

  console.log(`Found ${nonVfpProducts?.length || 0} non-VFP products:`);
  nonVfpProducts?.forEach(p => console.log(`  - ${p.name} (${p.slug}): $${p.base_price_monthly}`));
}

checkWhitespace().catch(console.error);
