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
    .select('*, owner:users!deals_owner_id_fkey(id, name, email)')
    .eq('company_id', id)
    .order('created_at', { ascending: false });

  // Get activities for this company (directly linked or through deals)
  const dealIds = deals?.map(d => d.id) || [];

  // Get activities directly linked to company
  const { data: companyActivities } = await supabase
    .from('activities')
    .select('*, user:users(name), deal:deals(id, name), contact:contacts(id, name)')
    .eq('company_id', id)
    .order('occurred_at', { ascending: false })
    .limit(20);

  // Get activities through deals (if any deals exist)
  const { data: dealActivities } = dealIds.length > 0
    ? await supabase
        .from('activities')
        .select('*, user:users(name), deal:deals(id, name), contact:contacts(id, name)')
        .in('deal_id', dealIds)
        .is('company_id', null) // Only get ones not already linked to company
        .order('occurred_at', { ascending: false })
        .limit(20)
    : { data: [] };

  // Combine and deduplicate activities
  const allActivities = [...(companyActivities || []), ...(dealActivities || [])];
  const uniqueActivityIds = new Set<string>();
  const activities = allActivities
    .filter(a => {
      if (uniqueActivityIds.has(a.id)) return false;
      uniqueActivityIds.add(a.id);
      return true;
    })
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 20);

  // Get company products with new product-centric model
  const { data: companyProducts } = await supabase
    .from('company_products')
    .select(`
      *,
      product:products(
        id, name, slug, description, product_type, icon, color,
        base_price_monthly, pricing_model, is_sellable, parent_product_id
      ),
      tier:product_tiers(id, name, slug, price_monthly),
      current_stage:product_sales_stages(id, name, slug, stage_order),
      owner:users(id, name)
    `)
    .eq('company_id', id)
    .order('created_at', { ascending: false });

  // Get all sellable products for reference (suites and addons, not modules)
  const { data: allProducts } = await supabase
    .from('products')
    .select(`
      *,
      tiers:product_tiers(id, name, slug, price_monthly, display_order)
    `)
    .eq('is_active', true)
    .eq('is_sellable', true)
    .in('product_type', ['suite', 'addon'])
    .order('display_order');

  // Product categories are no longer needed with the new model
  const productCategories: any[] = [];

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

  // Get deal collaborators for active deals - explicitly specify the foreign key since there are two (user_id and added_by)
  const activeDealIds = deals?.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).map(d => d.id) || [];
  const { data: collaborators } = activeDealIds.length > 0
    ? await supabase
        .from('deal_collaborators')
        .select('*, user:users!deal_collaborators_user_id_fkey(id, name, email), deal:deals(id, name)')
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
