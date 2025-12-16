import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Award, User, Shield, Bell, Upload, Link2, Sparkles, FileText } from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import { TeamManagement } from '@/components/settings/TeamManagement';

const levelLabels: Record<string, { name: string; color: string }> = {
  l1_foundation: { name: 'L1 Foundation', color: 'bg-gray-100 text-gray-700' },
  l2_established: { name: 'L2 Established', color: 'bg-blue-100 text-blue-700' },
  l3_senior: { name: 'L3 Senior', color: 'bg-purple-100 text-purple-700' },
};

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

  const earnedCertIds = new Set(
    userCertifications?.map((uc) => uc.certification_id) || []
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Profile Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          </div>

          {profile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <p className="text-gray-900">{profile.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <p className="text-gray-900">{profile.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <p className="text-gray-900 capitalize">{profile.role}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team
                </label>
                <p className="text-gray-900 uppercase">{profile.team}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Experience Level
                </label>
                <span
                  className={cn(
                    'inline-flex px-2.5 py-0.5 rounded-full text-sm font-medium',
                    levelLabels[profile.level]?.color || 'bg-gray-100 text-gray-700'
                  )}
                >
                  {levelLabels[profile.level]?.name || profile.level}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hire Date
                </label>
                <p className="text-gray-900">{formatDate(profile.hire_date)}</p>
              </div>
              {profile.territory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Territory
                  </label>
                  <p className="text-gray-900">{profile.territory}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Profile not found</p>
          )}
        </div>

        {/* Team Members Section */}
        <TeamManagement
          users={allUsers || []}
          currentUserId={profile?.id || ''}
        />

        {/* Data Management Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Upload className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Data Management</h2>
          </div>

          <div className="space-y-4">
            <Link
              href="/settings/import"
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <div>
                <p className="font-medium text-gray-900 group-hover:text-blue-700">
                  Import Data
                </p>
                <p className="text-sm text-gray-500">
                  Import companies, contacts, and deals from CSV files
                </p>
              </div>
              <span className="text-gray-400 group-hover:text-blue-600">&rarr;</span>
            </Link>
          </div>
        </div>

        {/* Integrations Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Link2 className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
          </div>

          <div className="space-y-4">
            <Link
              href="/settings/integrations"
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <div>
                <p className="font-medium text-gray-900 group-hover:text-blue-700">
                  Microsoft 365
                </p>
                <p className="text-sm text-gray-500">
                  Connect to sync emails and calendar events
                </p>
              </div>
              <span className="text-gray-400 group-hover:text-blue-600">&rarr;</span>
            </Link>
          </div>
        </div>

        {/* AI Settings Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">AI Settings</h2>
          </div>

          <div className="space-y-4">
            <Link
              href="/settings/ai-prompts"
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <div>
                <p className="font-medium text-gray-900 group-hover:text-blue-700">
                  AI Prompts
                </p>
                <p className="text-sm text-gray-500">
                  Edit and customize the prompts used by AI features
                </p>
              </div>
              <span className="text-gray-400 group-hover:text-blue-600">&rarr;</span>
            </Link>
            <Link
              href="/settings/transcripts"
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-400 group-hover:text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900 group-hover:text-blue-700">
                    Transcripts Log
                  </p>
                  <p className="text-sm text-gray-500">
                    View all synced meeting transcripts and their analysis status
                  </p>
                </div>
              </div>
              <span className="text-gray-400 group-hover:text-blue-600">&rarr;</span>
            </Link>
          </div>
        </div>

        {/* Certifications Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Award className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Certifications
            </h2>
          </div>

          <div className="space-y-4">
            {/* Earned Certifications */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Earned ({userCertifications?.length || 0})
              </h3>
              {userCertifications && userCertifications.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {userCertifications.map((uc) => (
                    <div
                      key={uc.certification_id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200"
                    >
                      <Award className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {uc.certification.name
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </p>
                        <p className="text-sm text-gray-500">
                          Earned {formatDate(uc.certified_at)}
                        </p>
                        {uc.expires_at && (
                          <p className="text-xs text-orange-600 mt-1">
                            Expires {formatDate(uc.expires_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No certifications earned yet</p>
              )}
            </div>

            {/* Available Certifications */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Available Certifications
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allCertifications
                  ?.filter((c) => !earnedCertIds.has(c.id))
                  .map((cert) => (
                    <div
                      key={cert.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200"
                    >
                      <Award className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {cert.name
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </p>
                        <p className="text-sm text-gray-500">{cert.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Required for: {cert.required_for_products.join(', ')}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-500">
                  Receive email updates about your deals
                </p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Task Reminders</p>
                <p className="text-sm text-gray-500">
                  Get reminded about upcoming tasks
                </p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">AI Recommendations</p>
                <p className="text-sm text-gray-500">
                  Receive AI-generated suggestions and insights
                </p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Security</h2>
          </div>

          <div className="space-y-4">
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Change Password
            </button>
            <div className="pt-4 border-t border-gray-200">
              <button className="text-red-600 hover:text-red-700 text-sm font-medium">
                Sign out of all devices
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
