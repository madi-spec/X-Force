import { createClient } from '@/lib/supabase/server';
import { ProcessStudio } from '@/components/process/ProcessStudio';

// Disable caching to ensure fresh data
export const dynamic = 'force-dynamic';

export default async function ProcessPage() {
  const supabase = await createClient();

  // Fetch all products with their processes
  // Match the same filters as the products page for consistency
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      slug,
      description,
      color,
      is_sellable,
      is_active,
      product_processes (
        id,
        name,
        process_type,
        version,
        status,
        product_process_stages (
          id,
          name,
          slug,
          stage_order,
          sla_days,
          is_terminal
        )
      )
    `)
    .is('parent_product_id', null)
    .eq('is_active', true)
    .eq('is_sellable', true)
    .order('name');

  // Debug logging
  console.log('[ProcessPage] Products fetched:', products?.length || 0, error ? `Error: ${error.message}` : '');

  // Show error if query failed
  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-normal text-gray-900 mb-4">Process Studio</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700">Error loading products: {error.message}</p>
        </div>
      </div>
    );
  }

  // Organize by process type
  const processTypes = ['sales', 'onboarding', 'support', 'engagement'];

  const playbooks = processTypes.map((type) => ({
    type,
    products: (products || []).map((product) => ({
      ...product,
      processes: (product.product_processes || []).filter(
        (p) => p.process_type === type && p.status === 'published'
      ),
    })).filter((p) => p.processes.length > 0),
  }));

  return <ProcessStudio playbooks={playbooks} allProducts={products || []} />;
}
