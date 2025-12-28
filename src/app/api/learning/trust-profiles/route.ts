import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getRepTrustProfile,
  getTrustLeaderboard,
  getTrustRecommendations,
} from '@/lib/ai/learning';

/**
 * GET /api/learning/trust-profiles
 *
 * Get trust profile for current user or leaderboard
 */
export async function GET(request: NextRequest) {
  try {
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await authSupabase
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view') || 'self'; // 'self' | 'leaderboard'

    if (view === 'leaderboard') {
      // Only managers can see leaderboard
      if (!['admin', 'manager'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const limit = parseInt(searchParams.get('limit') || '10');
      const leaderboard = await getTrustLeaderboard(limit);

      return NextResponse.json({ leaderboard });
    }

    // Get own profile
    const trustProfile = await getRepTrustProfile(profile.id);
    const recommendations = getTrustRecommendations(trustProfile);

    return NextResponse.json({
      profile: trustProfile,
      recommendations,
    });
  } catch (error) {
    console.error('[API] GET /api/learning/trust-profiles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
