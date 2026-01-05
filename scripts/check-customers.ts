import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCustomers() {
  console.log('=== Checking Customers ===\n');

  // 1. All companies
  const { data: companies, error: e1 } = await supabase
    .from('companies')
    .select('id, name, customer_type, created_at')
    .order('name')
    .limit(20);

  console.log('Companies in database (first 20):');
  console.log('Count:', companies?.length || 0);
  if (e1) console.log('Error:', e1.message);
  companies?.forEach(c => console.log(' -', c.name, `(${c.customer_type || 'no type'})`));

  // 2. Total count
  const { count } = await supabase
    .from('companies')
    .select('id', { count: 'exact', head: true });

  console.log('\nTotal companies:', count);

  // 3. Companies with active products
  const { data: withProducts, error: e2 } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      company_products (
        id,
        status,
        product:products(name)
      )
    `)
    .limit(10);

  console.log('\nCompanies with products (first 10):');
  withProducts?.forEach(c => {
    const products = (c.company_products || []).map((cp: any) =>
      `${cp.product?.name || 'unknown'} (${cp.status})`
    ).join(', ');
    console.log(' -', c.name, ':', products || 'no products');
  });

  // 4. Check RPC
  try {
    const { data: rpcStats, error: rpcError } = await supabase.rpc('get_customer_stats');
    console.log('\nRPC get_customer_stats:', rpcStats || rpcError?.message);
  } catch (err) {
    console.log('\nRPC get_customer_stats: not available');
  }
}

checkCustomers().catch(console.error);
