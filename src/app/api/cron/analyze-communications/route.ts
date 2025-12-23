import { NextRequest, NextResponse } from 'next/server';
import { analyzeAllPending } from '@/lib/communicationHub/analysis/analyzeCommunication';

export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production') {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[Cron] Starting communication analysis...');

  const result = await analyzeAllPending({ limit: 25 });

  console.log(`[Cron] Analysis complete: ${result.analyzed} analyzed, ${result.errors} errors`);

  return NextResponse.json({
    success: true,
    ...result,
  });
}

// Allow manual trigger via POST
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const limit = body.limit || 25;

  const result = await analyzeAllPending({ limit });

  return NextResponse.json({
    success: true,
    ...result,
  });
}
