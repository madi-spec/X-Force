import { createClient } from '@/lib/supabase/server';
import { CompanyList } from '@/components/companies/CompanyList';

// Helper to fetch all records using pagination (Supabase has 1000 row server limit)
async function fetchAllCompanies(supabase: Awaited<ReturnType<typeof createClient>>) {
  const PAGE_SIZE = 1000;
  let allCompanies: NonNullable<typeof firstPage> = [];
  let page = 0;
  let hasMore = true;

  // First page
  const { data: firstPage, error: firstError } = await supabase
    .from('companies')
    .select(`
      *,
      contacts:contacts(id, name, is_primary),
      deals:deals(id, name, stage, estimated_value)
    `)
    .order('name')
    .range(0, PAGE_SIZE - 1);

  if (firstError) {
    console.error('[CompaniesPage] Error fetching first page:', firstError.message);
    return firstPage || [];
  }

  allCompanies = firstPage || [];
  hasMore = (firstPage?.length || 0) === PAGE_SIZE;
  page = 1;

  // Fetch remaining pages
  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: pageData, error: pageError } = await supabase
      .from('companies')
      .select(`
        *,
        contacts:contacts(id, name, is_primary),
        deals:deals(id, name, stage, estimated_value)
      `)
      .order('name')
      .range(from, to);

    if (pageError) {
      console.error('[CompaniesPage] Error fetching page', page, pageError.message);
      break;
    }

    if (pageData && pageData.length > 0) {
      allCompanies = [...allCompanies, ...pageData];
      hasMore = pageData.length === PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log('[CompaniesPage] Total companies fetched:', allCompanies.length);
  return allCompanies;
}

export default async function CompaniesPage() {
  const supabase = await createClient();

  // Get companies with related data using pagination
  const companies = await fetchAllCompanies(supabase);

  // Get company products for each company
  const { data: companyProducts } = await supabase
    .from('company_products')
    .select(`
      company_id,
      product:products(id, name, category_id)
    `)
    .eq('status', 'active');

  // Merge products into companies
  const companiesWithProducts = companies?.map(company => ({
    ...company,
    products: companyProducts?.filter(cp => cp.company_id === company.id).map(cp => cp.product) || []
  })) || [];

  return <CompanyList companies={companiesWithProducts} />;
}
