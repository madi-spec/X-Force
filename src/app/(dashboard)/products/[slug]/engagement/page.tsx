import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EngagementBoard } from '@/components/engagement';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EngagementPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch product with its engagement process stages
  const { data: product, error: productError } = await supabase
    .from('products')
    .select(`
      id,
      name,
      slug
    `)
    .eq('slug', slug)
    .single();

  if (productError || !product) {
    notFound();
  }

  // Fetch the engagement process for this product
  const { data: processes } = await supabase
    .from('product_processes')
    .select('id')
    .eq('product_id', product.id)
    .eq('process_type', 'engagement')
    .eq('is_active', true)
    .single();

  if (!processes) {
    // No engagement process defined for this product
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-gray-500">No engagement process defined for {product.name}</p>
        <p className="text-sm text-gray-400 mt-1">Configure an engagement process in product settings</p>
      </div>
    );
  }

  // Fetch stages for the engagement process
  const { data: stages } = await supabase
    .from('product_process_stages')
    .select('id, name, slug, stage_order, is_terminal')
    .eq('process_id', processes.id)
    .eq('is_active', true)
    .order('stage_order', { ascending: true });

  // Fetch company products for this product with their engagement state
  const { data: companyProducts } = await supabase
    .from('company_product_read_model')
    .select(`
      company_product_id,
      company_id,
      product_id,
      current_process_type,
      current_process_id,
      current_stage_id,
      current_stage_name,
      current_stage_slug,
      health_score,
      risk_level,
      tier,
      mrr,
      is_sla_breached,
      is_sla_warning,
      days_in_current_stage,
      owner_name
    `)
    .eq('product_id', product.id)
    .eq('current_process_type', 'engagement');

  // Fetch company names for the products
  const companyIds = [...new Set(companyProducts?.map((cp) => cp.company_id) || [])];
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .in('id', companyIds);

  const companyMap = new Map(companies?.map((c) => [c.id, c]));

  // Merge company data into products
  const productsWithCompany = (companyProducts || []).map((cp) => ({
    ...cp,
    company: companyMap.get(cp.company_id) || null,
  }));

  // Fetch open case counts for these company products
  const companyProductIds = companyProducts?.map((cp) => cp.company_product_id) || [];
  const { data: caseCounts } = await supabase
    .from('company_product_open_case_counts')
    .select(`
      company_product_id,
      total_open_count,
      urgent_count,
      critical_count,
      any_breached_count
    `)
    .in('company_product_id', companyProductIds);

  return (
    <EngagementBoard
      companyProducts={productsWithCompany}
      stages={stages || []}
      caseCounts={caseCounts || []}
      productName={product.name}
    />
  );
}
