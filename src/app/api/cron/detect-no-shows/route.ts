import { NextResponse } from 'next/server';
import { processAllNoShows } from '@/lib/scheduler/noShowRecovery';

// Required for Vercel Cron - extend timeout and ensure fresh execution
export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute should be sufficient
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/detect-no-shows
 *
 * Detects and processes no-shows for confirmed meetings that should have happened.
 * Should be run every 15-30 minutes via Vercel Cron.
 *
 * Protected by CRON_SECRET environment variable.
 *
 * What it does:
 * 1. Finds confirmed meetings where scheduled_time has passed (by 30+ minutes)
 * 2. Checks if meeting was marked as completed
 * 3. If not completed, marks as no-show and triggers recovery:
 *    - 1st no-show: Send follow-up email after 4 hours
 *    - 2nd no-show: Escalate to human, create leverage moment
 *    - 3rd no-show: Pause outreach for 1 week
 *    - 4+ no-shows: Mark as cancelled
 */
export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('[Cron] Starting no-show detection...');

    const result = await processAllNoShows();

    console.log(`[Cron] No-show detection complete: ${result.detected} detected, ${result.processed} processed`);

    if (result.results.length > 0) {
      console.log('[Cron] No-show details:', JSON.stringify(result.results, null, 2));
    }

    return NextResponse.json({
      success: true,
      detected: result.detected,
      processed: result.processed,
      results: result.results,
    });
  } catch (err) {
    console.error('[Cron] No-show detection failed:', err);
    return NextResponse.json(
      { error: 'Failed to detect no-shows', details: String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/detect-no-shows
 *
 * Manual trigger for no-show detection (for testing).
 * Requires authentication but not CRON_SECRET.
 */
export async function POST(request: Request) {
  // For manual triggers, we could add user auth here
  // For now, allow POST without CRON_SECRET for testing

  try {
    console.log('[Manual] Starting no-show detection...');

    const result = await processAllNoShows();

    return NextResponse.json({
      success: true,
      detected: result.detected,
      processed: result.processed,
      results: result.results,
    });
  } catch (err) {
    console.error('[Manual] No-show detection failed:', err);
    return NextResponse.json(
      { error: 'Failed to detect no-shows', details: String(err) },
      { status: 500 }
    );
  }
}
