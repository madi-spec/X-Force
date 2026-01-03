import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  UserRole,
  buildUserFocusPermissions,
  UserFocusPermissions,
} from '@/lib/rbac';
import { LensType } from '@/lib/lens/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/focus/permissions
 *
 * Returns the current user's focus lens permissions based on their role.
 * This endpoint provides server-authoritative permission data.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, role, focus_lens_preference')
      .eq('auth_id', user.id)
      .single();

    if (profileError || !profile) {
      // Default to admin role if no profile (for development)
      const defaultPermissions = buildUserFocusPermissions(
        user.id,
        'admin',
        undefined
      );
      return NextResponse.json(defaultPermissions);
    }

    // Map database role to our role type (with fallback)
    const role = mapDbRoleToUserRole(profile.role);
    const currentLens = profile.focus_lens_preference as LensType | undefined;

    const permissions = buildUserFocusPermissions(
      profile.id,
      role,
      currentLens
    );

    return NextResponse.json(permissions);
  } catch (error) {
    console.error('[Focus Permissions API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch focus permissions' },
      { status: 500 }
    );
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

  // Default to admin for development/testing
  return 'admin';
}
