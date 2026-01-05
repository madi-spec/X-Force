import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProcessType } from '@/types/products';

export async function GET() {
  const supabase = await createClient();

  try {
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
      // Get total count using Supabase count
      const { count: total } = await supabase
        .from('company_products')
        .select('*', { count: 'exact', head: true })
        .in('status', statusMap[process]);

      // Get needs attention count (no activity in 14+ days OR in stage 30+ days)
      // Using OR conditions for attention calculation
      const { count: noRecentActivity } = await supabase
        .from('company_products')
        .select('*', { count: 'exact', head: true })
        .in('status', statusMap[process])
        .or(`last_activity_at.lt.${fourteenDaysAgo},last_activity_at.is.null`);

      const { count: stalledInStage } = await supabase
        .from('company_products')
        .select('*', { count: 'exact', head: true })
        .in('status', statusMap[process])
        .or(`last_stage_moved_at.lt.${thirtyDaysAgo},last_stage_moved_at.is.null,stage_entered_at.lt.${thirtyDaysAgo}`);

      // Approximate needs attention (items with either condition)
      // For accurate count, we'd need a more complex query, but this is a reasonable estimate
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
