/**
 * Support Case Timeline API
 *
 * GET /api/cases/[id]/timeline - Get event history for a case
 *
 * Returns events from the event store for display in the timeline view.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SUPPORT_CASE_AGGREGATE_TYPE } from '@/lib/supportCase/events';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]/timeline
 *
 * Fetches all events for a support case in chronological order.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminClient();

  // Fetch events from event store
  const { data, error } = await supabase
    .from('event_store')
    .select(`
      id,
      aggregate_type,
      aggregate_id,
      event_type,
      event_data,
      sequence_number,
      occurred_at,
      actor_type,
      actor_id,
      metadata
    `)
    .eq('aggregate_type', SUPPORT_CASE_AGGREGATE_TYPE)
    .eq('aggregate_id', id)
    .order('sequence_number', { ascending: true });

  if (error) {
    console.error('Failed to fetch case timeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline' },
      { status: 500 }
    );
  }

  // Transform events for display
  const timeline = (data || []).map((event) => ({
    id: event.id,
    type: event.event_type,
    data: event.event_data,
    sequence: event.sequence_number,
    occurredAt: event.occurred_at,
    actor: {
      type: event.actor_type,
      id: event.actor_id,
    },
    metadata: event.metadata,
  }));

  return NextResponse.json({ data: timeline });
}
