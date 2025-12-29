import { createClient } from '@/lib/supabase/server';
import { CustomerDirectory } from '@/components/customers/CustomerDirectory';

// Disable caching to ensure fresh data
export const dynamic = 'force-dynamic';

interface CompanyProduct {
  id: string;
  product_id: string;
  status: string;
  mrr: number | null;
  tier_id: string | null;
  product: { id: string; name: string; slug: string } | null;
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
  customer_type: string | null;
  created_at: string;
  company_products: CompanyProduct[];
}

interface Stats {
  total: number;
  active: number;
  churned: number;
  total_mrr: number;
}

export default async function CustomersPage() {
  const supabase = await createClient();

  // Fetch companies with their products and health data
  // Note: Supabase defaults to 1000 rows, so we explicitly set a higher limit
  const { data: companiesRaw, error: companiesError } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      domain,
      customer_type,
      created_at,
      company_products (
        id,
        product_id,
        status,
        mrr,
        tier_id,
        product:products(id, name, slug)
      )
    `)
    .order('name', { ascending: true })
    .limit(5000);

  // Debug logging
  console.log('[CustomersPage] Companies fetched:', companiesRaw?.length || 0, companiesError ? `Error: ${companiesError.message}` : '');

  // Show error if query failed
  if (companiesError) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-normal text-gray-900 mb-4">Customers</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700">Error loading customers: {companiesError.message}</p>
        </div>
      </div>
    );
  }

  // Transform the data to match expected types (product relation returns array)
  const companies: Company[] = (companiesRaw || []).map((company) => ({
    ...company,
    company_products: (company.company_products || []).map((cp: Record<string, unknown>) => ({
      ...cp,
      product: Array.isArray(cp.product) ? cp.product[0] || null : cp.product,
    })),
  })) as Company[];

  // Fetch products for filtering
  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug')
    .eq('is_sellable', true)
    .order('name');

  // Fetch aggregate stats - fallback to computed if RPC doesn't exist
  let stats: Stats = { total: 0, active: 0, churned: 0, total_mrr: 0 };
  try {
    const { data: rpcStats } = await supabase.rpc('get_customer_stats').single();
    if (rpcStats) {
      stats = rpcStats as Stats;
    }
  } catch {
    // RPC may not exist, compute from data
    const allProducts = companies.flatMap((c) => c.company_products);
    stats = {
      total: companies.length,
      active: allProducts.filter((cp) => cp.status === 'active').length,
      churned: allProducts.filter((cp) => cp.status === 'churned').length,
      total_mrr: allProducts.reduce((sum, cp) => sum + (cp.mrr || 0), 0),
    };
  }

  return (
    <CustomerDirectory
      companies={companies}
      products={products || []}
      stats={stats}
    />
  );
}
