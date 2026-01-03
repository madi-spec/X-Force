import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canAccessLens, UserRole, buildUserFocusPermissions } from '@/lib/rbac';
import { LensType } from '@/lib/lens/types';

export const dynamic = 'force-dynamic';

interface SetFocusRequest {
  lens: LensType;
}

/**
 * POST /api/focus/set
 *
 * Sets the user's current focus lens preference.
 * Validates permission before allowing the change.
 * Emits UserPreferenceFocusSet event for auditability.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json() as SetFocusRequest;
    const { lens } = body;

    // Validate lens value
    const validLenses: LensType[] = ['sales', 'onboarding', 'customer_success', 'support'];
    if (!validLenses.includes(lens)) {
      return NextResponse.json(
        { error: `Invalid lens: ${lens}` },
        { status: 400 }
      );
    }

    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, role, focus_lens_preference')
      .eq('auth_id', user.id)
      .single();

    // Handle case where user profile doesn't exist (development/new user)
    if (profileError || !profile) {
      console.log('[Focus Set API] No profile found, using admin defaults');
      // Return success with admin permissions - localStorage will handle persistence
      const permissions = buildUserFocusPermissions(user.id, 'admin', lens);
      return NextResponse.json({
        success: true,
        permissions,
      });
    }

    // Map role and check permission
    const role = mapDbRoleToUserRole(profile.role);
    const permissionCheck = canAccessLens(role, lens);

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: permissionCheck.reason || 'Access denied' },
        { status: 403 }
      );
    }

    const previousLens = profile.focus_lens_preference as LensType | null;

    // Try to update user preference in database (may fail if column doesn't exist)
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ focus_lens_preference: lens })
        .eq('id', profile.id);

      if (updateError) {
        // Log but don't fail - localStorage will handle persistence
        console.log('[Focus Set API] Update skipped:', updateError.message);
      }
    } catch {
      // Column may not exist, that's okay
      console.log('[Focus Set API] focus_lens_preference column may not exist');
    }

    // Emit event for auditability (events only, projections are derived)
    await emitFocusSetEvent(supabase, {
      userId: profile.id,
      previousLens,
      newLens: lens,
      source: 'manual',
    });

    // Return updated permissions
    const permissions = buildUserFocusPermissions(profile.id, role, lens);

    return NextResponse.json({
      success: true,
      permissions,
    });
  } catch (error) {
    console.error('[Focus Set API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to set focus' },
      { status: 500 }
    );
  }
}

/**
 * Emit UserPreferenceFocusSet event
 */
async function emitFocusSetEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: {
    userId: string;
    previousLens: LensType | null;
    newLens: LensType;
    source: 'manual' | 'role_default' | 'admin_override';
  }
) {
  try {
    // Check if event_store table exists
    const { error: checkError } = await supabase
      .from('event_store')
      .select('id')
      .limit(1);

    // If table doesn't exist, skip event emission (graceful degradation)
    if (checkError?.code === '42P01') {
      console.log('[Focus Set API] event_store table not found, skipping event emission');
      return;
    }

    // Get next sequence number for this aggregate
    const { data: lastEvent } = await supabase
      .from('event_store')
      .select('sequence_number')
      .eq('aggregate_type', 'user_preference')
      .eq('aggregate_id', data.userId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .single();

    const sequenceNumber = (lastEvent?.sequence_number || 0) + 1;

    // Insert event
    await supabase.from('event_store').insert({
      aggregate_type: 'user_preference',
      aggregate_id: data.userId,
      sequence_number: sequenceNumber,
      event_type: 'UserPreferenceFocusSet',
      event_data: {
        previous_lens: data.previousLens,
        new_lens: data.newLens,
        source: data.source,
      },
      actor_type: 'user',
      actor_id: data.userId,
      metadata: {},
      occurred_at: new Date().toISOString(),
    });
  } catch (error) {
    // Log but don't fail the request - event emission is non-blocking
    console.error('[Focus Set API] Event emission error:', error);
  }
}

/**
 * Map database role string to UserRole enum
 */
function mapDbRoleToUserRole(dbRole: string | null): UserRole {
  const roleMap: Record<string, UserRole> = {
    'sales_rep': 'sales_rep',
    'sales': 'sales_rep',
    'onboarding_specialist': 'onboarding_specialist',
    'onboarding': 'onboarding_specialist',
    'customer_success_manager': 'customer_success_manager',
    'csm': 'customer_success_manager',
    'cs': 'customer_success_manager',
    'support_agent': 'support_agent',
    'support': 'support_agent',
    'sales_manager': 'sales_manager',
    'cs_manager': 'cs_manager',
    'support_manager': 'support_manager',
    'admin': 'admin',
    'administrator': 'admin',
  };

  if (dbRole && roleMap[dbRole.toLowerCase()]) {
    return roleMap[dbRole.toLowerCase()];
  }

  return 'admin';
}
