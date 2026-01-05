import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProducts() {
  console.log('=== Checking Products ===\n');

  // 1. All products
  const { data: allProducts, error: e1 } = await supabase
    .from('products')
    .select('id, name, slug, is_active, is_sellable, parent_product_id')
    .order('name');

  console.log('All products in database:');
  console.table(allProducts?.map(p => ({
    name: p.name,
    is_active: p.is_active,
    is_sellable: p.is_sellable,
    has_parent: !!p.parent_product_id
  })));

  // 2. Products page query
  const { data: productsPageData, error: e2 } = await supabase
    .from('products')
    .select('id, name, slug')
    .is('parent_product_id', null)
    .eq('is_active', true)
    .eq('is_sellable', true);

  console.log('\nProducts page query (parent=null, active=true, sellable=true):');
  console.log('Count:', productsPageData?.length || 0);
  productsPageData?.forEach(p => console.log(' -', p.name));

  // 3. Process studio query (current)
  const { data: processStudioData, error: e3 } = await supabase
    .from('products')
    .select('id, name, slug')
    .is('parent_product_id', null)
    .eq('is_active', true)
    .eq('is_sellable', true);

  console.log('\nProcess Studio query (same as above):');
  console.log('Count:', processStudioData?.length || 0);
  processStudioData?.forEach(p => console.log(' -', p.name));

  // 4. Just sellable products (original query)
  const { data: sellableOnly, error: e4 } = await supabase
    .from('products')
    .select('id, name, slug')
    .eq('is_sellable', true);

  console.log('\nSellable only (original Process Studio query):');
  console.log('Count:', sellableOnly?.length || 0);
  sellableOnly?.forEach(p => console.log(' -', p.name));

  // 5. Check product_processes table
  const { data: processes, error: e5 } = await supabase
    .from('product_processes')
    .select('id, product_id, name, process_type, status');

  console.log('\nProduct processes:');
  console.log('Count:', processes?.length || 0);
  processes?.forEach(p => console.log(' -', p.name, `(${p.process_type}, ${p.status})`));

  if (e1 || e2 || e3 || e4 || e5) {
    console.log('\nErrors:', { e1, e2, e3, e4, e5 });
  }
}

checkProducts().catch(console.error);
