import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateFirefliesSettings, getFirefliesConnectionStatus } from '@/lib/fireflies';

/**
 * Update Fireflies settings
 * PATCH /api/integrations/fireflies/settings
 */
export async function PATCH(request: NextRequest) {
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

  // Parse request body
  const body = await request.json();
  const { autoAnalyze, autoCreateDrafts, autoCreateTasks } = body;

  // Update settings
  const success = await updateFirefliesSettings(profile.id, {
    autoAnalyze,
    autoCreateDrafts,
    autoCreateTasks,
  });

  return NextResponse.json({ success });
}
