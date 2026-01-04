import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

interface DealPageProps {
  params: Promise<{ id: string }>;
}

/**
 * The /deals/[id] route now redirects to the company page as part of the
 * product-centric migration. The deal data is now managed through company_products.
 * Legacy deals are accessible via /legacy-deals.
 */
export default async function DealPage({ params }: DealPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // First check if this is a company_product ID (new system)
  const { data: companyProduct } = await supabase
    .from('company_products')
    .select('company_id')
    .eq('id', id)
    .single();

  if (companyProduct?.company_id) {
    redirect(`/companies/${companyProduct.company_id}`);
  }

  // If not, check if it's a legacy deal ID
  const { data: deal } = await supabase
    .from('deals')
    .select('company_id')
    .eq('id', id)
    .single();

  if (deal?.company_id) {
    redirect(`/companies/${deal.company_id}`);
  }

  // If deal not found or no company, redirect to products
  redirect('/products');
}
