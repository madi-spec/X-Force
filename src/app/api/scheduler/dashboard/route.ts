import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SchedulingService } from '@/lib/scheduler/schedulingService';
import { getHealthSummary } from '@/lib/scheduler/monitoring/HealthChecker';
import { STATUS } from '@/lib/scheduler/core/constants';

/**
 * GET /api/scheduler/dashboard
 *
 * Returns data for the scheduler dashboard widget.
 * Includes:
 * - Health summary
 * - Legacy dashboard data from SchedulingService
 * - Pending drafts for current user
 * - Active requests with recent activity
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get internal user
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get legacy dashboard data
    const schedulingService = new SchedulingService();
    const { data: legacyData, error: legacyError } = await schedulingService.getDashboardData();

    // Get health summary
    let health;
    try {
      health = await getHealthSummary();
    } catch (err) {
      console.warn('[SchedulerDashboard] Health check failed:', err);
      health = {
        status: 'unknown',
        activeRequests: 0,
        pendingDrafts: 0,
        issueCount: 0,
      };
    }

    // Get user's pending drafts
    const { data: pendingDrafts } = await supabase
      .from('scheduling_drafts')
      .select(
        `
        id,
        draft_type,
        subject,
        status,
        created_at,
        scheduling_request_id
      `
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get user's active requests
    const { data: activeRequests } = await supabase
      .from('scheduling_requests')
      .select(
        `
        id,
        status,
        next_action_type,
        next_action_at,
        last_action_at,
        follow_up_count,
        confirmed_time,
        email_thread_id,
        company:companies(id, name),
        contact:contacts(id, first_name, last_name, email)
      `
      )
      .eq('created_by', userData.id)
      .not('status', 'in', `(${STATUS.COMPLETED},${STATUS.CANCELLED})`)
      .order('last_action_at', { ascending: false })
      .limit(10);

    // Get stats
    const { count: totalRequests } = await supabase
      .from('scheduling_requests')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userData.id);

    const { count: completedRequests } = await supabase
      .from('scheduling_requests')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userData.id)
      .eq('status', STATUS.COMPLETED);

    return NextResponse.json({
      data: legacyData, // Keep legacy data for compatibility
      health,
      pendingDrafts: pendingDrafts || [],
      activeRequests: (activeRequests || []).map((r) => ({
        ...r,
        hasMissingThreadId: r.status === STATUS.AWAITING_RESPONSE && !r.email_thread_id,
      })),
      stats: {
        total: totalRequests || 0,
        completed: completedRequests || 0,
        active: (activeRequests || []).length,
        pendingDraftsCount: (pendingDrafts || []).length,
      },
    });
  } catch (err) {
    console.error('Error fetching scheduler dashboard:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
