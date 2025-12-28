/**
 * Sync Progress API
 *
 * GET /api/sync/progress
 * Returns current sync progress for the user.
 * UI can poll this to show real-time progress.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabaseClient = await createClient();
    const { data: { user: authUser } } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get internal user ID
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, initial_sync_complete, initial_sync_started_at, initial_sync_completed_at')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get current progress
    const { data: progress } = await supabase
      .from('sync_progress')
      .select('*')
      .eq('user_id', dbUser.id)
      .single();

    // Determine overall status
    let status: 'not_started' | 'in_progress' | 'completed' | 'failed';

    if (dbUser.initial_sync_complete) {
      status = 'completed';
    } else if (progress?.phase === 'error') {
      status = 'failed';
    } else if (progress) {
      status = 'in_progress';
    } else {
      status = 'not_started';
    }

    return NextResponse.json({
      status,
      initial_sync_complete: dbUser.initial_sync_complete,
      initial_sync_started_at: dbUser.initial_sync_started_at,
      initial_sync_completed_at: dbUser.initial_sync_completed_at,
      progress: progress ? {
        phase: progress.phase,
        total: progress.total,
        processed: progress.processed,
        current_item: progress.current_item,
        started_at: progress.started_at,
        updated_at: progress.updated_at,
        percent_complete: progress.total > 0
          ? Math.round((progress.processed / progress.total) * 100)
          : 0,
      } : null,
    });
  } catch (error) {
    console.error('[SyncProgressAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get progress' },
      { status: 500 }
    );
  }
}
