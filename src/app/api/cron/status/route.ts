/**
 * GET /api/cron/status
 *
 * Returns recent cron execution history for monitoring and debugging.
 * Shows which crons ran, their status, duration, and any errors.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecentExecutions } from '@/lib/cron/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret or admin access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Allow access with CRON_SECRET or in development
  if (
    process.env.NODE_ENV !== 'development' &&
    cronSecret &&
    authHeader !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const jobName = searchParams.get('job') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const executions = await getRecentExecutions(jobName, limit);

    // Group by job name for summary
    const byJob: Record<
      string,
      {
        total: number;
        success: number;
        error: number;
        running: number;
        avgDuration: number;
        lastRun: string | null;
        lastStatus: string | null;
      }
    > = {};

    for (const exec of executions) {
      if (!byJob[exec.job_name]) {
        byJob[exec.job_name] = {
          total: 0,
          success: 0,
          error: 0,
          running: 0,
          avgDuration: 0,
          lastRun: null,
          lastStatus: null,
        };
      }

      const job = byJob[exec.job_name];
      job.total++;

      if (exec.status === 'success') job.success++;
      else if (exec.status === 'error') job.error++;
      else if (exec.status === 'running') job.running++;

      if (exec.duration_ms) {
        job.avgDuration =
          (job.avgDuration * (job.total - 1) + exec.duration_ms) / job.total;
      }

      if (!job.lastRun || exec.started_at > job.lastRun) {
        job.lastRun = exec.started_at;
        job.lastStatus = exec.status;
      }
    }

    // Sort executions by time
    const sortedExecutions = executions.sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );

    return NextResponse.json({
      summary: byJob,
      executions: sortedExecutions.slice(0, limit),
      queriedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to fetch cron status:', err);
    return NextResponse.json(
      { error: 'Failed to fetch cron status' },
      { status: 500 }
    );
  }
}
