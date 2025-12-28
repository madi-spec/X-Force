import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateTriggerAccuracy, TriggerType } from '@/lib/ai/leverage';
import {
  recordMomentCompleted,
  recordMomentDismissed,
  recordMomentOutcome,
  recordTriggerDismissed,
} from '@/lib/ai/learning';

/**
 * GET /api/leverage-moments/[id]
 *
 * Get a specific leverage moment with full details.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authSupabase = await createClient();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: moment, error } = await supabase
    .from('human_leverage_moments')
    .select(
      `
      *,
      company:companies(id, name, domain),
      deal:deals(id, name, stage, estimated_value, expected_close_date),
      contact:contacts(id, name, title, email, phone)
    `
    )
    .eq('id', id)
    .single();

  if (error || !moment) {
    return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
  }

  return NextResponse.json({ moment });
}

/**
 * PATCH /api/leverage-moments/[id]
 *
 * Update a leverage moment's status.
 * Body: {
 *   action: 'acknowledge' | 'complete' | 'dismiss' | 'record_outcome',
 *   outcome?: 'successful' | 'unsuccessful' | 'unknown',
 *   outcomeNotes?: string,
 *   dismissReason?: string
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authSupabase = await createClient();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user profile
  const { data: profile } = await authSupabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const body = await request.json();
  const { action, outcome, outcomeNotes, dismissReason } = body;

  if (!action || !['acknowledge', 'complete', 'dismiss', 'record_outcome'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be one of: acknowledge, complete, dismiss, record_outcome' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Get current moment
  const { data: moment, error: fetchError } = await supabase
    .from('human_leverage_moments')
    .select('id, type, status, created_at')
    .eq('id', id)
    .single();

  if (fetchError || !moment) {
    return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
  }

  const now = new Date();
  let updateData: Record<string, unknown> = {};
  let trustUpdate = null;

  switch (action) {
    case 'acknowledge':
      if (moment.status !== 'pending') {
        return NextResponse.json(
          { error: 'Can only acknowledge pending moments' },
          { status: 400 }
        );
      }
      updateData = {
        status: 'acknowledged',
        acknowledged_at: now.toISOString(),
      };
      break;

    case 'complete':
      if (!['pending', 'acknowledged'].includes(moment.status)) {
        return NextResponse.json(
          { error: 'Can only complete pending or acknowledged moments' },
          { status: 400 }
        );
      }

      // Calculate response time in hours
      const createdAt = new Date(moment.created_at);
      const responseTimeHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

      updateData = {
        status: 'completed',
        completed_at: now.toISOString(),
        outcome: outcome || 'unknown',
        outcome_notes: outcomeNotes || null,
      };

      // Update rep trust profile
      try {
        trustUpdate = await recordMomentCompleted(profile.id, id, responseTimeHours);
        console.log('[Leverage] Trust update:', trustUpdate);
      } catch (err) {
        console.error('[Leverage] Trust update error:', err);
      }

      // Update trigger accuracy if outcome provided
      if (outcome && outcome !== 'unknown') {
        await updateTriggerAccuracy(moment.type as TriggerType, outcome === 'successful');
      }
      break;

    case 'dismiss':
      if (!['pending', 'acknowledged'].includes(moment.status)) {
        return NextResponse.json(
          { error: 'Can only dismiss pending or acknowledged moments' },
          { status: 400 }
        );
      }
      updateData = {
        status: 'dismissed',
        dismissed_at: now.toISOString(),
        dismissed_reason: dismissReason || null,
      };

      // Update rep trust profile
      try {
        trustUpdate = await recordMomentDismissed(profile.id, id, dismissReason || 'No reason given');
        console.log('[Leverage] Trust update:', trustUpdate);
      } catch (err) {
        console.error('[Leverage] Trust update error:', err);
      }

      // Update calibration tracking
      await recordTriggerDismissed(moment.type);
      break;

    case 'record_outcome':
      if (moment.status !== 'completed') {
        return NextResponse.json(
          { error: 'Can only record outcome for completed moments' },
          { status: 400 }
        );
      }
      if (!outcome || !['successful', 'unsuccessful'].includes(outcome)) {
        return NextResponse.json(
          { error: 'outcome must be successful or unsuccessful' },
          { status: 400 }
        );
      }

      updateData = {
        outcome,
        outcome_notes: outcomeNotes || null,
      };

      // Update rep trust profile with outcome
      try {
        trustUpdate = await recordMomentOutcome(profile.id, id, outcome, outcomeNotes);
        console.log('[Leverage] Outcome trust update:', trustUpdate);
      } catch (err) {
        console.error('[Leverage] Outcome trust update error:', err);
      }
      break;
  }

  const { data: updated, error: updateError } = await supabase
    .from('human_leverage_moments')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('[Leverage Moments] Error updating:', updateError);
    return NextResponse.json({ error: 'Failed to update moment' }, { status: 500 });
  }

  return NextResponse.json({
    message: `Moment ${action === 'record_outcome' ? 'outcome recorded' : action + 'd'} successfully`,
    moment: updated,
    trustUpdate,
  });
}
