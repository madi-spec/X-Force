import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CompanyDetail } from '@/components/companies/CompanyDetail';

interface CompanyPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Get company
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !company) {
    notFound();
  }

  // Get contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', id)
    .order('is_primary', { ascending: false })
    .order('name');

  // Get all deals (open and closed)
  const { data: deals } = await supabase
    .from('deals')
    .select('*, owner:users(id, name, email)')
    .eq('company_id', id)
    .order('created_at', { ascending: false });

  // Get activities for this company (through deals)
  const dealIds = deals?.map(d => d.id) || [];
  const { data: activities } = dealIds.length > 0
    ? await supabase
        .from('activities')
        .select('*, user:users(name), deal:deals(id, name)')
        .in('deal_id', dealIds)
        .order('occurred_at', { ascending: false })
        .limit(20)
    : { data: [] };

  // Get company products
  const { data: companyProducts } = await supabase
    .from('company_products')
    .select(`
      *,
      product:products(id, name, slug, base_price, pricing_model, category:product_categories(id, name, slug))
    `)
    .eq('company_id', id);

  // Get all products for reference (for showing what's not sold yet)
  const { data: allProducts } = await supabase
    .from('products')
    .select(`
      *,
      category:product_categories(id, name, slug)
    `)
    .order('category_id')
    .order('name');

  // Get product categories
  const { data: productCategories } = await supabase
    .from('product_categories')
    .select('*')
    .order('name');

  // Get company watchers
  const { data: watchers } = await supabase
    .from('company_watchers')
    .select('*, user:users(id, name, email)')
    .eq('company_id', id);

  // Get company signals
  const { data: signals } = await supabase
    .from('company_signals')
    .select('*, product:products(id, name)')
    .eq('company_id', id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  // Get deal collaborators for active deals
  const activeDealIds = deals?.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).map(d => d.id) || [];
  const { data: collaborators } = activeDealIds.length > 0
    ? await supabase
        .from('deal_collaborators')
        .select('*, user:users(id, name, email), deal:deals(id, name)')
        .in('deal_id', activeDealIds)
    : { data: [] };

  return (
    <CompanyDetail
      company={company}
      contacts={contacts || []}
      deals={deals || []}
      activities={activities || []}
      companyProducts={companyProducts || []}
      allProducts={allProducts || []}
      productCategories={productCategories || []}
      watchers={watchers || []}
      signals={signals || []}
      collaborators={collaborators || []}
    />
  );
}
