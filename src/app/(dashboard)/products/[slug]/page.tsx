import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ProductHeader } from '@/components/products/ProductHeader';
import { ProductPipeline } from '@/components/products/ProductPipeline';
import { ProductCustomers } from '@/components/products/ProductCustomers';
import { ProductStats } from '@/components/products/ProductStats';

type ViewType = 'pipeline' | 'in_sales' | 'active' | 'in_onboarding' | 'inactive' | 'customers';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function ProductDetailPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const { slug } = await params;
  const rawView = (await searchParams).view || 'pipeline';
  // Normalize view - 'customers' is alias for 'active', 'pipeline' is alias for 'in_sales'
  const view: ViewType = rawView === 'customers' ? 'active' : rawView as ViewType;

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

  // Get onboarding customers
  const { data: onboardingCustomers } = await supabase
    .from('company_products')
    .select(`
      *,
      company:companies(id, name, domain),
      tier:product_tiers(id, name)
    `)
    .eq('product_id', product.id)
    .eq('status', 'in_onboarding')
    .order('onboarding_started_at', { ascending: false });

  // Get VFP customers who don't have this product (inactive/potential)
  const { data: allVfpCompanies } = await supabase
    .from('companies')
    .select('id, name, domain')
    .eq('customer_type', 'vfp_customer');

  // Get all company_ids that have this product in any status
  const companiesWithProduct = new Set([
    ...(pipeline || []).map((p: { company_id: string }) => p.company_id),
    ...(activeCustomers || []).map((c: { company_id: string }) => c.company_id),
    ...(onboardingCustomers || []).map((c: { company_id: string }) => c.company_id),
  ]);

  // Inactive = VFP customers without this product
  const inactiveCompanies = (allVfpCompanies || []).filter(
    (company: { id: string }) => !companiesWithProduct.has(company.id)
  );

  // Get stats
  const stats = {
    active: activeCustomers?.length || 0,
    in_sales: pipeline?.length || 0,
    in_onboarding: onboardingCustomers?.length || 0,
    inactive: inactiveCompanies.length,
    total_mrr: activeCustomers?.reduce((sum, c) => sum + (parseFloat(c.mrr) || 0), 0) || 0,
  };

  // Group pipeline by stage
  const pipelineByStage = stages.map((stage: { id: string; name: string; slug: string; stage_order: number; goal?: string }) => ({
    ...stage,
    companies: (pipeline || []).filter((p: { current_stage_id: string }) => p.current_stage_id === stage.id),
  }));

  // Determine which list to show based on view
  const getViewContent = () => {
    switch (view) {
      case 'pipeline':
      case 'in_sales':
        return (
          <ProductPipeline
            product={product}
            stages={pipelineByStage}
          />
        );
      case 'active':
        return (
          <ProductCustomers
            product={product}
            customers={activeCustomers || []}
            title="Active Customers"
            emptyMessage="No active customers yet"
          />
        );
      case 'in_onboarding':
        return (
          <ProductCustomers
            product={product}
            customers={onboardingCustomers || []}
            title="Customers in Onboarding"
            emptyMessage="No customers currently onboarding"
          />
        );
      case 'inactive':
        return (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-medium text-gray-900">Inactive Customers</h3>
              <p className="text-sm text-gray-500">VFP customers who don&apos;t have this product yet</p>
            </div>
            {inactiveCompanies.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                All VFP customers have this product
              </div>
            ) : (
              <div className="divide-y">
                {inactiveCompanies.map((company: { id: string; name: string; domain: string | null }) => (
                  <a
                    key={company.id}
                    href={`/companies/${company.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{company.name}</div>
                      {company.domain && (
                        <div className="text-sm text-gray-500">{company.domain}</div>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                      No {product.name}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <ProductHeader product={product} />

      <ProductStats stats={stats} />

      {/* View Toggle */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <a
          href={`/products/${slug}?view=in_sales`}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'pipeline' || view === 'in_sales'
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          In Sales ({stats.in_sales})
        </a>
        <a
          href={`/products/${slug}?view=in_onboarding`}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'in_onboarding'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Onboarding ({stats.in_onboarding})
        </a>
        <a
          href={`/products/${slug}?view=active`}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'active'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Active ({stats.active})
        </a>
        <a
          href={`/products/${slug}?view=inactive`}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'inactive'
              ? 'bg-gray-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Inactive ({stats.inactive})
        </a>
      </div>

      {getViewContent()}
    </div>
  );
}
