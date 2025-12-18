'use client';

import { useState } from 'react';
import { Users, Database, Sparkles, Bell, User, Award, Shield, Upload, Link2, FileText, ClipboardCheck, Loader2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import { TeamManagement } from './TeamManagement';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  level: string;
  hire_date: string;
  territory?: string;
  title?: string;
  phone?: string;
}

interface Certification {
  id: string;
  name: string;
  description: string;
  required_for_products: string[];
}

interface UserCertification {
  certification_id: string;
  certified_at: string;
  expires_at?: string;
  certification: Certification;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
}

interface SettingsTabsProps {
  profile: UserProfile | null;
  userCertifications: UserCertification[];
  allCertifications: Certification[];
  allUsers: TeamUser[];
}

const tabs = [
  { id: 'people', label: 'People', icon: Users },
  { id: 'data', label: 'Data & Integrations', icon: Database },
  { id: 'ai', label: 'AI Settings', icon: Sparkles },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const levelLabels: Record<string, { name: string; color: string }> = {
  l1_foundation: { name: 'L1 Foundation', color: 'bg-gray-100 text-gray-700' },
  l2_established: { name: 'L2 Established', color: 'bg-blue-100 text-blue-700' },
  l3_senior: { name: 'L3 Senior', color: 'bg-purple-100 text-purple-700' },
};

export function SettingsTabs({ profile, userCertifications, allCertifications, allUsers }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState('people');
  const supabase = createClient();

  // Editable profile fields
  const [title, setTitle] = useState(profile?.title || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveProfile = async () => {
    if (!profile?.id) return;

    setSaving(true);
    setSaved(false);

    try {
      const { error } = await supabase
        .from('users')
        .update({ title, phone })
        .eq('id', profile.id);

      if (error) throw error;

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const earnedCertIds = new Set(userCertifications?.map((uc) => uc.certification_id) || []);

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8" aria-label="Settings tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* People Tab */}
        {activeTab === 'people' && (
          <>
            {/* Profile Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <User className="h-5 w-5 text-gray-500" />
                <h2 className="text-base font-medium text-gray-900">Profile</h2>
              </div>

              {profile ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <p className="text-gray-900">{profile.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <p className="text-gray-900">{profile.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <p className="text-gray-900 capitalize">{profile.role}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                      <p className="text-gray-900 uppercase">{profile.team}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hire Date</label>
                      <p className="text-gray-900">{formatDate(profile.hire_date)}</p>
                    </div>
                    {profile.territory && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Territory</label>
                        <p className="text-gray-900">{profile.territory}</p>
                      </div>
                    )}
                  </div>

                  {/* Editable Email Signature Fields */}
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Email Signature</h3>
                    <p className="text-xs text-gray-500 mb-4">These fields will appear in your email signature when sending emails.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g., Sales Representative"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="e.g., (555) 123-4567"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : saved ? (
                          <Check className="h-4 w-4" />
                        ) : null}
                        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                      </button>
                      {saved && (
                        <span className="text-sm text-green-600">Changes saved successfully</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">Profile not found</p>
              )}
            </div>

            {/* Team Members Section */}
            <TeamManagement users={allUsers || []} currentUserId={profile?.id || ''} />

            {/* Certifications Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Award className="h-5 w-5 text-gray-500" />
                <h2 className="text-base font-medium text-gray-900">Certifications</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Earned ({userCertifications?.length || 0})
                  </h3>
                  {userCertifications && userCertifications.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {userCertifications.map((uc) => (
                        <div
                          key={uc.certification_id}
                          className="flex items-start gap-3 p-3 rounded-xl bg-green-50 border border-green-200"
                        >
                          <Award className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-900">
                              {uc.certification.name
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </p>
                            <p className="text-sm text-gray-500">Earned {formatDate(uc.certified_at)}</p>
                            {uc.expires_at && (
                              <p className="text-xs text-orange-600 mt-1">Expires {formatDate(uc.expires_at)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No certifications earned yet</p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Available Certifications</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {allCertifications
                      ?.filter((c) => !earnedCertIds.has(c.id))
                      .map((cert) => (
                        <div
                          key={cert.id}
                          className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200"
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

            {/* Security Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="h-5 w-5 text-gray-500" />
                <h2 className="text-base font-medium text-gray-900">Security</h2>
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
          </>
        )}

        {/* Data & Integrations Tab */}
        {activeTab === 'data' && (
          <>
            {/* Data Management Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Upload className="h-5 w-5 text-gray-500" />
                <h2 className="text-base font-medium text-gray-900">Data Import</h2>
              </div>

              <div className="space-y-4">
                <Link
                  href="/settings/import"
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <div>
                    <p className="font-medium text-gray-900 group-hover:text-blue-700">Import Data</p>
                    <p className="text-sm text-gray-500">Import companies, contacts, and deals from CSV files</p>
                  </div>
                  <span className="text-gray-400 group-hover:text-blue-600">&rarr;</span>
                </Link>
                <Link
                  href="/settings/activity-review"
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <ClipboardCheck className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="font-medium text-gray-900 group-hover:text-amber-700">Activity Review</p>
                      <p className="text-sm text-gray-500">
                        Review and match imported emails and calendar events to deals
                      </p>
                    </div>
                  </div>
                  <span className="text-gray-400 group-hover:text-amber-600">&rarr;</span>
                </Link>
              </div>
            </div>

            {/* Integrations Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Link2 className="h-5 w-5 text-gray-500" />
                <h2 className="text-base font-medium text-gray-900">Integrations</h2>
              </div>

              <div className="space-y-4">
                <Link
                  href="/settings/integrations"
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <div>
                    <p className="font-medium text-gray-900 group-hover:text-blue-700">Microsoft 365</p>
                    <p className="text-sm text-gray-500">Connect to sync emails and calendar events</p>
                  </div>
                  <span className="text-gray-400 group-hover:text-blue-600">&rarr;</span>
                </Link>
              </div>
            </div>
          </>
        )}

        {/* AI Settings Tab */}
        {activeTab === 'ai' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="h-5 w-5 text-gray-500" />
              <h2 className="text-base font-medium text-gray-900">AI Configuration</h2>
            </div>

            <div className="space-y-4">
              <Link
                href="/settings/ai-prompts"
                className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <div>
                  <p className="font-medium text-gray-900 group-hover:text-blue-700">AI Prompts</p>
                  <p className="text-sm text-gray-500">Edit and customize the prompts used by AI features</p>
                </div>
                <span className="text-gray-400 group-hover:text-blue-600">&rarr;</span>
              </Link>
              <Link
                href="/settings/transcripts"
                className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400 group-hover:text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900 group-hover:text-blue-700">Transcripts Log</p>
                    <p className="text-sm text-gray-500">
                      View all synced meeting transcripts and their analysis status
                    </p>
                  </div>
                </div>
                <span className="text-gray-400 group-hover:text-blue-600">&rarr;</span>
              </Link>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="h-5 w-5 text-gray-500" />
              <h2 className="text-base font-medium text-gray-900">Notification Preferences</h2>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-500">Receive email updates about your deals</p>
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
                  <p className="text-sm text-gray-500">Get reminded about upcoming tasks</p>
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
                  <p className="text-sm text-gray-500">Receive AI-generated suggestions and insights</p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Deal Updates</p>
                  <p className="text-sm text-gray-500">Get notified when deals are updated by team members</p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Weekly Summary</p>
                  <p className="text-sm text-gray-500">Receive a weekly summary of your pipeline activity</p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
