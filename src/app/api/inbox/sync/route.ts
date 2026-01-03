/**
 * @deprecated - Inbox sync API is deprecated.
 * Email sync now goes directly to communications table via:
 * - syncEmailsDirectToCommunications() from '@/lib/communicationHub'
 * - /api/cron/sync-microsoft
 *
 * This route is kept for backward compatibility but should not be used for new integrations.
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { performInitialSync, setupOutlookFolders, getOutlookFolders } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

// GET - Get sync status
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile user_id (microsoft_connections uses this, not auth user id)
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get sync state
    const { data: syncState } = await supabase
      .from('email_sync_state')
      .select('*')
      .eq('user_id', profile.id)
      .single();

    // Get folder config
    const folders = await getOutlookFolders(profile.id);

    return NextResponse.json({
      syncState,
      folders,
      isConfigured: !!folders?.folders_created,
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

// POST - Trigger sync
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile user_id (microsoft_connections uses this, not auth user id)
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, mode } = body;

    // Setup folders first if needed
    if (action === 'setup') {
      await setupOutlookFolders(profile.id, mode || 'move');
      return NextResponse.json({ success: true, message: 'Folders configured' });
    }

    // Perform initial sync
    const result = await performInitialSync(profile.id);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error syncing:', error);
    return NextResponse.json(
      { error: 'Failed to sync emails' },
      { status: 500 }
    );
  }
}
