import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateDealHealth, recalculateAllDealHealth } from '@/lib/ai/scoring';

// POST - Calculate health score for a single deal
export async function POST(request: NextRequest) {
  try {
    const { dealId } = await request.json();

    if (!dealId) {
      return NextResponse.json({ error: 'Deal ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await calculateDealHealth(dealId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calculating health score:', error);
    return NextResponse.json(
      { error: 'Failed to calculate health score' },
      { status: 500 }
    );
  }
}

// GET - Get health score and breakdown for a deal
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get('dealId');

    if (!dealId) {
      return NextResponse.json({ error: 'Deal ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the deal with current health score
    const { data: deal } = await supabase
      .from('deals')
      .select('id, health_score, health_updated_at, health_trend')
      .eq('id', dealId)
      .single();

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Get latest health history record for breakdown
    const { data: history } = await supabase
      .from('deal_health_history')
      .select('*')
      .eq('deal_id', dealId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    // Get health history for trend chart (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: historyTrend } = await supabase
      .from('deal_health_history')
      .select('overall_score, recorded_at')
      .eq('deal_id', dealId)
      .gte('recorded_at', thirtyDaysAgo)
      .order('recorded_at', { ascending: true });

    return NextResponse.json({
      score: deal.health_score,
      trend: deal.health_trend,
      updatedAt: deal.health_updated_at,
      breakdown: history
        ? {
            engagement: history.engagement_score,
            velocity: history.velocity_score,
            stakeholder: history.stakeholder_score,
            activity: history.activity_score,
            sentiment: history.sentiment_score,
            riskFactors: history.risk_factors,
            positiveFactors: history.positive_factors,
          }
        : null,
      history: historyTrend || [],
    });
  } catch (error) {
    console.error('Error fetching health score:', error);
    return NextResponse.json(
      { error: 'Failed to fetch health score' },
      { status: 500 }
    );
  }
}

// PUT - Batch recalculate all deals
export async function PUT() {
  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await recalculateAllDealHealth();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error batch calculating health scores:', error);
    return NextResponse.json(
      { error: 'Failed to batch calculate health scores' },
      { status: 500 }
    );
  }
}
