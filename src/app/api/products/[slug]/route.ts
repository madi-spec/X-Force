import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
  const { slug } = await params;

  // Get product with all related data
  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      tiers:product_tiers(*),
      processes:product_processes(
        id, process_type,
        stages:product_process_stages(*)
      ),
      modules:products!parent_product_id(*)
    `)
    .eq('slug', slug)
    .single();

  if (error || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Extract and sort sales stages from unified table
  const salesProcess = product.processes?.find((p: { process_type: string }) => p.process_type === 'sales');
  product.stages = (salesProcess?.stages || [])
    .sort((a: { stage_order: number }, b: { stage_order: number }) => a.stage_order - b.stage_order);

  // Get pipeline (companies in sales for this product)
  const { data: pipeline } = await supabase
    .from('company_products')
    .select(`
      *,
      company:companies(id, name, domain),
      current_stage:product_process_stages(id, name, slug, stage_order),
      owner_user:users(id, name)
    `)
    .eq('product_id', product.id)
    .eq('status', 'in_sales')
    .order('stage_entered_at', { ascending: true });

  // Get active customers
  const { data: activeCustomers } = await supabase
    .from('company_products')
    .select(`
      *,
      company:companies(id, name),
      tier:product_tiers(id, name)
    `)
    .eq('product_id', product.id)
    .eq('status', 'active')
    .order('activated_at', { ascending: false })
    .limit(10);

  // Get stats
  const { data: allCompanyProducts } = await supabase
    .from('company_products')
    .select('status, mrr')
    .eq('product_id', product.id);

  const stats = {
    active: 0,
    in_sales: 0,
    in_onboarding: 0,
    declined: 0,
    churned: 0,
    total_mrr: 0,
  };

  for (const cp of allCompanyProducts || []) {
    if (cp.status === 'active') {
      stats.active++;
      if (cp.mrr) stats.total_mrr += parseFloat(String(cp.mrr));
    }
    else if (cp.status === 'in_sales') stats.in_sales++;
    else if (cp.status === 'in_onboarding') stats.in_onboarding++;
    else if (cp.status === 'declined') stats.declined++;
    else if (cp.status === 'churned') stats.churned++;
  }

  return NextResponse.json({
    product,
    pipeline,
    activeCustomers,
    stats,
  });
}
