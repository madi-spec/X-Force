/**
 * Calculate Momentum Scores Cron Job
 *
 * Schedule: Every 15 minutes (configured in vercel.json)
 * Purpose: Recalculate momentum scores for all pending items
 *
 * This keeps time-sensitive scores up to date as deadlines approach.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { refreshAllScores } from '@/lib/commandCenter';

// Vercel cron secret for authorization
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get users with pending items
    const { data: usersWithItems, error: usersError } = await supabase
      .from('command_center_items')
      .select('user_id')
      .eq('status', 'pending')
      .limit(1000);

    if (usersError) {
      console.error('[Cron/CalculateMomentum] Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(usersWithItems?.map((i) => i.user_id) || [])];

    const results = {
      total_users: uniqueUserIds.length,
      items_updated: 0,
      items_failed: 0,
      errors: [] as string[],
    };

    // Process each user
    for (const userId of uniqueUserIds) {
      try {
        const result = await refreshAllScores(userId);
        results.items_updated += result.updated;
        results.items_failed += result.failed;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`User ${userId}: ${message}`);
        console.error(`[Cron/CalculateMomentum] Error for user ${userId}:`, error);
      }
    }

    console.log('[Cron/CalculateMomentum] Complete:', results);

    return NextResponse.json({
      success: true,
      ...results,
      calculated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron/CalculateMomentum] Fatal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
