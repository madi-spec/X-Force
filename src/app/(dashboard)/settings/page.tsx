import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SettingsTabs } from '@/components/settings/SettingsTabs';

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get current user profile with certifications
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single();

  // Get user certifications
  const { data: userCertifications } = await supabase
    .from('rep_certifications')
    .select(`
      *,
      certification:certifications(*)
    `)
    .eq('user_id', profile?.id);

  // Get all available certifications
  const { data: allCertifications } = await supabase
    .from('certifications')
    .select('*')
    .order('name');

  // Get all users for team management
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, email, role, team')
    .order('name');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-normal text-gray-900">Settings</h1>
        <p className="text-xs text-gray-500 mt-1">
          Manage your account, team, and integrations
        </p>
      </div>

      <SettingsTabs
        profile={profile}
        userCertifications={userCertifications || []}
        allCertifications={allCertifications || []}
        allUsers={allUsers || []}
      />
    </div>
  );
}
