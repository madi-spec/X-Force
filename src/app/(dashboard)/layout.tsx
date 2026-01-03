import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/shared/Sidebar';
import { Header } from '@/components/shared/Header';
import { LensProvider } from '@/lib/lens';
import { FocusProvider } from '@/lib/focus';
import { UnifiedShell } from '@/components/shell';
import { isFeatureEnabled } from '@/lib/features';
import { buildUserFocusPermissions, UserRole } from '@/lib/rbac';
import { LensType } from '@/lib/lens/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single();

  // Check if unified shell is enabled
  const useUnifiedShell = isFeatureEnabled('unifiedShell');

  if (useUnifiedShell) {
    // Build initial permissions server-side for faster hydration
    const role = mapDbRoleToUserRole(profile?.role);
    const currentLens = profile?.focus_lens_preference as LensType | undefined;
    const initialPermissions = buildUserFocusPermissions(
      profile?.id || user.id,
      role,
      currentLens
    );

    return (
      <FocusProvider initialPermissions={initialPermissions}>
        <UnifiedShell
          user={profile ? { name: profile.name, email: profile.email } : undefined}
        >
          {children}
        </UnifiedShell>
      </FocusProvider>
    );
  }

  // Legacy layout (fallback)
  return (
    <LensProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header
            user={profile ? { name: profile.name, email: profile.email } : undefined}
          />
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </LensProvider>
  );
}

/**
 * Map database role string to UserRole enum
 */
function mapDbRoleToUserRole(dbRole: string | null | undefined): UserRole {
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
