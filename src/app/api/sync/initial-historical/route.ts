/**
 * Initial Historical Sync API
 *
 * POST /api/sync/initial-historical
 * Starts the comprehensive initial sync in the background.
 * Returns immediately with status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runInitialHistoricalSync } from '@/lib/sync/initialHistoricalSync';

export async function POST(request: NextRequest) {
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
      .select('id, initial_sync_complete, initial_sync_started_at')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if sync already completed
    if (dbUser.initial_sync_complete) {
      return NextResponse.json({
        status: 'already_complete',
        message: 'Initial sync has already been completed',
      });
    }

    // Check if sync is already in progress
    if (dbUser.initial_sync_started_at) {
      const startedAt = new Date(dbUser.initial_sync_started_at);
      const hoursSinceStart = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);

      // If started less than 2 hours ago, assume still in progress
      if (hoursSinceStart < 2) {
        return NextResponse.json({
          status: 'in_progress',
          message: 'Sync is already in progress',
          started_at: dbUser.initial_sync_started_at,
        });
      }
    }

    // Initialize progress record
    await supabase
      .from('sync_progress')
      .upsert({
        user_id: dbUser.id,
        phase: 'init',
        total: 0,
        processed: 0,
        current_item: 'Starting sync...',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    // Start sync in background (don't await)
    // Note: In production, you'd use a proper job queue
    runInitialHistoricalSync(dbUser.id, async (message, phase, current, total) => {
      // Update progress in database
      try {
        await supabase
          .from('sync_progress')
          .upsert({
            user_id: dbUser.id,
            phase: phase || 'processing',
            total: total || 0,
            processed: current || 0,
            current_item: message,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      } catch (err) {
        console.error('[InitialSync] Failed to update progress:', err);
      }
    }).then(result => {
      console.log('[InitialSync] Completed:', result);
    }).catch(err => {
      console.error('[InitialSync] Failed:', err);
    });

    return NextResponse.json({
      status: 'started',
      message: 'Initial sync started. Check /api/sync/progress for updates.',
    });
  } catch (error) {
    console.error('[InitialSyncAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start sync' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabaseClient = await createClient();
    const { data: { user: authUser } } = await supabaseClient.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get internal user ID and sync status
    const { data: dbUser } = await supabase
      .from('users')
      .select('id, initial_sync_complete, initial_sync_started_at, initial_sync_completed_at')
      .eq('auth_id', authUser.id)
      .single();

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      initial_sync_complete: dbUser.initial_sync_complete,
      initial_sync_started_at: dbUser.initial_sync_started_at,
      initial_sync_completed_at: dbUser.initial_sync_completed_at,
    });
  } catch (error) {
    console.error('[InitialSyncAPI] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
