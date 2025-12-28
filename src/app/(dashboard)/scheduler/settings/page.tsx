'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Mail,
  MessageSquare,
  Phone,
  Clock,
  Calendar,
  Shield,
  Zap,
  Users,
  RefreshCw,
  Loader2,
  Check,
  X,
  Plus,
  Trash2,
  ArrowLeft,
  AlertCircle,
  Edit2,
  Save,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Sparkles,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ChannelConfig {
  enabled: boolean;
  priority: number;
  max_daily_attempts: number;
  cooldown_hours: number;
  templates: string[];
}

interface GuardrailConfig {
  max_attempts_per_request: number;
  min_hours_between_attempts: number;
  max_active_requests_per_contact: number;
  pause_on_no_response_count: number;
  auto_cancel_after_days: number;
}

interface AvailabilitySlot {
  day: string;
  start_time: string;
  end_time: string;
}

interface EmailSettings {
  from_name: string;
  signature: string;
  include_unsubscribe: boolean;
  track_opens: boolean;
  track_clicks: boolean;
}

interface AutomationSettings {
  auto_send_reminders: boolean;
  reminder_hours_before: number[];
  auto_reschedule_no_shows: boolean;
  auto_close_completed: boolean;
  use_social_proof: boolean;
  social_proof_threshold: number;
}

interface SchedulerSettings {
  channels: Record<string, ChannelConfig>;
  guardrails: GuardrailConfig;
  availability: AvailabilitySlot[];
  email: EmailSettings;
  automation: AutomationSettings;
}

interface SocialProofItem {
  id: string;
  type: string;
  title: string;
  content: string;
  company_name?: string;
  metric_value?: string;
  is_active: boolean;
  usage_count: number;
}

const DEFAULT_SETTINGS: SchedulerSettings = {
  channels: {
    email: { enabled: true, priority: 1, max_daily_attempts: 50, cooldown_hours: 24, templates: [] },
    sms: { enabled: false, priority: 2, max_daily_attempts: 20, cooldown_hours: 48, templates: [] },
    phone: { enabled: false, priority: 3, max_daily_attempts: 10, cooldown_hours: 72, templates: [] },
  },
  guardrails: {
    max_attempts_per_request: 5,
    min_hours_between_attempts: 24,
    max_active_requests_per_contact: 2,
    pause_on_no_response_count: 3,
    auto_cancel_after_days: 30,
  },
  availability: [
    { day: 'Monday', start_time: '09:00', end_time: '17:00' },
    { day: 'Tuesday', start_time: '09:00', end_time: '17:00' },
    { day: 'Wednesday', start_time: '09:00', end_time: '17:00' },
    { day: 'Thursday', start_time: '09:00', end_time: '17:00' },
    { day: 'Friday', start_time: '09:00', end_time: '17:00' },
  ],
  email: {
    from_name: '',
    signature: '',
    include_unsubscribe: true,
    track_opens: true,
    track_clicks: true,
  },
  automation: {
    auto_send_reminders: true,
    reminder_hours_before: [24, 1],
    auto_reschedule_no_shows: false,
    auto_close_completed: true,
    use_social_proof: true,
    social_proof_threshold: 0.3,
  },
};

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-5 w-5" />,
  sms: <MessageSquare className="h-5 w-5" />,
  phone: <Phone className="h-5 w-5" />,
};

