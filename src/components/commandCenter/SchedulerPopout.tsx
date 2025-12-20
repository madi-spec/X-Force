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
} from 'lucide-react';
import { CommandCenterItem, ScheduleSuggestions, PrimaryContact } from '@/types/commandCenter';

// ============================================
// TYPES
// ============================================

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

  // Get suggested times
  const suggestedTimes = item.schedule_suggestions?.suggested_times || generateDefaultTimes();

  // Handle send invite
  const handleSendInvite = async () => {
    if (!selectedTime || !item.primary_contact?.email) return;

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
              email: item.primary_contact.email,
              name: item.primary_contact.name,
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

  const contact = item.primary_contact;

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
          {contact && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                With
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{contact.name}</span>
                <span className="text-sm text-gray-400">({contact.email})</span>
              </div>
            </div>
          )}

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
            disabled={!selectedTime || !title || sending}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              selectedTime && title && !sending
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
    </>
  );
}
