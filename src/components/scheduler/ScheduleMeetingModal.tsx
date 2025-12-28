'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Users,
  Video,
  Loader2,
  Plus,
  Trash2,
  Building2,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  MEETING_TYPES,
  MEETING_PLATFORMS,
  type MeetingType,
  type MeetingPlatform,
  type PreferredTimes,
  type CreateSchedulingRequestInput,
} from '@/lib/scheduler/types';

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (requestId: string) => void;
  // Pre-fill options
  dealId?: string;
  companyId?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  title?: string;
}

interface Company {
  id: string;
  name: string;
}

interface Deal {
  id: string;
  name: string;
  company_id: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

const MEETING_TYPE_OPTIONS = [
  { value: MEETING_TYPES.DISCOVERY, label: 'Discovery Call', description: 'Initial call to understand needs' },
  { value: MEETING_TYPES.DEMO, label: 'Product Demo', description: 'Show product capabilities' },
  { value: MEETING_TYPES.FOLLOW_UP, label: 'Follow-up', description: 'Continue previous conversation' },
  { value: MEETING_TYPES.TECHNICAL, label: 'Technical Discussion', description: 'Deep dive on technical topics' },
  { value: MEETING_TYPES.EXECUTIVE, label: 'Executive Briefing', description: 'High-level presentation' },
  { value: MEETING_TYPES.CUSTOM, label: 'Custom', description: 'Other meeting type' },
];

const PLATFORM_OPTIONS = [
  { value: MEETING_PLATFORMS.TEAMS, label: 'Microsoft Teams' },
  { value: MEETING_PLATFORMS.ZOOM, label: 'Zoom' },
  { value: MEETING_PLATFORMS.GOOGLE_MEET, label: 'Google Meet' },
  { value: MEETING_PLATFORMS.PHONE, label: 'Phone Call' },
  { value: MEETING_PLATFORMS.IN_PERSON, label: 'In Person' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
];

const DAY_OPTIONS = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
];

export function ScheduleMeetingModal({
  isOpen,
  onClose,
  onSuccess,
  dealId: initialDealId,
  companyId: initialCompanyId,
  contactId,
  contactName,
  contactEmail,
}: ScheduleMeetingModalProps) {
  const supabase = createClient();

  // Form state
  const [meetingType, setMeetingType] = useState<MeetingType>(MEETING_TYPES.DISCOVERY);
  const [duration, setDuration] = useState(30);
  const [platform, setPlatform] = useState<MeetingPlatform>(MEETING_PLATFORMS.TEAMS);
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [location, setLocation] = useState('');

  // Date range
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');

  // Time preferences
  const [preferredTimes, setPreferredTimes] = useState<PreferredTimes>({
    morning: true,
    afternoon: true,
    evening: false,
  });
  const [avoidDays, setAvoidDays] = useState<string[]>([]);

  // Associations
  const [dealId, setDealId] = useState(initialDealId || '');
  const [companyId, setCompanyId] = useState(initialCompanyId || '');

  // Attendees
  const [internalAttendees, setInternalAttendees] = useState<Array<{ user_id: string; is_organizer: boolean }>>([]);
  const [externalAttendees, setExternalAttendees] = useState<Array<{
    contact_id?: string;
    name: string;
    email: string;
    title?: string;
    is_primary_contact: boolean;
  }>>([]);

  // Data for dropdowns
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // Set default date range (next 2 weeks)
  useEffect(() => {
    const today = new Date();
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

    setDateRangeStart(today.toISOString().split('T')[0]);
    setDateRangeEnd(twoWeeksLater.toISOString().split('T')[0]);
  }, []);

  // Pre-fill external attendee if contact info provided
  useEffect(() => {
    if (contactEmail && contactName && externalAttendees.length === 0) {
      setExternalAttendees([{
        contact_id: contactId,
        name: contactName,
        email: contactEmail,
        is_primary_contact: true,
      }]);
    }
  }, [contactId, contactName, contactEmail]);

  // Load data for dropdowns
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoadingData(true);
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('auth_id', user.id)
            .single();

          if (userData) {
            setCurrentUserId(userData.id);
            // Add current user as organizer by default
            if (internalAttendees.length === 0) {
              setInternalAttendees([{ user_id: userData.id, is_organizer: true }]);
            }
          }
        }

