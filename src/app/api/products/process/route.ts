import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProcessType, ProcessStats, PipelineItem, HealthStatus } from '@/types/products';

function computeHealthStatus(
  lastActivityAt: string | null,
  lastHumanTouchAt: string | null,
  lastStageMoved: string | null,
  stageEnteredAt: string | null,
  createdAt: string
): { status: HealthStatus; reason: string | null; daysInStage: number } {
  const now = new Date();

  const activityDate = lastActivityAt || lastHumanTouchAt || createdAt;
  const stageDate = lastStageMoved || stageEnteredAt || createdAt;

  const daysSinceActivity = Math.floor((now.getTime() - new Date(activityDate).getTime()) / (1000 * 60 * 60 * 24));
  const daysInStage = Math.floor((now.getTime() - new Date(stageDate).getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceActivity > 14) {
    return { status: 'attention', reason: `No activity ${daysSinceActivity}d`, daysInStage };
  }
  if (daysInStage >= 30) {
    return { status: 'stalled', reason: `Stalled ${daysInStage}d`, daysInStage };
  }
  return { status: 'healthy', reason: null, daysInStage };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const process = (searchParams.get('process') || 'sales') as ProcessType;
  const products = searchParams.get('products')?.split(',').filter(Boolean) || [];
  const users = searchParams.get('users')?.split(',').filter(Boolean) || [];
  const health = searchParams.get('health') || 'all';
  const search = searchParams.get('search') || '';

  try {
    const statusMap: Record<ProcessType, string[]> = {
      sales: ['in_sales'],
      onboarding: ['in_onboarding'],
      customer_service: ['active'],
      engagement: ['active'],
    };

    const statuses = statusMap[process] || ['in_sales'];

    // First, get valid product IDs (sellable, top-level products only)
    const { data: validProducts } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true)
      .eq('is_sellable', true)
      .is('parent_product_id', null);

    const validProductIds = (validProducts || []).map(p => p.id);

    // If no valid products, return empty
    if (validProductIds.length === 0) {
      return NextResponse.json({ items: [], stats: { total: 0, needsAttention: 0, stalled: 0, healthy: 0, totalMrr: 0, productCount: 0 }, stages: [] });
    }

    // Query company_products with joins - filtered to valid products only
    let query = supabase
      .from('company_products')
      .select(`
        id,
        company_id,
        product_id,
        status,
        current_stage_id,
        owner_user_id,
        mrr,
        created_at,
        updated_at,
        last_activity_at,
        last_stage_moved_at,
        stage_entered_at,
        last_human_touch_at,
        companies (
          id,
          name,
          customer_type
        ),
        products (
          id,
          name,
          color,
          icon
        ),
        product_process_stages (
          id,
          name,
          stage_order
        ),
        users (
          id,
          name
        )
      `)
      .in('status', statuses)
      .in('product_id', validProductIds);

    if (products.length > 0) query = query.in('product_id', products);
    if (users.length > 0) query = query.in('owner_user_id', users);
    if (search) query = query.ilike('companies.name', `%${search}%`);

    const { data: rawItems, error } = await query;

    if (error) {
      console.error('Process API error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data with computed health status
    const items: PipelineItem[] = (rawItems || []).map((item: Record<string, unknown>) => {
      const company = item.companies as { id: string; name: string; customer_type: string | null } | null;
      const product = item.products as { id: string; name: string; color: string | null; icon: string | null } | null;
      const stage = item.product_process_stages as { id: string; name: string; stage_order: number } | null;
      const owner = item.users as { id: string; name: string } | null;

      const { status: healthStatus, reason: healthReason, daysInStage } = computeHealthStatus(
        item.last_activity_at as string | null,
        item.last_human_touch_at as string | null,
        item.last_stage_moved_at as string | null,
        item.stage_entered_at as string | null,
        item.created_at as string
      );

      // Compute initials from name
      const ownerName = owner?.name || '';
      const nameParts = ownerName.split(' ');
      const ownerInitials = nameParts.length >= 2
        ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
        : ownerName.slice(0, 2).toUpperCase();

      return {
        id: item.id as string,
        company_id: item.company_id as string,
        company_name: company?.name || 'Unknown Company',
        company_type: company?.customer_type || null,
        product_id: item.product_id as string,
        product_name: product?.name || 'Unknown Product',
        product_color: product?.color || null,
        product_icon: product?.icon || null,
        status: item.status as string,
        current_stage_id: item.current_stage_id as string | null,
        stage_name: stage?.name || null,
        stage_order: stage?.stage_order || null,
        owner_id: item.owner_user_id as string | null,
        owner_name: owner?.name || null,
        owner_initials: ownerInitials || null,
        mrr: item.mrr as number | null,
        created_at: item.created_at as string,
        updated_at: item.updated_at as string,
        last_activity_at: item.last_activity_at as string | null,
        last_stage_moved_at: item.last_stage_moved_at as string | null,
        days_in_stage: daysInStage,
        health_status: healthStatus,
        health_reason: healthReason,
      };
    });

    // Filter by health if specified
    const filteredItems = health === 'all'
      ? items
      : items.filter(i => i.health_status === health);

    // Sort by days in stage descending (most stale first)
    filteredItems.sort((a, b) => b.days_in_stage - a.days_in_stage);

    const stats: ProcessStats = {
      total: filteredItems.length,
      needsAttention: filteredItems.filter(i => i.health_status === 'attention').length,
      stalled: filteredItems.filter(i => i.health_status === 'stalled').length,
      healthy: filteredItems.filter(i => i.health_status === 'healthy').length,
      totalMrr: filteredItems.reduce((sum, i) => sum + (i.mrr || 0), 0),
      productCount: new Set(filteredItems.map(i => i.product_id)).size,
    };

    // Get stages for valid products only (through product_processes)
    const { data: stages } = await supabase
      .from('product_process_stages')
      .select(`
        id,
        name,
        stage_order,
        process:product_processes!inner (
          id,
          process_type,
          product_id
        )
      `)
      .in('product_processes.product_id', validProductIds)
      .order('stage_order');

    // Flatten the stages to include product_id directly
    const flatStages = (stages || []).map(s => ({
      id: s.id,
      name: s.name,
      stage_order: s.stage_order,
      product_id: (s.process as { product_id: string })?.product_id,
      process_type: (s.process as { process_type: string })?.process_type,
    }));

    return NextResponse.json({ items: filteredItems, stats, stages: flatStages });
  } catch (error) {
    console.error('Process API error:', error);
    return NextResponse.json({ error: 'Failed to fetch process data' }, { status: 500 });
  }
}
