/**
 * HealthChecker - Scheduler System Health Monitoring
 *
 * Checks for:
 * - Stuck requests (no action in 48+ hours)
 * - Missing thread IDs
 * - Pending drafts
 * - Failed drafts
 * - Job execution status
 * - Processing delays
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { STATUS } from '../core/constants';
import { SCHEDULER_JOBS, isJobHealthy, type JobStatus } from '../jobs/registry';
import { getJobStatus } from '../jobs/JobRunner';

// ============================================
// TYPES
// ============================================

export type HealthStatus = 'healthy' | 'degraded' | 'critical';

export interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
  count?: number;
  affectedIds?: string[];
  recommendation?: string;
}

export interface SchedulerMetrics {
  // Request counts
  total_active: number;
  by_status: Record<string, number>;

  // Problem indicators
  stuck_requests: number; // No action in 48+ hours
  missing_thread_id: number; // Awaiting response but no thread ID
  high_attempt_count: number; // 4+ attempts without success

  // Draft status
  pending_drafts: number;
  approved_drafts: number;
  failed_drafts_24h: number;

  // Performance
  avg_time_to_response_hours: number | null;
  avg_time_to_booking_hours: number | null;

  // Job health
  last_job_runs: Record<string, string>; // job_id -> last_run timestamp
  job_statuses: Record<string, JobStatus>;
}

export interface SchedulerHealth {
  status: HealthStatus;
  checked_at: string;
  metrics: SchedulerMetrics;
  issues: HealthIssue[];
  recommendations: string[];
}

// ============================================
// MAIN HEALTH CHECK
// ============================================

export async function checkSchedulerHealth(): Promise<SchedulerHealth> {
  const supabase = createAdminClient();
  const now = new Date();
  const hours48Ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const hours24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const issues: HealthIssue[] = [];
  const recommendations: string[] = [];

  // ========================================
  // GATHER METRICS
  // ========================================

  // Get all active requests
  const { data: activeRequests } = await supabase
    .from('scheduling_requests')
    .select('id, status, email_thread_id, last_action_at, attempt_count, created_at')
    .not('status', 'in', `(${STATUS.COMPLETED},${STATUS.CANCELLED})`);

  const requests = activeRequests || [];

  // Count by status
  const byStatus: Record<string, number> = {};
  for (const r of requests) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }

  // Find stuck requests
  const stuckRequests = requests.filter((r) => {
    if (!r.last_action_at) return true;
    return new Date(r.last_action_at) < hours48Ago;
  });

  // Find missing thread IDs
  const missingThreadId = requests.filter(
    (r) => r.status === STATUS.AWAITING_RESPONSE && !r.email_thread_id
  );

  // Find high attempt count
  const highAttempts = requests.filter((r) => (r.attempt_count || 0) >= 4);

  // Get draft counts
  const { data: pendingDrafts } = await supabase
    .from('scheduling_drafts')
    .select('id')
    .eq('status', 'pending');

  const { data: approvedDrafts } = await supabase
    .from('scheduling_drafts')
    .select('id')
    .eq('status', 'approved');

  const { data: failedDrafts } = await supabase
    .from('scheduling_drafts')
    .select('id')
    .eq('status', 'failed')
    .gte('created_at', hours24Ago.toISOString());

  // Calculate performance metrics
  const { data: completedRecent } = await supabase
    .from('scheduling_requests')
    .select('created_at, confirmed_time, completed_at')
    .eq('status', STATUS.COMPLETED)
    .gte('completed_at', hours24Ago.toISOString());

  let avgResponseTime: number | null = null;
  let avgBookingTime: number | null = null;

  if (completedRecent && completedRecent.length > 0) {
    const bookingTimes = completedRecent
      .filter((r) => r.created_at && r.confirmed_time)
      .map((r) => {
        const created = new Date(r.created_at);
        const confirmed = new Date(r.confirmed_time);
        return (confirmed.getTime() - created.getTime()) / (1000 * 60 * 60);
      });

    if (bookingTimes.length > 0) {
      avgBookingTime = bookingTimes.reduce((a, b) => a + b, 0) / bookingTimes.length;
    }
  }

  // Get job statuses
  const jobStatuses: Record<string, JobStatus> = {};
  const lastJobRuns: Record<string, string> = {};

  for (const job of Object.values(SCHEDULER_JOBS)) {
    try {
      const status = await getJobStatus(job.id);
      jobStatuses[job.id] = status;
      if (status.lastRun) {
        lastJobRuns[job.id] = status.lastRun.toISOString();
      }
    } catch {
      // Skip if we can't get job status
    }
  }

  // ========================================
  // IDENTIFY ISSUES
  // ========================================

  // Critical: Many stuck requests
  if (stuckRequests.length > 5) {
    issues.push({
      severity: 'critical',
      code: 'STUCK_REQUESTS_HIGH',
      message: `${stuckRequests.length} requests stuck with no action in 48+ hours`,
      count: stuckRequests.length,
      affectedIds: stuckRequests.slice(0, 10).map((r) => r.id),
      recommendation: 'Review stuck requests immediately - may indicate cron failure',
    });
  } else if (stuckRequests.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'STUCK_REQUESTS',
      message: `${stuckRequests.length} requests stuck with no action in 48+ hours`,
      count: stuckRequests.length,
      affectedIds: stuckRequests.map((r) => r.id),
    });
  }

  // Warning: Missing thread IDs
  if (missingThreadId.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_THREAD_ID',
      message: `${missingThreadId.length} awaiting requests missing email_thread_id`,
      count: missingThreadId.length,
      affectedIds: missingThreadId.map((r) => r.id),
      recommendation: 'Check email sending to ensure thread IDs are captured',
    });
  }

  // Warning: High attempts
  if (highAttempts.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'HIGH_ATTEMPT_COUNT',
      message: `${highAttempts.length} requests with 4+ follow-up attempts`,
      count: highAttempts.length,
      affectedIds: highAttempts.map((r) => r.id),
      recommendation: 'Review these prospects - may need different approach or removal',
    });
  }

  // Info: Pending drafts
  if ((pendingDrafts?.length || 0) > 10) {
    issues.push({
      severity: 'info',
      code: 'PENDING_DRAFTS',
      message: `${pendingDrafts?.length} drafts awaiting approval`,
      count: pendingDrafts?.length,
    });
    recommendations.push('Review and approve/reject pending drafts');
  }

  // Critical: Failed drafts
  if ((failedDrafts?.length || 0) > 5) {
    issues.push({
      severity: 'critical',
      code: 'FAILED_DRAFTS_HIGH',
      message: `${failedDrafts?.length} draft executions failed in the last 24 hours`,
      count: failedDrafts?.length,
      recommendation: 'Investigate failed drafts - may indicate integration issue',
    });
  } else if ((failedDrafts?.length || 0) > 0) {
    issues.push({
      severity: 'warning',
      code: 'FAILED_DRAFTS',
      message: `${failedDrafts?.length} draft executions failed in the last 24 hours`,
      count: failedDrafts?.length,
    });
  }

  // Check job health
  for (const [jobId, status] of Object.entries(jobStatuses)) {
    const job = Object.values(SCHEDULER_JOBS).find((j) => j.id === jobId);
    if (job && !isJobHealthy(job, status)) {
      issues.push({
        severity: status.consecutiveFailures >= 3 ? 'critical' : 'warning',
        code: 'JOB_UNHEALTHY',
        message: `Job ${job.name} is unhealthy (${status.consecutiveFailures} consecutive failures)`,
        recommendation: 'Check cron logs and investigate job failures',
      });
    }
  }

  // ========================================
  // DETERMINE STATUS
  // ========================================

  let status: HealthStatus = 'healthy';
  if (issues.some((i) => i.severity === 'critical')) {
    status = 'critical';
  } else if (issues.some((i) => i.severity === 'warning')) {
    status = 'degraded';
  }

  // ========================================
  // BUILD RESPONSE
  // ========================================

  const metrics: SchedulerMetrics = {
    total_active: requests.length,
    by_status: byStatus,
    stuck_requests: stuckRequests.length,
    missing_thread_id: missingThreadId.length,
    high_attempt_count: highAttempts.length,
    pending_drafts: pendingDrafts?.length || 0,
    approved_drafts: approvedDrafts?.length || 0,
    failed_drafts_24h: failedDrafts?.length || 0,
    avg_time_to_response_hours: avgResponseTime,
    avg_time_to_booking_hours: avgBookingTime,
    last_job_runs: lastJobRuns,
    job_statuses: jobStatuses,
  };

  return {
    status,
    checked_at: now.toISOString(),
    metrics,
    issues,
    recommendations,
  };
}

// ============================================
// SUMMARY FOR DASHBOARD
// ============================================

/**
 * Get summary for dashboard widget
 */
