import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/collateral/analytics
 * Returns usage statistics for collateral
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    // Most viewed collateral (top 10)
    const { data: mostViewed, error: mostViewedError } = await supabase
      .from('collateral')
      .select('id, name, document_type, view_count')
      .eq('is_archived', false)
      .order('view_count', { ascending: false })
      .limit(10);

    if (mostViewedError) {
      console.error('[CollateralAnalytics] Error fetching most viewed:', mostViewedError);
    }

    // Recent usage (last 20 actions)
    const { data: recentUsage, error: recentUsageError } = await supabase
      .from('collateral_usage')
      .select(`
        id,
        action,
        created_at,
        collateral:collateral_id (id, name),
        deal:deal_id (id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentUsageError) {
      console.error('[CollateralAnalytics] Error fetching recent usage:', recentUsageError);
    }

    // Total stats
    const { count: totalCollateral } = await supabase
      .from('collateral')
      .select('*', { count: 'exact', head: true })
      .eq('is_archived', false);

    const { count: totalViews } = await supabase
      .from('collateral_usage')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'viewed');

    const { count: totalCopies } = await supabase
      .from('collateral_usage')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'copied_link');

    // Usage by document type
    const { data: byDocType } = await supabase
      .from('collateral')
      .select('document_type, view_count')
      .eq('is_archived', false);

    const usageByDocType: Record<string, number> = {};
    if (byDocType) {
      byDocType.forEach((item) => {
        const type = item.document_type || 'other';
        usageByDocType[type] = (usageByDocType[type] || 0) + (item.view_count || 0);
      });
    }

    return NextResponse.json({
      mostViewed: mostViewed || [],
      recentUsage: recentUsage || [],
      totals: {
        collateral: totalCollateral || 0,
        views: totalViews || 0,
        copies: totalCopies || 0,
      },
      usageByDocType,
    });
  } catch (err) {
    console.error('[CollateralAnalytics] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
