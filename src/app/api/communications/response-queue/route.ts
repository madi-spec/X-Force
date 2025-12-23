/**
 * Response Queue API
 *
 * GET /api/communications/response-queue
 *
 * Returns communications awaiting our response, categorized by urgency:
 * - overdue: Past due
 * - due_soon: Within 2 hours
 * - upcoming: More than 2 hours
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CommunicationWithRelations } from '@/types/communicationHub';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const userId = searchParams.get('user_id');

  // Get all communications awaiting our response
  let query = supabase
    .from('communications')
    .select(`
      *,
      company:companies(id, name, domain),
      contact:contacts(id, name, email)
    `)
    .eq('awaiting_our_response', true)
    .is('responded_at', null)
    .order('response_due_by', { ascending: true, nullsFirst: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Response Queue API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Categorize by urgency
  const now = new Date();
  const categorized = {
    overdue: [] as (CommunicationWithRelations & { hours_overdue: number })[],
    due_soon: [] as (CommunicationWithRelations & { hours_remaining: number })[],
    upcoming: [] as (CommunicationWithRelations & { hours_remaining?: number })[],
  };

  for (const comm of (data || []) as CommunicationWithRelations[]) {
    if (!comm.response_due_by) {
      categorized.upcoming.push(comm);
      continue;
    }

    const dueBy = new Date(comm.response_due_by);
    const hoursUntilDue = (dueBy.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDue < 0) {
      categorized.overdue.push({ ...comm, hours_overdue: Math.abs(hoursUntilDue) });
    } else if (hoursUntilDue <= 2) {
      categorized.due_soon.push({ ...comm, hours_remaining: hoursUntilDue });
    } else {
      categorized.upcoming.push({ ...comm, hours_remaining: hoursUntilDue });
    }
  }

  return NextResponse.json({
    response_queue: categorized,
    total: data?.length || 0,
  });
}
