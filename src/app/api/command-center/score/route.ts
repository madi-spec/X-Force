/**
 * Momentum Score Recalculation API
 *
 * POST - Recalculate scores for all pending items
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { refreshAllScores } from '@/lib/commandCenter';

export async function POST(request: NextRequest) {
  try {
    const supabaseClient = await createClient();
    const {
      data: { user: authUser },
    } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get internal user ID
    const adminClient = createAdminClient();
    const { data: dbUser } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Recalculate all scores for this user
    const result = await refreshAllScores(dbUser.id);

    return NextResponse.json({
      success: true,
      items_updated: result.updated,
      items_failed: result.failed,
      refreshed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CommandCenter/Score] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
