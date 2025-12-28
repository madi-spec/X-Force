import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyUsage, getApiKeyStats } from '@/lib/scheduler/apiKeyService';

export const dynamic = 'force-dynamic';

// GET - Get API key usage history and stats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const view = searchParams.get('view') || 'history';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const days = parseInt(searchParams.get('days') || '7');

    if (view === 'stats') {
      const stats = await getApiKeyStats(id, days);
      return NextResponse.json(stats);
    }

    const { usage, total } = await getApiKeyUsage(id, { limit, offset });

    return NextResponse.json({
      usage,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching API key usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}
