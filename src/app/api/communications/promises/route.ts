import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const userId = searchParams.get('user_id');
  const companyId = searchParams.get('company_id');
  const direction = searchParams.get('direction'); // 'we_promised' or 'they_promised'
  const status = searchParams.get('status'); // 'pending', 'completed', 'overdue'
  const includeHidden = searchParams.get('include_hidden') === 'true';

  let query = supabase
    .from('promises')
    .select(`
      *,
      company:companies!company_id(id, name),
      contact:contacts!contact_id(id, name, email),
      source_communication:communications!source_communication_id(id, channel, subject, occurred_at)
    `)
    .order('due_by', { ascending: true, nullsFirst: false });

  // Filters
  if (userId) query = query.eq('owner_user_id', userId);
  if (companyId) query = query.eq('company_id', companyId);
  if (direction) query = query.eq('direction', direction);
  if (status) query = query.eq('status', status);
  if (!includeHidden) query = query.eq('is_hidden', false);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Categorize
  const now = new Date();
  const categorized = {
    overdue: [] as (typeof data extends (infer T)[] | null ? T & { days_overdue?: number } : never)[],
    due_today: [] as typeof data,
    due_this_week: [] as typeof data,
    upcoming: [] as typeof data,
    no_due_date: [] as typeof data,
    completed: [] as typeof data,
  };

  for (const promise of data || []) {
    if (promise.status === 'completed') {
      categorized.completed.push(promise);
      continue;
    }

    if (!promise.due_by) {
      categorized.no_due_date.push(promise);
      continue;
    }

    const dueBy = new Date(promise.due_by);
    const daysUntilDue = (dueBy.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilDue < 0) {
      categorized.overdue.push({ ...promise, days_overdue: Math.abs(daysUntilDue) });
    } else if (daysUntilDue < 1) {
      categorized.due_today.push(promise);
    } else if (daysUntilDue < 7) {
      categorized.due_this_week.push(promise);
    } else {
      categorized.upcoming.push(promise);
    }
  }

  return NextResponse.json({
    promises: categorized,
    total: data?.length || 0,
    counts: {
      overdue: categorized.overdue.length,
      due_today: categorized.due_today.length,
      due_this_week: categorized.due_this_week.length,
      upcoming: categorized.upcoming.length,
      no_due_date: categorized.no_due_date.length,
      completed: categorized.completed.length,
    },
  });
}

// PATCH - Update promise status
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();
  const { promise_id, status, is_hidden } = body;

  if (!promise_id) {
    return NextResponse.json({ error: 'promise_id required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (status) {
    updates.status = status;
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
  }

  if (typeof is_hidden === 'boolean') {
    updates.is_hidden = is_hidden;
  }

  const { data, error } = await supabase
    .from('promises')
    .update(updates)
    .eq('id', promise_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ promise: data });
}
