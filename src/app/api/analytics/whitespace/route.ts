import { NextRequest, NextResponse } from 'next/server';
import { analyzeWhitespace, getWhitespaceOpportunities } from '@/lib/analytics/whitespaceAnalyzer';

// GET - Get whitespace stats and opportunities
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const view = searchParams.get('view') || 'stats';

  try {
    if (view === 'stats') {
      const stats = await analyzeWhitespace();
      return NextResponse.json(stats);
    }

    if (view === 'opportunities') {
      const opportunities = await getWhitespaceOpportunities({
        product_id: searchParams.get('product_id') || undefined,
        min_fit_score: parseInt(searchParams.get('min_fit_score') || '0'),
        limit: parseInt(searchParams.get('limit') || '50'),
        sort_by: (searchParams.get('sort_by') as 'potential_mrr' | 'fit_score' | 'priority') || 'priority'
      });
      return NextResponse.json({ opportunities });
    }

    return NextResponse.json({ error: 'Invalid view' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
