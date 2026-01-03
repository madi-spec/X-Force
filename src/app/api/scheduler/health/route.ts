import { NextResponse } from 'next/server';
import { checkSchedulerHealth, getHealthSummary, quickHealthCheck } from '@/lib/scheduler/monitoring/HealthChecker';

/**
 * GET /api/scheduler/health
 *
 * Returns scheduler health status and metrics.
 *
 * Query params:
 * - summary=true: Return summary only (for dashboard widget)
 * - quick=true: Return quick status check only (for monitoring)
 * - full=true: Return full health check (default)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const summaryOnly = searchParams.get('summary') === 'true';
  const quickOnly = searchParams.get('quick') === 'true';

  try {
    if (summaryOnly) {
      const summary = await getHealthSummary();
      return NextResponse.json(summary);
    }

    if (quickOnly) {
      const quick = await quickHealthCheck();
      const statusCode = quick.status === 'critical' ? 503 : 200;
      return NextResponse.json(quick, { status: statusCode });
    }

    const health = await checkSchedulerHealth();

    // Return 503 if critical (for load balancer health checks)
    const statusCode = health.status === 'critical' ? 503 : 200;

    return NextResponse.json(health, { status: statusCode });
  } catch (err) {
    console.error('[SchedulerHealth] Health check failed:', err);
    return NextResponse.json(
      {
        status: 'critical',
        error: String(err),
        checked_at: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
