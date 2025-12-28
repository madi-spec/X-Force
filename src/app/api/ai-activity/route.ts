/**
 * AI Activity API
 *
 * GET /api/ai-activity
 *
 * Returns the AI action log for the activity feed.
 * This is the audit trail showing all AI-initiated actions.
 *
 * Query params:
 * - source: comma-separated (scheduler,communications,transcript) - filter by source
 * - status: comma-separated (success,skipped,failed) - filter by status
 * - actionType: comma-separated action types - filter by action_type
 * - companyId: UUID - filter by company
 * - since: ISO date - only show actions after this date
 * - until: ISO date - only show actions before this date
 * - limit: number (default 50, max 200)
 * - offset: number (default 0)
 *
 * Returns:
 * {
 *   actions: AIActionLogEntry[],
 *   total: number,
 *   limit: number,
 *   offset: number,
 *   stats: {
 *     success: number,
 *     skipped: number,
 *     failed: number,
 *     bySource: Record<string, number>
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AIActionLogEntry, AIActionSource, AIActionStatus } from '@/lib/autopilot/types';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Parse query params
    const { searchParams } = new URL(request.url);
    const sourcesStr = searchParams.get('source');
    const statusesStr = searchParams.get('status');
    const actionTypesStr = searchParams.get('actionType');
    const companyId = searchParams.get('companyId');
    const since = searchParams.get('since');
    const until = searchParams.get('until');
    const limitStr = searchParams.get('limit');
    const offsetStr = searchParams.get('offset');

    const limit = Math.min(parseInt(limitStr || '50', 10), 200);
    const offset = parseInt(offsetStr || '0', 10);

    // Build query
    let query = supabase
      .from('ai_action_log')
      .select(`
        *,
        company:companies(id, name),
        contact:contacts(id, name, email),
        communication:communications(id, subject)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (sourcesStr) {
      const sources = sourcesStr.split(',').map((s) => s.trim());
      query = query.in('source', sources);
    }

    if (statusesStr) {
      const statuses = statusesStr.split(',').map((s) => s.trim());
      query = query.in('status', statuses);
    }

    if (actionTypesStr) {
      const actionTypes = actionTypesStr.split(',').map((s) => s.trim());
      query = query.in('action_type', actionTypes);
    }

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    if (since) {
      query = query.gte('created_at', since);
    }

    if (until) {
      query = query.lte('created_at', until);
    }

    const { data: actions, count, error } = await query;

    if (error) {
      console.error('[AI Activity] Error fetching actions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate stats (for the filtered results or recent period)
    const statsQuery = supabase
      .from('ai_action_log')
      .select('status, source', { count: 'exact' });

    // Apply same filters to stats
    if (sourcesStr) {
      statsQuery.in('source', sourcesStr.split(','));
    }
    if (companyId) {
      statsQuery.eq('company_id', companyId);
    }
    if (since) {
      statsQuery.gte('created_at', since);
    }
    if (until) {
      statsQuery.lte('created_at', until);
    }

    const { data: statsRaw } = await statsQuery;

    // Aggregate stats
    const stats = {
      success: 0,
      skipped: 0,
      failed: 0,
      pending: 0,
      bySource: {} as Record<AIActionSource, number>,
    };

    for (const row of statsRaw || []) {
      // Count by status
      const status = row.status as AIActionStatus;
      if (status === 'success') stats.success++;
      else if (status === 'skipped') stats.skipped++;
      else if (status === 'failed') stats.failed++;
      else if (status === 'pending') stats.pending++;

      // Count by source
      const source = row.source as AIActionSource;
      stats.bySource[source] = (stats.bySource[source] || 0) + 1;
    }

    return NextResponse.json({
      actions: actions as AIActionLogEntry[],
      total: count || 0,
      limit,
      offset,
      stats,
    });
  } catch (err) {
    console.error('[AI Activity] Error:', err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
