import { createClient } from '@/lib/supabase/server';
import { CompanyList } from '@/components/companies/CompanyList';

export default async function CompaniesPage() {
  const supabase = await createClient();

  // Get companies with related data
  const { data: companies } = await supabase
    .from('companies')
    .select(`
      *,
      contacts:contacts(id, name, is_primary),
      deals:deals(id, name, stage, estimated_value)
    `)
    .order('name');

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
