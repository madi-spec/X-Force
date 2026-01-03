/**
 * Tier Classification Cron Job
 *
 * Runs periodically (every 5 minutes) to classify all pending
 * command center items into the 5-tier priority system.
 *
 * This ensures items are always properly classified even if
 * the classification wasn't done during the API request.
 */

import { NextRequest, NextResponse } from 'next/server';

// Required for Vercel Cron - extend timeout and ensure fresh execution
export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute should be sufficient
export const dynamic = 'force-dynamic';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyAllItems } from '@/lib/commandCenter/tierDetection';

// Verify cron secret for security
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (if configured)
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[ClassifyTiers] Starting tier classification cron job...');

    const supabase = createAdminClient();

    // Get all users with pending command center items
    const { data: usersWithItems, error: usersError } = await supabase
      .from('command_center_items')
      .select('user_id')
      .eq('status', 'pending')
      .is('tier', null) // Only items not yet classified
      .limit(1000);

    if (usersError) {
      console.error('[ClassifyTiers] Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get unique user IDs
    const userIds = [...new Set((usersWithItems || []).map(item => item.user_id))];

    console.log(`[ClassifyTiers] Found ${userIds.length} users with unclassified items`);

    let totalClassified = 0;
    const results: Array<{ userId: string; classified: number }> = [];

    // Process each user
    for (const userId of userIds) {
      try {
        const classified = await classifyAllItems(userId);
        totalClassified += classified;
        results.push({ userId, classified });
        console.log(`[ClassifyTiers] Classified ${classified} items for user ${userId}`);
      } catch (err) {
        console.error(`[ClassifyTiers] Error classifying items for user ${userId}:`, err);
      }
    }

    console.log(`[ClassifyTiers] Completed. Total items classified: ${totalClassified}`);

    return NextResponse.json({
      success: true,
      users_processed: userIds.length,
      items_classified: totalClassified,
      results,
    });
  } catch (error) {
    console.error('[ClassifyTiers] Cron job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Also support POST for Vercel Cron
export async function POST(request: NextRequest) {
  return GET(request);
}
