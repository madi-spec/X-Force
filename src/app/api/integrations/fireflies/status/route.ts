import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFirefliesConnectionStatus } from '@/lib/fireflies';

/**
 * Get Fireflies connection status
 * GET /api/integrations/fireflies/status
 */
export async function GET() {
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

  // Get connection status
  const status = await getFirefliesConnectionStatus(profile.id);

  if (!status.connected) {
    return NextResponse.json({ connected: false });
  }

  // Return status without exposing the API key
  return NextResponse.json({
    connected: true,
    connection: {
      lastSyncAt: status.connection?.last_sync_at,
      lastSyncStatus: status.connection?.last_sync_status,
      lastSyncError: status.connection?.last_sync_error,
      transcriptsSynced: status.connection?.transcripts_synced,
      autoAnalyze: status.connection?.auto_analyze,
      autoCreateDrafts: status.connection?.auto_create_drafts,
      autoCreateTasks: status.connection?.auto_create_tasks,
    },
  });
}
