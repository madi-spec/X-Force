import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recalculateHealthScore } from '@/lib/ai/health-score';

export async function POST(request: NextRequest) {
  try {
    const { dealId } = await request.json();

    if (!dealId) {
      return NextResponse.json(
        { error: 'Deal ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const result = await recalculateHealthScore(supabase, dealId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calculating health score:', error);
    return NextResponse.json(
      { error: 'Failed to calculate health score' },
      { status: 500 }
    );
  }
}

// Batch recalculate all deals
export async function PUT() {
  try {
    const supabase = await createClient();

    // Get all active deals
    const { data: deals } = await supabase
      .from('deals')
      .select('id')
      .not('stage', 'in', '("closed_won","closed_lost")');

    if (!deals) {
      return NextResponse.json({ updated: 0 });
    }

    const results = await Promise.all(
      deals.map((deal) => recalculateHealthScore(supabase, deal.id))
    );

    return NextResponse.json({ updated: results.length });
  } catch (error) {
    console.error('Error batch calculating health scores:', error);
    return NextResponse.json(
      { error: 'Failed to batch calculate health scores' },
      { status: 500 }
    );
  }
}
