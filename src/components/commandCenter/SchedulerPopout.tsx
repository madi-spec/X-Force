'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  X,
  Calendar,
  Clock,
  User,
  Video,
  Loader2,
  Check,
  MapPin,
  ChevronDown,
  UserPlus,
} from 'lucide-react';
import { CommandCenterItem, ScheduleSuggestions, PrimaryContact } from '@/types/commandCenter';
import { AddContactModal, NewContact } from './AddContactModal';

// ============================================
// TYPES
// ============================================

interface ContactOption {
  id: string;
  name: string;
  email: string;
  title?: string;
}

interface SchedulerPopoutProps {
  item: CommandCenterItem & {
    primary_contact?: PrimaryContact;
    schedule_suggestions?: ScheduleSuggestions;
  };
  onClose: () => void;
  onScheduled: () => void;
  className?: string;
}

// ============================================
// DURATION OPTIONS
// ============================================

const DURATION_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '90 min', minutes: 90 },
];

// ============================================
// HELPERS
// ============================================

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }) + ' at ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function generateDefaultTimes(): string[] {
  const times: string[] = [];
  const now = new Date();

  // Generate 3 slots over next 3 business days
  for (let i = 1; i <= 3; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);

    // Skip weekends
    if (date.getDay() === 0) date.setDate(date.getDate() + 1);
    if (date.getDay() === 6) date.setDate(date.getDate() + 2);

    // Morning slots
    const hours = [9, 10, 14];
    date.setHours(hours[i - 1], 0, 0, 0);
    times.push(date.toISOString());
  }

  return times;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SchedulerPopout({
  item,
  onClose,
  onScheduled,
  className,
}: SchedulerPopoutProps) {
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [title, setTitle] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contact selection state
  const [availableContacts, setAvailableContacts] = useState<ContactOption[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);

  // Manual contact entry state (when no contacts exist)
  const [manualContact, setManualContact] = useState<NewContact | null>(null);
  const [showAddContactModal, setShowAddContactModal] = useState(false);

  // Get contact from primary_contact or joined contact data
  const existingContact = item.primary_contact || (item as any).contact as PrimaryContact | undefined;

  // Use selected contact, existing contact, or manual entry
  const manualContactOption: ContactOption | null = manualContact
    ? { id: manualContact.id || 'manual', name: manualContact.name, email: manualContact.email, title: manualContact.title }
    : null;
  const contact = selectedContact || existingContact || manualContactOption;

  // Initialize title from suggestions or item
  useEffect(() => {
    const defaultTitle = item.schedule_suggestions?.meeting_title ||
      (item.title.startsWith('Schedule') ? item.title.replace('Schedule ', '') : item.title);
    setTitle(defaultTitle);

    // Set default duration from suggestions
    if (item.schedule_suggestions?.duration_minutes) {
      setDuration(item.schedule_suggestions.duration_minutes);
    }
  }, [item]);

  // Fetch available contacts from company if no contact is linked
  useEffect(() => {
    async function fetchContacts() {
      // If we already have a contact, no need to fetch
      if (existingContact) return;

      // Get company_id from item or deal
      const companyId = item.company_id || (item as any).deal?.company_id;
      if (!companyId) return;

      setLoadingContacts(true);
      try {
        const response = await fetch(`/api/companies/${companyId}/contacts`);
        if (response.ok) {
          const data = await response.json();
          const contacts: ContactOption[] = (data.contacts || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            title: c.title,
          }));
          setAvailableContacts(contacts);
        }
      } catch (err) {
        console.error('[SchedulerPopout] Error fetching contacts:', err);
      } finally {
        setLoadingContacts(false);
      }
    }

    fetchContacts();
  }, [item.company_id, existingContact]);

  // Get suggested times
  const suggestedTimes = item.schedule_suggestions?.suggested_times || generateDefaultTimes();

  // Handle send invite
  const handleSendInvite = async () => {
    if (!selectedTime || !contact?.email) return;

    setSending(true);
    setError(null);

    try {
      // Calculate end time
      const startDate = new Date(selectedTime);
      const endDate = new Date(startDate.getTime() + duration * 60000);

      const response = await fetch('/api/command-center/items/' + item.id + '/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          attendees: [
            {
              email: contact.email,
              name: contact.name,
            },
          ],
          isOnlineMeeting: true,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to schedule meeting');
      }

      onScheduled();
    } catch (err) {
      console.error('[SchedulerPopout] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to schedule meeting');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={cn(
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-xl shadow-2xl z-50',
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-medium text-gray-900">Schedule Meeting</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Meeting Title */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Meeting Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Enter meeting title"
            />
          </div>

          {/* Attendee */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              With
            </label>
            {contact ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{contact.name}</span>
                <span className="text-sm text-gray-400">({contact.email})</span>
                {selectedContact && (
                  <button
                    onClick={() => setSelectedContact(null)}
                    className="ml-auto text-xs text-gray-500 hover:text-gray-700"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : loadingContacts ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                <span className="text-sm text-gray-500">Loading contacts...</span>
              </div>
            ) : availableContacts.length > 0 ? (
              <div className="relative">
                <button
                  onClick={() => setContactDropdownOpen(!contactDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-300 hover:border-gray-400 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Select an attendee...</span>
                  </div>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-gray-400 transition-transform",
                    contactDropdownOpen && "rotate-180"
                  )} />
                </button>

                {contactDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-10 max-h-48 overflow-y-auto">
                    {availableContacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedContact(c);
                          setContactDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                      >
                        <User className="h-4 w-4 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-700 truncate">{c.name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {c.title ? `${c.title} · ` : ''}{c.email}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : manualContact ? (
              /* Show selected manual contact */
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                <User className="h-4 w-4 text-green-500" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-green-700">{manualContact.name}</span>
                  <span className="text-sm text-green-600 ml-1">({manualContact.email})</span>
                  {manualContact.title && (
                    <span className="text-xs text-green-500 ml-2">{manualContact.title}</span>
                  )}
                </div>
                <button
                  onClick={() => setManualContact(null)}
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  Change
                </button>
              </div>
            ) : (
              /* Add Contact Button */
              <button
                onClick={() => setShowAddContactModal(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <UserPlus className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Add Contact to Schedule</span>
              </button>
            )}
          </div>

          {/* Suggested Times */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Suggested Times
            </label>
            <div className="space-y-2">
              {suggestedTimes.map((time, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedTime(time)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                    selectedTime === time
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    selectedTime === time
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  )}>
                    {selectedTime === time && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{formatDateTime(time)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration and Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.minutes} value={opt.minutes}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Location
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <Video className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-gray-700">Teams Meeting</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSendInvite}
            disabled={!selectedTime || !title || !contact?.email || sending}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              selectedTime && title && contact?.email && !sending
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4" />
                Send Invite
              </>
            )}
          </button>
        </div>
      </div>

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        onContactAdded={(newContact) => {
          setManualContact(newContact);
          setShowAddContactModal(false);
        }}
        companyId={item.company_id || (item as any).deal?.company_id}
        companyName={item.company_name || (item as any).deal?.company?.name}
      />
    </>
  );
}