export async function getHealthSummary(): Promise<{
  status: HealthStatus;
  activeRequests: number;
  pendingDrafts: number;
  issueCount: number;
  topIssue?: string;
}> {
  const health = await checkSchedulerHealth();

  return {
    status: health.status,
    activeRequests: health.metrics.total_active,
    pendingDrafts: health.metrics.pending_drafts,
    issueCount: health.issues.length,
    topIssue: health.issues[0]?.message,
  };
}

// ============================================
// QUICK CHECKS
// ============================================

/**
 * Quick check for critical issues only
 * Use this for lightweight monitoring
 */
export async function quickHealthCheck(): Promise<{
  status: HealthStatus;
  criticalCount: number;
  warningCount: number;
}> {
  const health = await checkSchedulerHealth();

  return {
    status: health.status,
    criticalCount: health.issues.filter((i) => i.severity === 'critical').length,
    warningCount: health.issues.filter((i) => i.severity === 'warning').length,
  };
}

/**
 * Check if a specific request is stuck
 */
export async function isRequestStuck(requestId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const hours48Ago = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const { data: request } = await supabase
    .from('scheduling_requests')
    .select('last_action_at, status')
    .eq('id', requestId)
    .single();

  if (!request) return false;

  // Completed/cancelled requests aren't stuck
  if (request.status === STATUS.COMPLETED || request.status === STATUS.CANCELLED) {
    return false;
  }

  if (!request.last_action_at) return true;
  return new Date(request.last_action_at) < hours48Ago;
}
