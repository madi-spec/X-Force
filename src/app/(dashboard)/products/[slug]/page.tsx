import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ProductHeader } from '@/components/products/ProductHeader';
import { ProductPipeline } from '@/components/products/ProductPipeline';
import { ProductCustomers } from '@/components/products/ProductCustomers';
import { ProductStats } from '@/components/products/ProductStats';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const { slug } = await params;
  const { view = 'pipeline' } = await searchParams;

  // Get product with stages
  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      stages:product_sales_stages(*),
      tiers:product_tiers(*),
      modules:products!parent_product_id(*)
    `)
    .eq('slug', slug)
    .single();

  if (error || !product) {
    notFound();
  }

  // Sort stages by order
  const stages = (product.stages || []).sort((a: { stage_order: number }, b: { stage_order: number }) => a.stage_order - b.stage_order);

  // Get pipeline (companies in sales)
  const { data: pipeline } = await supabase
    .from('company_products')
    .select(`
      *,
      company:companies(id, name, domain, city, state),
      current_stage:product_sales_stages(id, name, slug, stage_order),
      owner:users(id, name)
    `)
    .eq('product_id', product.id)
    .eq('status', 'in_sales')
    .order('stage_entered_at', { ascending: true });

  // Get active customers
  const { data: activeCustomers } = await supabase
    .from('company_products')
    .select(`
      *,
      company:companies(id, name, domain),
      tier:product_tiers(id, name)
    `)
    .eq('product_id', product.id)
    .eq('status', 'active')
    .order('activated_at', { ascending: false });

  // Get stats
  const stats = {
    active: activeCustomers?.length || 0,
    in_sales: pipeline?.length || 0,
    total_mrr: activeCustomers?.reduce((sum, c) => sum + (parseFloat(c.mrr) || 0), 0) || 0,
  };

  // Group pipeline by stage
  const pipelineByStage = stages.map((stage: { id: string; name: string; slug: string; stage_order: number; goal?: string }) => ({
    ...stage,
    companies: (pipeline || []).filter((p: { current_stage_id: string }) => p.current_stage_id === stage.id),
  }));

  return (
    <div className="p-6">
      <ProductHeader product={product} />

      <ProductStats stats={stats} />

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <a
          href={`/products/${slug}?view=pipeline`}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'pipeline'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Pipeline ({stats.in_sales})
        </a>
        <a
          href={`/products/${slug}?view=customers`}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'customers'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Active Customers ({stats.active})
        </a>
      </div>

      {view === 'pipeline' ? (
        <ProductPipeline
          product={product}
          stages={pipelineByStage}
        />
      ) : (
        <ProductCustomers
          product={product}
          customers={activeCustomers || []}
        />
      )}
    </div>
  );
}
