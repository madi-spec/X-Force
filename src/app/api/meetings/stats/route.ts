import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';

/**
 * GET /api/meetings/stats
 *
 * Returns meeting statistics for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    const weekStart = startOfWeek(now).toISOString();
    const weekEnd = endOfWeek(now).toISOString();

    // Run all counts in parallel
    const [todayResult, weekResult, analyzedResult, pendingActionsResult, processingResult] = await Promise.all([
      // Today's meetings
      supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'meeting')
        .eq('user_id', profile.id)
        .is('excluded_at', null)
        .gte('occurred_at', todayStart)
        .lte('occurred_at', todayEnd),

      // This week's meetings
      supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'meeting')
        .eq('user_id', profile.id)
        .is('excluded_at', null)
        .gte('occurred_at', weekStart)
        .lte('occurred_at', weekEnd),

      // Analyzed transcripts
      supabase
        .from('meeting_transcriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .not('analysis', 'is', null),

      // Pending action items
      supabase
        .from('action_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .neq('status', 'done'),

      // Processing transcripts
      supabase
        .from('meeting_transcriptions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .in('status', ['pending', 'processing']),
    ]);

    return NextResponse.json({
      today_count: todayResult.count || 0,
      this_week_count: weekResult.count || 0,
      analyzed_count: analyzedResult.count || 0,
      pending_actions_count: pendingActionsResult.count || 0,
      processing_count: processingResult.count || 0,
    });
  } catch (error) {
    console.error('[Meetings Stats API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