export default function SchedulerSettingsPage() {
  const [settings, setSettings] = useState<SchedulerSettings>(DEFAULT_SETTINGS);
  const [socialProof, setSocialProof] = useState<SocialProofItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('channels');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['channels']));

  useEffect(() => {
    fetchSettings();
    fetchSocialProof();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/scheduler/settings');
      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data,
            channels: { ...DEFAULT_SETTINGS.channels, ...data.channels },
            guardrails: { ...DEFAULT_SETTINGS.guardrails, ...data.guardrails },
            email: { ...DEFAULT_SETTINGS.email, ...data.email },
            automation: { ...DEFAULT_SETTINGS.automation, ...data.automation },
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSocialProof = async () => {
    try {
      const res = await fetch('/api/scheduler/social-proof');
      if (res.ok) {
        const { data } = await res.json();
        setSocialProof(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch social proof:', err);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/scheduler/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      setSuccessMessage('Settings saved successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const updateChannel = (channel: string, updates: Partial<ChannelConfig>) => {
    setSettings((prev) => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: { ...prev.channels[channel], ...updates },
      },
    }));
  };

  const updateGuardrails = (updates: Partial<GuardrailConfig>) => {
    setSettings((prev) => ({
      ...prev,
      guardrails: { ...prev.guardrails, ...updates },
    }));
  };

  const updateEmail = (updates: Partial<EmailSettings>) => {
    setSettings((prev) => ({
      ...prev,
      email: { ...prev.email, ...updates },
    }));
  };

  const updateAutomation = (updates: Partial<AutomationSettings>) => {
    setSettings((prev) => ({
      ...prev,
      automation: { ...prev.automation, ...updates },
    }));
  };

  const addAvailabilitySlot = () => {
    setSettings((prev) => ({
      ...prev,
      availability: [
        ...prev.availability,
        { day: 'Monday', start_time: '09:00', end_time: '17:00' },
      ],
    }));
  };

  const removeAvailabilitySlot = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      availability: prev.availability.filter((_, i) => i !== index),
    }));
  };

  const updateAvailabilitySlot = (index: number, updates: Partial<AvailabilitySlot>) => {
    setSettings((prev) => ({
      ...prev,
      availability: prev.availability.map((slot, i) =>
        i === index ? { ...slot, ...updates } : slot
      ),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/calendar" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-normal text-gray-900">Scheduler Settings</h1>
            <p className="text-xs text-gray-500">Configure your scheduling automation</p>
          </div>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700">
          <Check className="h-5 w-5" />
          {successMessage}
        </div>
      )}

      {/* Channel Strategy */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('channels')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-medium text-gray-900">Channel Strategy</h2>
              <p className="text-xs text-gray-500">Configure which channels to use for outreach</p>
            </div>
          </div>
          {expandedSections.has('channels') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('channels') && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            {Object.entries(settings.channels).map(([channel, config]) => (
              <div
                key={channel}
                className={cn(
                  'p-4 rounded-lg border transition-colors',
                  config.enabled
                    ? 'border-blue-200 bg-blue-50/50'
                    : 'border-gray-200 bg-gray-50'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-lg',
                      config.enabled ? 'bg-blue-100' : 'bg-gray-200'
                    )}>
                      {CHANNEL_ICONS[channel]}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 capitalize">{channel}</h3>
                      <p className="text-xs text-gray-500">Priority: {config.priority}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => updateChannel(channel, { enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {config.enabled && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Max Daily Attempts
                      </label>
                      <input
                        type="number"
                        value={config.max_daily_attempts}
                        onChange={(e) =>
                          updateChannel(channel, {
                            max_daily_attempts: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Cooldown (hours)
                      </label>
                      <input
                        type="number"
                        value={config.cooldown_hours}
                        onChange={(e) =>
                          updateChannel(channel, {
                            cooldown_hours: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Priority</label>
                      <select
                        value={config.priority}
                        onChange={(e) =>
                          updateChannel(channel, { priority: parseInt(e.target.value) })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={1}>1 (Highest)</option>
                        <option value={2}>2</option>
                        <option value={3}>3 (Lowest)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guardrails */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('guardrails')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Shield className="h-5 w-5 text-amber-600" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-medium text-gray-900">Guardrails</h2>
              <p className="text-xs text-gray-500">Set limits to prevent over-communication</p>
            </div>
          </div>
          {expandedSections.has('guardrails') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('guardrails') && (
          <div className="border-t border-gray-200 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Max Attempts Per Request
                </label>
                <input
                  type="number"
                  value={settings.guardrails.max_attempts_per_request}
                  onChange={(e) =>
                    updateGuardrails({
                      max_attempts_per_request: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Stop outreach after this many attempts
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Min Hours Between Attempts
                </label>
                <input
                  type="number"
                  value={settings.guardrails.min_hours_between_attempts}
                  onChange={(e) =>
                    updateGuardrails({
                      min_hours_between_attempts: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Wait at least this long between attempts
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Max Active Requests Per Contact
                </label>
                <input
                  type="number"
                  value={settings.guardrails.max_active_requests_per_contact}
                  onChange={(e) =>
                    updateGuardrails({
                      max_active_requests_per_contact: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Limit concurrent scheduling requests
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Pause After No Response Count
                </label>
                <input
                  type="number"
                  value={settings.guardrails.pause_on_no_response_count}
                  onChange={(e) =>
                    updateGuardrails({
                      pause_on_no_response_count: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Pause request if no response after N attempts
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Auto-Cancel After Days
                </label>
                <input
                  type="number"
                  value={settings.guardrails.auto_cancel_after_days}
                  onChange={(e) =>
                    updateGuardrails({
                      auto_cancel_after_days: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Automatically cancel stale requests
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Availability */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('availability')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-medium text-gray-900">Availability</h2>
              <p className="text-xs text-gray-500">Set your available meeting times</p>
            </div>
          </div>
          {expandedSections.has('availability') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('availability') && (
          <div className="border-t border-gray-200 p-4 space-y-3">
            {settings.availability.map((slot, index) => (
              <div key={index} className="flex items-center gap-3">
                <select
                  value={slot.day}
                  onChange={(e) => updateAvailabilitySlot(index, { day: e.target.value })}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>

                <input
                  type="time"
                  value={slot.start_time}
                  onChange={(e) =>
                    updateAvailabilitySlot(index, { start_time: e.target.value })
                  }
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <span className="text-gray-400">to</span>

                <input
                  type="time"
                  value={slot.end_time}
                  onChange={(e) =>
                    updateAvailabilitySlot(index, { end_time: e.target.value })
                  }
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  onClick={() => removeAvailabilitySlot(index)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              onClick={addAvailabilitySlot}
              className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Plus className="h-4 w-4" />
              Add Time Slot
            </button>
          </div>
        )}
      </div>

      {/* Email Settings */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('email')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Mail className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-medium text-gray-900">Email Settings</h2>
              <p className="text-xs text-gray-500">Customize your email outreach</p>
            </div>
          </div>
          {expandedSections.has('email') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('email') && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From Name</label>
              <input
                type="text"
                value={settings.email.from_name}
                onChange={(e) => updateEmail({ from_name: e.target.value })}
                placeholder="Your Name"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Email Signature</label>
              <textarea
                value={settings.email.signature}
                onChange={(e) => updateEmail({ signature: e.target.value })}
                placeholder="Your email signature..."
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.email.include_unsubscribe}
                  onChange={(e) => updateEmail({ include_unsubscribe: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Include unsubscribe link</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.email.track_opens}
                  onChange={(e) => updateEmail({ track_opens: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Track email opens</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.email.track_clicks}
                  onChange={(e) => updateEmail({ track_clicks: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Track link clicks</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Automation Settings */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('automation')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Sparkles className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-medium text-gray-900">Automation</h2>
              <p className="text-xs text-gray-500">Configure automatic actions</p>
            </div>
          </div>
          {expandedSections.has('automation') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('automation') && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.automation.auto_send_reminders}
                  onChange={(e) =>
                    updateAutomation({ auto_send_reminders: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Automatically send meeting reminders
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.automation.auto_reschedule_no_shows}
                  onChange={(e) =>
                    updateAutomation({ auto_reschedule_no_shows: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Auto-reschedule no-shows
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.automation.auto_close_completed}
                  onChange={(e) =>
                    updateAutomation({ auto_close_completed: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Automatically close completed meetings
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.automation.use_social_proof}
                  onChange={(e) =>
                    updateAutomation({ use_social_proof: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Include social proof in outreach
                </span>
              </label>
            </div>

            {settings.automation.use_social_proof && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Social Proof Response Rate Threshold
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={settings.automation.social_proof_threshold}
                  onChange={(e) =>
                    updateAutomation({
                      social_proof_threshold: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Only use social proof with response rate above this threshold (0-1)
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Social Proof Library */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('social_proof')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Star className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-medium text-gray-900">Social Proof Library</h2>
              <p className="text-xs text-gray-500">
                Manage testimonials and case studies
              </p>
            </div>
          </div>
          {expandedSections.has('social_proof') ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('social_proof') && (
          <div className="border-t border-gray-200 p-4">
            {socialProof.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No social proof items yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Add testimonials and case studies to improve response rates
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {socialProof.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'p-3 rounded-lg border',
                      item.is_active ? 'border-green-200 bg-green-50/50' : 'border-gray-200'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {item.title}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600 capitalize">
                            {item.type}
                          </span>
                        </div>
                        {item.company_name && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.company_name}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {item.content}
                        </p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div>Used {item.usage_count}x</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
        <span className="text-sm text-gray-600">Need more options?</span>
        <div className="flex items-center gap-3">
          <Link
            href="/scheduler/analytics"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View Analytics
          </Link>
          <span className="text-gray-300">|</span>
          <Link
            href="/calendar"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Back to Calendar
          </Link>
        </div>
      </div>
    </div>
  );
}