        // Load companies
        const { data: companiesData } = await supabase
          .from('companies')
          .select('id, name')
          .order('name');
        if (companiesData) setCompanies(companiesData);

        // Load deals
        const { data: dealsData } = await supabase
          .from('deals')
          .select('id, name, company_id')
          .order('name');
        if (dealsData) setDeals(dealsData);

        // Load users for internal attendees
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email')
          .order('name');
        if (usersData) setUsers(usersData);

        // Load contacts for external attendees
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('id, name, email, title')
          .order('name');
        if (contactsData) setContacts(contactsData);

      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [isOpen]);

  // Update company when deal changes
  useEffect(() => {
    if (dealId) {
      const deal = deals.find(d => d.id === dealId);
      if (deal && deal.company_id) {
        setCompanyId(deal.company_id);
      }
    }
  }, [dealId, deals]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (externalAttendees.length === 0) {
        throw new Error('Please add at least one external attendee');
      }
      if (!dateRangeStart || !dateRangeEnd) {
        throw new Error('Please select a date range');
      }
      if (internalAttendees.length === 0) {
        throw new Error('Please add at least one internal attendee');
      }

      const input: CreateSchedulingRequestInput = {
        meeting_type: meetingType,
        duration_minutes: duration,
        title: title || undefined,
        context: context || undefined,
        meeting_platform: platform,
        meeting_location: location || undefined,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
        preferred_times: preferredTimes,
        avoid_days: avoidDays,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        deal_id: dealId || undefined,
        company_id: companyId || undefined,
        internal_attendees: internalAttendees,
        external_attendees: externalAttendees,
      };

      const res = await fetch('/api/scheduler/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create scheduling request');
      }

      const { data } = await res.json();

      // Immediately send the scheduling email
      const sendRes = await fetch(`/api/scheduler/requests/${data.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailType: 'initial_outreach' }),
      });

      if (!sendRes.ok) {
        const sendData = await sendRes.json();
        console.error('Failed to send scheduling email:', sendData.error);
        // Don't throw - request was created, just email failed
        // User can manually send from scheduler dashboard
      }

      onSuccess?.(data.id);
      onClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addExternalAttendee = () => {
    setExternalAttendees([
      ...externalAttendees,
      { name: '', email: '', is_primary_contact: externalAttendees.length === 0 },
    ]);
  };

  const removeExternalAttendee = (index: number) => {
    setExternalAttendees(externalAttendees.filter((_, i) => i !== index));
  };

  const updateExternalAttendee = (index: number, updates: Partial<typeof externalAttendees[0]>) => {
    setExternalAttendees(
      externalAttendees.map((a, i) => i === index ? { ...a, ...updates } : a)
    );
  };

  const addInternalAttendee = (userId: string) => {
    if (internalAttendees.some(a => a.user_id === userId)) return;
    setInternalAttendees([
      ...internalAttendees,
      { user_id: userId, is_organizer: internalAttendees.length === 0 },
    ]);
  };

  const removeInternalAttendee = (userId: string) => {
    setInternalAttendees(internalAttendees.filter(a => a.user_id !== userId));
  };

  const selectContactAsAttendee = (contact: Contact) => {
    const exists = externalAttendees.some(a => a.contact_id === contact.id || a.email === contact.email);
    if (exists) return;

    setExternalAttendees([
      ...externalAttendees,
      {
        contact_id: contact.id,
        name: contact.name,
        email: contact.email,
        title: contact.title,
        is_primary_contact: externalAttendees.length === 0,
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Schedule Meeting</h2>
              <p className="text-sm text-gray-500">
                AI will handle outreach and scheduling
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Step 1: Meeting Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center">1</span>
                  Meeting Details
                </h3>

                {/* Meeting Type */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {MEETING_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMeetingType(option.value)}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all',
                        meetingType === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className={cn(
                        'text-sm font-medium',
                        meetingType === option.value ? 'text-blue-700' : 'text-gray-900'
                      )}>
                        {option.label}
                      </div>
                      <div className="text-xs text-gray-500">{option.description}</div>
                    </button>
                  ))}
                </div>

                {/* Duration & Platform */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Clock className="h-4 w-4 inline mr-1" />
                      Duration
                    </label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    >
                      {DURATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Video className="h-4 w-4 inline mr-1" />
                      Platform
                    </label>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value as MeetingPlatform)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    >
                      {PLATFORM_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Title (optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meeting Title (optional)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Q1 Strategy Discussion"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Location for in-person */}
                {platform === MEETING_PLATFORMS.IN_PERSON && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., 123 Main St, Suite 100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Step 2: Scheduling Preferences */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center">2</span>
                  Scheduling Preferences
                </h3>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Earliest Date
                    </label>
                    <input
                      type="date"
                      value={dateRangeStart}
                      onChange={(e) => setDateRangeStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Latest Date
                    </label>
                    <input
                      type="date"
                      value={dateRangeEnd}
                      onChange={(e) => setDateRangeEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Preferred Times */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Times
                  </label>
                  <div className="flex gap-3">
                    {(['morning', 'afternoon', 'evening'] as const).map((period) => (
                      <label
                        key={period}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all',
                          preferredTimes[period]
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={preferredTimes[period]}
                          onChange={(e) => setPreferredTimes({ ...preferredTimes, [period]: e.target.checked })}
                          className="sr-only"
                        />
                        <span className={cn(
                          'text-sm capitalize',
                          preferredTimes[period] ? 'text-blue-700' : 'text-gray-700'
                        )}>
                          {period}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Avoid Days */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Days to Avoid
                  </label>
                  <div className="flex gap-2">
                    {DAY_OPTIONS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          setAvoidDays(
                            avoidDays.includes(day.value)
                              ? avoidDays.filter(d => d !== day.value)
                              : [...avoidDays, day.value]
                          );
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm border transition-all',
                          avoidDays.includes(day.value)
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        )}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 3: Attendees */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center">3</span>
                  Attendees
                </h3>

                {/* External Attendees */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="h-4 w-4 inline mr-1" />
                    External (Who to invite)
                  </label>

                  {externalAttendees.map((attendee, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={attendee.name}
                        onChange={(e) => updateExternalAttendee(index, { name: e.target.value })}
                        placeholder="Name"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                      />
                      <input
                        type="email"
                        value={attendee.email}
                        onChange={(e) => updateExternalAttendee(index, { email: e.target.value })}
                        placeholder="Email"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeExternalAttendee(index)}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addExternalAttendee}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Plus className="h-4 w-4" />
                      Add Manually
                    </button>

                    {contacts.length > 0 && (
                      <select
                        onChange={(e) => {
                          const contact = contacts.find(c => c.id === e.target.value);
                          if (contact) selectContactAsAttendee(contact);
                          e.target.value = '';
                        }}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                        defaultValue=""
                      >
                        <option value="" disabled>Select from contacts</option>
                        {contacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {contact.name} ({contact.email})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Internal Attendees */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Internal Team
                  </label>

                  <div className="flex flex-wrap gap-2 mb-2">
                    {internalAttendees.map((attendee) => {
                      const user = users.find(u => u.id === attendee.user_id);
                      return (
                        <span
                          key={attendee.user_id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                        >
                          {user?.name || 'Unknown'}
                          {attendee.is_organizer && (
                            <span className="text-xs text-gray-500">(Organizer)</span>
                          )}
                          {!attendee.is_organizer && (
                            <button
                              type="button"
                              onClick={() => removeInternalAttendee(attendee.user_id)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  <select
                    onChange={(e) => {
                      if (e.target.value) addInternalAttendee(e.target.value);
                      e.target.value = '';
                    }}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>Add team member</option>
                    {users
                      .filter(u => !internalAttendees.some(a => a.user_id === u.id))
                      .map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Step 4: Context (Optional) */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center">4</span>
                  Context & Associations
                </h3>

                {/* Deal/Company association */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Briefcase className="h-4 w-4 inline mr-1" />
                      Deal (optional)
                    </label>
                    <select
                      value={dealId}
                      onChange={(e) => setDealId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    >
                      <option value="">None</option>
                      {deals.map((deal) => (
                        <option key={deal.id} value={deal.id}>{deal.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Building2 className="h-4 w-4 inline mr-1" />
                      Company (optional)
                    </label>
                    <select
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    >
                      <option value="">None</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Context for AI */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Sparkles className="h-4 w-4 inline mr-1" />
                    Context for AI Email (optional)
                  </label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="e.g., They expressed interest in our AI agents at the trade show. Focus on reducing call center costs..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This helps AI write more relevant scheduling emails
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || loadingData}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4" />
                Create Scheduling Request
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
