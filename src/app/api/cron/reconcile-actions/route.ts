import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { reconcileCompanyActions, runBatchReconciliation } from '@/lib/commandCenter/actionReconciliation';

// Required for Vercel Cron - extend timeout and ensure fresh execution
export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes
export const dynamic = 'force-dynamic';

// Service client for cron jobs
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Cron endpoint to reconcile command center actions with relationship intelligence
 * Run every 15 minutes via Vercel Cron
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Get all active users (users with recent activity)
    const { data: activeUsers, error: usersError } = await supabase
      .from('command_center_items')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .limit(100);

    if (usersError) {
      console.error('Failed to fetch active users:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch active users' },
        { status: 500 }
      );
    }

    // Get unique user IDs
    const userIds = [...new Set((activeUsers || []).map((u) => u.user_id))];

    // Run reconciliation for each user
    const results = await Promise.all(
      userIds.map(async (userId) => {
        const since = new Date(Date.now() - 60 * 60 * 1000); // Last hour
        const result = await runBatchReconciliation(userId, since);
        return { userId, ...result };
      })
    );

    // Aggregate results
    const totals = results.reduce(
      (acc, r) => ({
        actionsCreated: acc.actionsCreated + r.actionsCreated,
        actionsUpdated: acc.actionsUpdated + r.actionsUpdated,
        commitmentsUpdated: acc.commitmentsUpdated + r.commitmentsUpdated,
        errors: [...acc.errors, ...r.errors],
      }),
      { actionsCreated: 0, actionsUpdated: 0, commitmentsUpdated: 0, errors: [] as string[] }
    );

    return NextResponse.json({
      success: true,
      users_processed: userIds.length,
      actions_created: totals.actionsCreated,
      actions_updated: totals.actionsUpdated,
      commitments_updated: totals.commitmentsUpdated,
      errors: totals.errors.slice(0, 10), // Limit error output
    });
  } catch (err) {
    console.error('Reconciliation cron error:', err);
    return NextResponse.json(
      { error: 'Reconciliation failed' },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Get current user from request body
    const body = await request.json();
    const { userId, companyId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    let result;
    if (companyId) {
      // Reconcile specific company
      result = await reconcileCompanyActions(companyId, userId, false);
    } else {
      // Run batch reconciliation for user
      result = await runBatchReconciliation(userId);
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('Manual reconciliation error:', err);
    return NextResponse.json(
      { error: 'Reconciliation failed' },
      { status: 500 }
    );
  }
}
