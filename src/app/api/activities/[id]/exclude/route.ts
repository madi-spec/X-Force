import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/activities/[id]/exclude
 *
 * Excludes an activity (meeting) from the hub view.
 *
 * Body:
 * - reason?: string - Optional reason for exclusion
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;

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

    // Parse request body
    let reason: string | null = null;
    try {
      const body = await request.json();
      reason = body.reason || null;
    } catch {
      // No body or invalid JSON is fine
    }

    // Verify activity exists and belongs to user
    const { data: activity, error: fetchError } = await supabase
      .from('activities')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    if (activity.user_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use admin client for update to bypass RLS (we've already verified ownership above)
    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient
      .from('activities')
      .update({
        excluded_at: new Date().toISOString(),
        excluded_by: user.id,
        exclusion_reason: reason,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[Exclude API] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to exclude activity' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Activity excluded' });

  } catch (error) {
    console.error('[Exclude API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to exclude activity' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/activities/[id]/exclude
 *
 * Restores an excluded activity to the hub view.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;

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

    // Verify activity exists and belongs to user
    const { data: activity, error: fetchError } = await supabase
      .from('activities')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    if (activity.user_id !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use admin client for update to bypass RLS (we've already verified ownership above)
    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient
      .from('activities')
      .update({
        excluded_at: null,
        excluded_by: null,
        exclusion_reason: null,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[Exclude API] Restore error:', updateError);
      return NextResponse.json({ error: 'Failed to restore activity' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Activity restored' });

  } catch (error) {
    console.error('[Exclude API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to restore activity' },
      { status: 500 }
    );
  }
}
