import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProcessType } from '@/types/products';

export async function GET() {
  const supabase = await createClient();

  try {
    // First, get valid product IDs (sellable, top-level products only)
    const { data: validProducts } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true)
      .eq('is_sellable', true)
      .is('parent_product_id', null);

    const validProductIds = (validProducts || []).map(p => p.id);

    // If no valid products, return zeros
    if (validProductIds.length === 0) {
      return NextResponse.json([
        { process: 'sales', total: 0, needsAttention: 0 },
        { process: 'onboarding', total: 0, needsAttention: 0 },
        { process: 'customer_service', total: 0, needsAttention: 0 },
        { process: 'engagement', total: 0, needsAttention: 0 },
      ]);
    }

    const processes: ProcessType[] = ['sales', 'onboarding', 'customer_service', 'engagement'];
    const statusMap: Record<ProcessType, string[]> = {
      sales: ['in_sales'],
      onboarding: ['in_onboarding'],
      customer_service: ['active'],
      engagement: ['active'],
    };

    // Calculate attention thresholds
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const results = [];

    for (const process of processes) {
      // Get total count using Supabase count - filtered by valid products
      const { count: total } = await supabase
        .from('company_products')
        .select('*', { count: 'exact', head: true })
        .in('status', statusMap[process])
        .in('product_id', validProductIds);

      // Get needs attention count (no activity in 14+ days OR in stage 30+ days)
      const { count: noRecentActivity } = await supabase
        .from('company_products')
        .select('*', { count: 'exact', head: true })
        .in('status', statusMap[process])
        .in('product_id', validProductIds)
        .or(`last_activity_at.lt.${fourteenDaysAgo},last_activity_at.is.null`);

      const { count: stalledInStage } = await supabase
        .from('company_products')
        .select('*', { count: 'exact', head: true })
        .in('status', statusMap[process])
        .in('product_id', validProductIds)
        .or(`last_stage_moved_at.lt.${thirtyDaysAgo},last_stage_moved_at.is.null,stage_entered_at.lt.${thirtyDaysAgo}`);

      // Approximate needs attention (items with either condition)
      const needsAttention = Math.max(noRecentActivity || 0, stalledInStage || 0);

      results.push({
        process,
        total: total || 0,
        needsAttention,
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Process stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch process stats' }, { status: 500 });
  }
}
