import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCalibrationStats } from '@/lib/ai/learning';

/**
 * GET /api/learning/calibration
 *
 * Get calibration statistics for trigger types
 */
export async function GET(request: NextRequest) {
  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single();

  // Only managers/admins can see calibration stats
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const stats = await getCalibrationStats();

  // Calculate overall metrics
  const totals = stats.reduce(
    (acc, s) => ({
      fired: acc.fired + s.total_fired,
      completed: acc.completed + s.total_completed,
      successful: acc.successful + s.total_successful,
      dismissed: acc.dismissed + s.total_dismissed,
    }),
    { fired: 0, completed: 0, successful: 0, dismissed: 0 }
  );

  const overallSuccessRate = totals.completed > 0
    ? Math.round((totals.successful / totals.completed) * 100)
    : 0;

  const overallCompletionRate = totals.fired > 0
    ? Math.round((totals.completed / totals.fired) * 100)
    : 0;

  return NextResponse.json({
    byTriggerType: stats,
    overall: {
      totalFired: totals.fired,
      totalCompleted: totals.completed,
      totalSuccessful: totals.successful,
      totalDismissed: totals.dismissed,
      successRate: overallSuccessRate,
      completionRate: overallCompletionRate,
    },
  });
}
