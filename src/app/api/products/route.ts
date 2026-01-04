import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  // Verify authentication
  const supabaseClient = await createClient();
  const { data: { user: authUser } } = await supabaseClient.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  // Get internal user ID from auth_id
  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const userId = dbUser.id;

  const includeModules = searchParams.get('include_modules') === 'true';
  const includeStats = searchParams.get('include_stats') === 'true';
  const sellableOnly = searchParams.get('sellable_only') === 'true';

  // Get main products (not modules)
  let query = supabase
    .from('products')
    .select(`
      *,
      tiers:product_tiers(*),
      processes:product_processes(
        id, process_type,
        stages:product_process_stages(*)
      )
    `)
    .is('parent_product_id', null)
    .eq('is_active', true)
    .order('display_order');

  if (sellableOnly) {
    query = query.eq('is_sellable', true);
  }

  const { data: products, error } = await query;

  if (error) {
    console.error('[Products API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get modules if requested
  if (includeModules) {
    const { data: modules } = await supabase
      .from('products')
      .select('*')
      .eq('product_type', 'module')
      .eq('is_active', true)
      .order('display_order');

    // Attach modules to parent products
    for (const product of products || []) {
      product.modules = (modules || []).filter(m => m.parent_product_id === product.id);
    }
  }

  // Get stats if requested (filtered to current user's company_products)
  if (includeStats) {
    for (const product of products || []) {
      const { data: stats } = await supabase
        .from('company_products')
        .select('status, mrr')
        .eq('product_id', product.id)
        .eq('owner_user_id', userId);

      const statusCounts = {
        active_count: 0,
        in_sales_count: 0,
        in_onboarding_count: 0,
        inactive_count: 0,
        declined_count: 0,
        churned_count: 0,
        total_mrr: 0,
      };

      for (const cp of stats || []) {
        if (cp.status === 'active') statusCounts.active_count++;
        else if (cp.status === 'in_sales') statusCounts.in_sales_count++;
        else if (cp.status === 'in_onboarding') statusCounts.in_onboarding_count++;
        else if (cp.status === 'inactive') statusCounts.inactive_count++;
        else if (cp.status === 'declined') statusCounts.declined_count++;
        else if (cp.status === 'churned') statusCounts.churned_count++;

        if (cp.mrr && cp.status === 'active') {
          statusCounts.total_mrr += parseFloat(String(cp.mrr));
        }
      }

      product.stats = statusCounts;

      // Extract sales stages from unified table
      const salesProcess = product.processes?.find((p: { process_type: string }) => p.process_type === 'sales');
      const stages = salesProcess?.stages || [];
      product.stages = stages.sort((a: { stage_order: number }, b: { stage_order: number }) => a.stage_order - b.stage_order);

      // Pipeline by stage (filtered to current user)
      if (stages.length > 0) {
        const { data: pipelineStats } = await supabase
          .from('company_products')
          .select('current_stage_id')
          .eq('product_id', product.id)
          .eq('owner_user_id', userId)
          .eq('status', 'in_sales');

        product.pipeline_by_stage = stages
          .sort((a: { stage_order: number }, b: { stage_order: number }) => a.stage_order - b.stage_order)
          .map((stage: { id: string; name: string }) => ({
            stage_id: stage.id,
            stage_name: stage.name,
            count: (pipelineStats || []).filter(ps => ps.current_stage_id === stage.id).length,
          }));
      }
    }
  }

  return NextResponse.json({ products });
}
