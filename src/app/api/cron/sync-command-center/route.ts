/**
 * Sync Command Center Items Cron Job
 *
 * Schedule: Every 5 minutes (configured in vercel.json)
 * Purpose: Create items from tasks, emails, meetings, signals
 *
 * This ensures new items from various sources are picked up quickly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncAllSources } from '@/lib/commandCenter';

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

    // Get all active users
    const { data: activeUsers, error: usersError } = await supabase
      .from('users')
      .select('id');

    if (usersError) {
      console.error('[Cron/SyncCommandCenter] Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const results = {
      total_users: activeUsers?.length || 0,
      items_created: 0,
      items_updated: 0,
      items_skipped: 0,
      errors: [] as string[],
    };

    // Process each user
    for (const user of activeUsers || []) {
      try {
        const syncResult = await syncAllSources(user.id);
        results.items_created += syncResult.created;
        results.items_updated += syncResult.updated;
        results.items_skipped += syncResult.skipped;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`User ${user.id}: ${message}`);
        console.error(`[Cron/SyncCommandCenter] Error for user ${user.id}:`, error);
      }
    }

    console.log('[Cron/SyncCommandCenter] Complete:', results);

    return NextResponse.json({
      success: true,
      ...results,
      synced_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron/SyncCommandCenter] Fatal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
