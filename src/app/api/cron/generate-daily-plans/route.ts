/**
 * Generate Daily Plans Cron Job
 *
 * Schedule: 6 AM daily (configured in vercel.json)
 * Purpose: Generate daily plans for all active users
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateDailyPlan, syncAllSources } from '@/lib/commandCenter';

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
    const today = new Date();

    // Get all active users
    const { data: activeUsers, error: usersError } = await supabase
      .from('users')
      .select('id');

    if (usersError) {
      console.error('[Cron/GeneratePlans] Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const results = {
      total_users: activeUsers?.length || 0,
      plans_generated: 0,
      items_synced: 0,
      errors: [] as string[],
    };

    // Process each user
    for (const user of activeUsers || []) {
      try {
        // Sync sources to create/update items
        const syncResult = await syncAllSources(user.id);
        results.items_synced += syncResult.created;

        // Generate daily plan
        await generateDailyPlan(user.id, today);
        results.plans_generated++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`User ${user.id}: ${message}`);
        console.error(`[Cron/GeneratePlans] Error for user ${user.id}:`, error);
      }
    }

    console.log('[Cron/GeneratePlans] Complete:', results);

    return NextResponse.json({
      success: true,
      ...results,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron/GeneratePlans] Fatal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
