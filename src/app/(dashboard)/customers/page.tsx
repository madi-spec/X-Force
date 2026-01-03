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
  owner_user_id: string | null;
  product: { id: string; name: string; slug: string } | null;
  owner_user: { id: string; name: string } | null;
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
  customer_type: string | null;
  created_at: string;
  vfp_support_contact: string | null;
  company_products: CompanyProduct[];
}

interface Stats {
  total: number;
  active: number;
  churned: number;
  total_mrr: number;
}

// Raw company type from Supabase query
interface RawCompanyProduct {
  id: string;
  product_id: string;
  status: string;
  mrr: number | null;
  tier_id: string | null;
  owner_user_id: string | null;
  product: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
  owner_user: { id: string; name: string } | { id: string; name: string }[] | null;
}

interface RawCompany {
  id: string;
  name: string;
  domain: string | null;
  customer_type: string | null;
  created_at: string;
  vfp_support_contact: string | null;
  company_products: RawCompanyProduct[];
}

// Helper to fetch all records using pagination (Supabase has 1000 row server limit)
async function fetchAllCompanies(supabase: Awaited<ReturnType<typeof createClient>>) {
  const PAGE_SIZE = 1000;
  let allCompanies: RawCompany[] = [];
  let page = 0;
  let hasMore = true;

  // First page to get the shape
  const { data: firstPage, error: firstError } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      domain,
      customer_type,
      created_at,
      vfp_support_contact,
      company_products (
        id,
        product_id,
        status,
        mrr,
        tier_id,
        owner_user_id,
        product:products(id, name, slug),
        owner_user:users!company_products_owner_user_id_fkey(id, name)
      )
    `)
    .order('name', { ascending: true })
    .range(0, PAGE_SIZE - 1);

  if (firstError) {
    return { data: null, error: firstError };
  }

  allCompanies = (firstPage || []) as RawCompany[];
  hasMore = (firstPage?.length || 0) === PAGE_SIZE;
  page = 1;

  // Fetch remaining pages
  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: pageData, error: pageError } = await supabase
      .from('companies')
      .select(`
        id,
        name,
        domain,
        customer_type,
        created_at,
        vfp_support_contact,
        company_products (
          id,
          product_id,
          status,
          mrr,
          tier_id,
          owner_user_id,
          product:products(id, name, slug),
          owner_user:users!company_products_owner_user_id_fkey(id, name)
        )
      `)
      .order('name', { ascending: true })
      .range(from, to);

    if (pageError) {
      console.error('[CustomersPage] Error fetching page', page, pageError.message);
      break;
    }

    if (pageData && pageData.length > 0) {
      allCompanies = [...allCompanies, ...(pageData as RawCompany[])];
      hasMore = pageData.length === PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }

  return { data: allCompanies, error: null };
}

export default async function CustomersPage() {
  const supabase = await createClient();

  // Fetch all companies using pagination to bypass Supabase's 1000 row limit
  const { data: companiesRaw, error: companiesError } = await fetchAllCompanies(supabase);

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

  // Transform the data to match expected types (product/owner relations may return arrays)
  const companies: Company[] = (companiesRaw || []).map((company) => ({
    ...company,
    company_products: (company.company_products || []).map((cp: RawCompanyProduct) => ({
      ...cp,
      product: Array.isArray(cp.product) ? cp.product[0] || null : cp.product,
      owner_user: Array.isArray(cp.owner_user) ? cp.owner_user[0] || null : cp.owner_user,
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
