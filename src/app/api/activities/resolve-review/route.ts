import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/activities/resolve-review
 *
 * Resolves an activity review task by either:
 * - Matching the activity to a deal
 * - Excluding the activity as not relevant
 *
 * Body:
 * {
 *   activityId: string,
 *   action: 'match' | 'exclude',
 *   dealId?: string,        // Required if action is 'match'
 *   companyId?: string,     // Optional, for matching
 *   excludeReason?: string  // Optional, for exclusion
 * }
 */
export async function POST(request: NextRequest) {
  const authSupabase = await createClient();

  // Check authentication
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get current user profile
  const { data: profile } = await authSupabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 401 });
  }

  // Use admin client for updates
  const supabase = createAdminClient();

  const body = await request.json();
  const { activityId, action, dealId, companyId, excludeReason } = body;

  if (!activityId) {
    return NextResponse.json({ error: 'activityId is required' }, { status: 400 });
  }

  if (!action || !['match', 'exclude'].includes(action)) {
    return NextResponse.json({ error: 'action must be "match" or "exclude"' }, { status: 400 });
  }

  if (action === 'match' && !dealId) {
    return NextResponse.json({ error: 'dealId is required for match action' }, { status: 400 });
  }

  // Fetch the activity
  const { data: activity, error: fetchError } = await supabase
    .from('activities')
    .select('id, subject, type, deal_id, company_id, match_status')
    .eq('id', activityId)
    .single();

  if (fetchError || !activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
  }

  if (action === 'match') {
    // Verify the deal exists
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, name, company_id')
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Update the activity
    const { error: updateError } = await supabase
      .from('activities')
      .update({
        deal_id: dealId,
        company_id: companyId || deal.company_id,
        match_status: 'matched',
        match_confidence: 1.0,
        match_reasoning: `Manually matched by user to deal: ${deal.name}`,
        matched_at: new Date().toISOString(),
        exclude_reason: null,
      })
      .eq('id', activityId);

    if (updateError) {
      console.error('Error updating activity:', updateError);
      return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
    }

    // Find and complete any associated review tasks
    await supabase
      .from('tasks')
      .update({ completed_at: new Date().toISOString() })
      .eq('source', 'ai_recommendation')
      .ilike('description', `%${activityId}%`)
      .is('completed_at', null);

    return NextResponse.json({
      success: true,
      message: `Activity matched to deal: ${deal.name}`,
      activity: {
        id: activityId,
        dealId,
        companyId: companyId || deal.company_id,
        matchStatus: 'matched',
      },
    });

  } else if (action === 'exclude') {
    // Update the activity as excluded
    const { error: updateError } = await supabase
      .from('activities')
      .update({
        match_status: 'excluded',
        match_confidence: 1.0,
        match_reasoning: 'Manually excluded by user',
        matched_at: new Date().toISOString(),
        exclude_reason: excludeReason || 'Not relevant to any deal',
      })
      .eq('id', activityId);

    if (updateError) {
      console.error('Error updating activity:', updateError);
      return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
    }

    // Find and complete any associated review tasks
    await supabase
      .from('tasks')
      .update({ completed_at: new Date().toISOString() })
      .eq('source', 'ai_recommendation')
      .ilike('description', `%${activityId}%`)
      .is('completed_at', null);

    return NextResponse.json({
      success: true,
      message: 'Activity excluded from deals',
      activity: {
        id: activityId,
        matchStatus: 'excluded',
        excludeReason: excludeReason || 'Not relevant to any deal',
      },
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

/**
 * GET /api/activities/resolve-review?status=review_needed
 *
 * Get activities that need review
 */
export async function GET(request: NextRequest) {
  const authSupabase = await createClient();

  // Check authentication
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || 'review_needed';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

  const { data: activities, error, count } = await supabase
    .from('activities')
    .select(`
      id,
      type,
      subject,
      body,
      occurred_at,
      metadata,
      external_id,
      deal_id,
      company_id,
      match_status,
      match_confidence,
      match_reasoning,
      exclude_reason,
      company:companies(id, name),
      deal:deals(id, name, stage)
    `, { count: 'exact' })
    .eq('match_status', status)
    .like('external_id', 'pst_%')
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }

  return NextResponse.json({
    activities: activities || [],
    count: count || 0,
    status,
  });
}
