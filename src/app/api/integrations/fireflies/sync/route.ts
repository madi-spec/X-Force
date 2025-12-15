import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncFirefliesTranscripts, getFirefliesConnectionStatus } from '@/lib/fireflies';

/**
 * Trigger manual Fireflies sync
 * POST /api/integrations/fireflies/sync
 */
export async function POST() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check if user has active Fireflies connection
  const status = await getFirefliesConnectionStatus(profile.id);
  if (!status.connected) {
    return NextResponse.json(
      { error: 'No active Fireflies connection' },
      { status: 400 }
    );
  }

  try {
    // Run sync
    const result = await syncFirefliesTranscripts(profile.id);

    return NextResponse.json({
      success: true,
      synced: result.synced,
      analyzed: result.analyzed,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
