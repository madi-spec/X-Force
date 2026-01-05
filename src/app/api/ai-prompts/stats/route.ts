import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/ai-prompts/stats
 *
 * Returns runtime statistics for AI prompts from the ai_action_log table.
 */
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentActions, error: actionsError } = await supabase
      .from('ai_action_log')
      .select('action_type, status, created_at, outputs')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });

    if (actionsError) {
      console.error('[AI Prompts Stats] Error:', actionsError);
      return NextResponse.json({ stats: {} });
    }

    const statsByType: Record<string, {
      calls: number;
      successes: number;
      failures: number;
      totalLatency: number;
      lastCalledAt: string | null;
    }> = {};

    for (const action of recentActions || []) {
      const type = action.action_type;
      if (!statsByType[type]) {
        statsByType[type] = { calls: 0, successes: 0, failures: 0, totalLatency: 0, lastCalledAt: null };
      }
      statsByType[type].calls++;
      if (action.status === 'success') statsByType[type].successes++;
      else if (action.status === 'failure') statsByType[type].failures++;

      const outputs = action.outputs as Record<string, unknown> | null;
      if (outputs?.latencyMs && typeof outputs.latencyMs === 'number') {
        statsByType[type].totalLatency += outputs.latencyMs;
      }
      if (!statsByType[type].lastCalledAt || action.created_at > statsByType[type].lastCalledAt) {
        statsByType[type].lastCalledAt = action.created_at;
      }
    }

    const stats: Record<string, {
      callsLast24h: number;
      avgLatencyMs: number;
      errorRate: number;
      lastCalledAt: string | null;
    }> = {};

    for (const [type, data] of Object.entries(statsByType)) {
      stats[type] = {
        callsLast24h: data.calls,
        avgLatencyMs: data.calls > 0 ? Math.round(data.totalLatency / data.calls) : 0,
        errorRate: data.calls > 0 ? data.failures / data.calls : 0,
        lastCalledAt: data.lastCalledAt,
      };
    }

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('[AI Prompts Stats] Unexpected error:', error);
    return NextResponse.json({ stats: {} });
  }
}
