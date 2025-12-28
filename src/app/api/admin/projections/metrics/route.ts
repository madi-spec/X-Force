/**
 * Admin API: Projection Metrics
 *
 * GET /api/admin/projections/metrics
 *
 * Returns observability data:
 * - Command execution stats
 * - Event processing stats
 * - Projector run stats
 * - SLA breach counts
 * - Recent logs
 * - Projection lag
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getMetricsSnapshot,
  getRecentLogs,
  getProjectionLagSummary,
  exportPrometheusMetrics,
} from '@/lib/eventSourcing';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check format query param
    const format = request.nextUrl.searchParams.get('format');

    if (format === 'prometheus') {
      // Return Prometheus-compatible format
      return new NextResponse(exportPrometheusMetrics(), {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Get checkpoint data from database
    const { data: checkpoints } = await supabase
      .from('projector_checkpoints')
      .select('*')
      .order('projector_name');

    // Get latest event sequence for lag calculation
    const { data: latestEvent } = await supabase
      .from('event_store')
      .select('global_sequence')
      .order('global_sequence', { ascending: false })
      .limit(1)
      .single();

    const latestSequence = latestEvent?.global_sequence || 0;

    // Calculate lag for each projector
    const projectorStatus = (checkpoints || []).map(cp => ({
      name: cp.projector_name,
      status: cp.status,
      lastProcessedSequence: cp.last_processed_global_sequence,
      lagEvents: latestSequence - (cp.last_processed_global_sequence || 0),
      lastProcessedAt: cp.last_processed_at,
      eventsProcessedTotal: cp.events_processed_count,
      errorsCount: cp.errors_count,
      lastError: cp.last_error,
      lastErrorAt: cp.last_error_at,
    }));

    // Get in-memory metrics
    const metrics = getMetricsSnapshot();

    // Get recent logs
    const logCount = parseInt(request.nextUrl.searchParams.get('logs') || '50');
    const logCategory = request.nextUrl.searchParams.get('category') as 'command' | 'event' | 'projector' | 'sla' | 'rebuild' | 'guardrail' | undefined;
    const recentLogs = getRecentLogs(logCount, logCategory);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      latestEventSequence: latestSequence,
      projectors: projectorStatus,
      totals: {
        totalProjectors: projectorStatus.length,
        activeProjectors: projectorStatus.filter(p => p.status === 'active').length,
        totalLag: projectorStatus.reduce((sum, p) => sum + p.lagEvents, 0),
        totalErrors: projectorStatus.reduce((sum, p) => sum + (p.errorsCount || 0), 0),
      },
      inMemoryMetrics: {
        commands: {
          executed: metrics.commands.executed,
          succeeded: metrics.commands.succeeded,
          failed: metrics.commands.failed,
          byType: Object.fromEntries(metrics.commands.byType),
        },
        events: {
          appended: metrics.events.appended,
          processed: metrics.events.processed,
          byType: Object.fromEntries(metrics.events.byType),
        },
        projectorRuns: metrics.projectors.runs,
        slaBreaches: metrics.sla.breachesDetected,
      },
      recentLogs: recentLogs.map(log => ({
        timestamp: log.timestamp,
        level: log.level,
        category: log.category,
        message: log.message,
        data: log.data,
        error: log.error?.message,
      })),
    });
  } catch (error) {
    console.error('Metrics fetch error:', error);
    return NextResponse.json({
      error: 'Failed to fetch metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
