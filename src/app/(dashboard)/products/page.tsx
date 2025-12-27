import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/products/ProductCard';
import { Package } from 'lucide-react';
import type { ProductCardData } from '@/types/products';

export default async function ProductsPage() {
  const supabase = await createClient();

  // Get products with stats (include legacy products for visibility)
  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      stages:product_sales_stages(id, name, stage_order)
    `)
    .is('parent_product_id', null)
    .eq('is_active', true)
    .order('display_order');

  // Get stats for each product
  const productsWithStats: ProductCardData[] = await Promise.all(
    (products || []).map(async (product) => {
      const { data: companyProducts } = await supabase
        .from('company_products')
        .select('status, mrr, current_stage_id')
        .eq('product_id', product.id);

      const stats = {
        active: 0,
        in_sales: 0,
        in_onboarding: 0,
        inactive: 0,
        total_mrr: 0,
      };

      const pipelineByStage: Record<string, number> = {};

      for (const cp of companyProducts || []) {
        if (cp.status === 'active') {
          stats.active++;
          if (cp.mrr) stats.total_mrr += parseFloat(String(cp.mrr));
        }
        else if (cp.status === 'in_sales') {
          stats.in_sales++;
          if (cp.current_stage_id) {
            pipelineByStage[cp.current_stage_id] = (pipelineByStage[cp.current_stage_id] || 0) + 1;
          }
        }
        else if (cp.status === 'in_onboarding') stats.in_onboarding++;
      }

      // Get inactive count (VFP customers without this product active)
      const { count: vfpCount } = await supabase
        .from('companies')
        .select('id', { count: 'exact' })
        .eq('customer_type', 'vfp_customer');

      stats.inactive = Math.max(0, (vfpCount || 0) - stats.active - stats.in_sales - stats.in_onboarding);

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        icon: product.icon,
        color: product.color,
        is_sellable: product.is_sellable,
        stages: product.stages || [],
        stats,
        pipelineByStage,
      };
    })
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-normal text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">Manage your product catalog and sales pipelines</p>
        </div>
      </div>

      {/* Products Grid */}
      <div className="space-y-6">
        {productsWithStats.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No products found</p>
            <p className="text-sm text-gray-400 mt-1">Run the database migration to seed products</p>
          </div>
        ) : (
          productsWithStats.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        )}
      </div>
    </div>
  );
}
