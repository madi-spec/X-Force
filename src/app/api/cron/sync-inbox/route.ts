/**
 * Inbox Sync Cron
 *
 * Syncs emails from Microsoft to email_messages table for all users.
 * This populates the inbox and enables email -> communication flow.
 *
 * GET /api/cron/sync-inbox
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { performInitialSync } from '@/lib/inbox';
import { logCronStart, logCronSuccess, logCronError } from '@/lib/cron/logging';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

const JOB_NAME = 'sync-inbox';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const executionId = await logCronStart(JOB_NAME);

  // Check for auth header (for Vercel cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const supabase = createAdminClient();

    // Get all users with active Microsoft connections
    const { data: connections, error: connError } = await supabase
      .from('microsoft_connections')
      .select('user_id')
      .eq('is_active', true);

    if (connError) {
      throw new Error(`Failed to fetch connections: ${connError.message}`);
    }

    if (!connections || connections.length === 0) {
      const result = { success: true, message: 'No active connections', synced: 0 };
      await logCronSuccess(executionId, JOB_NAME, startTime, result);
      return NextResponse.json(result);
    }

    const results = {
      usersProcessed: 0,
      totalConversations: 0,
      totalMessages: 0,
      errors: [] as string[],
    };

    // Sync each user's inbox
    for (const conn of connections) {
      try {
        console.log(`[sync-inbox] Syncing user ${conn.user_id}`);
        const result = await performInitialSync(conn.user_id);
        results.usersProcessed++;
        results.totalConversations += result.conversations || 0;
        results.totalMessages += result.messages || 0;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        results.errors.push(`User ${conn.user_id}: ${errMsg}`);
        console.error(`[sync-inbox] Error for user ${conn.user_id}:`, err);
      }
    }

    console.log(`[sync-inbox] Complete:`, results);

    await logCronSuccess(executionId, JOB_NAME, startTime, results);
    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (err) {
    await logCronError(executionId, JOB_NAME, startTime, err);
    console.error('[sync-inbox] Fatal error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
