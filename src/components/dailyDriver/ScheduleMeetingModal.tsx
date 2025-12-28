'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Loader2, Video, Users, Mail, ArrowLeft, ArrowRight, Sparkles, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InternalUser {
  id: string;
  name: string;
  email: string;
}

interface SuggestedRep {
  id: string;
  name: string;
  email: string;
}

interface EmailPreview {
  subject: string;
  body: string;
}

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  sourceCommunicationId?: string | null;
  onScheduled: () => void;
}

const MEETING_TYPES = [
  { value: 'discovery', label: 'Discovery Call' },
  { value: 'demo', label: 'Demo' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'technical', label: 'Technical Review' },
  { value: 'check_in', label: 'Check In' },
];

const DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
];

type Step = 'details' | 'email';

export function ScheduleMeetingModal({
  isOpen,
  onClose,
  companyId,
  companyName,
  contactName,
  contactEmail,
  sourceCommunicationId,
  onScheduled,
}: ScheduleMeetingModalProps) {
  const [step, setStep] = useState<Step>('details');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<InternalUser[]>([]);
  const [suggestedReps, setSuggestedReps] = useState<SuggestedRep[]>([]);
  const [selectedInternalUsers, setSelectedInternalUsers] = useState<string[]>([]);
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const [editedEmail, setEditedEmail] = useState<EmailPreview | null>(null);
  const [availabilityWarnings, setAvailabilityWarnings] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    meeting_type: 'discovery',
    duration_minutes: 30,
    title: '',
    context: '',
    contact_email: contactEmail || '',
    contact_name: contactName || '',
  });

  // Fetch initial data when modal opens
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch current user
        const userRes = await fetch('/api/auth/me');
        if (userRes.ok) {
          const userData = await userRes.json();
          setUserId(userData.user?.id || null);
        }

        // Fetch available internal users
        const usersRes = await fetch('/api/scheduler/users');
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setAvailableUsers(usersData.users || []);
        }

        // Fetch company rep suggestions
        const previewRes = await fetch(`/api/scheduler/preview?companyId=${companyId}`);
        if (previewRes.ok) {
          const previewData = await previewRes.json();
          setSuggestedReps(previewData.suggestedReps || []);

          // Pre-select suggested reps
          if (previewData.suggestedReps?.length > 0) {
            setSelectedInternalUsers(previewData.suggestedReps.map((r: SuggestedRep) => r.id));
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    if (isOpen) {
      fetchData();
      setStep('details');
      setEmailPreview(null);
      setEditedEmail(null);
    }
  }, [isOpen, companyId]);

  // Reset form when modal opens with new contact info
  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        contact_email: contactEmail || '',
        contact_name: contactName || '',
        title: `${MEETING_TYPES.find(t => t.value === prev.meeting_type)?.label || 'Meeting'} with ${companyName}`,
      }));
    }
  }, [isOpen, contactEmail, contactName, companyName]);

  const toggleInternalUser = (id: string) => {
    setSelectedInternalUsers(prev =>
      prev.includes(id)
        ? prev.filter(uid => uid !== id)
        : [...prev, id]
    );
  };

  const handleGenerateEmail = async () => {
    if (!formData.contact_email) {
      alert('Contact email is required');
      return;
    }

    setIsGeneratingEmail(true);

    try {
      // Get emails for internal attendees to check their calendar availability
      const internalAttendeeEmails = selectedInternalUsers
        .map(id => availableUsers.find(u => u.id === id)?.email)
        .filter((email): email is string => !!email);

      const res = await fetch('/api/scheduler/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          companyName,
          meetingType: formData.meeting_type,
          durationMinutes: formData.duration_minutes,
          title: formData.title,
          context: formData.context,
          contactEmail: formData.contact_email,
          contactName: formData.contact_name,
          internalAttendeeEmails, // Pass emails for calendar availability check
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate email');
      }

      const data = await res.json();
      setEmailPreview(data.email);
      setEditedEmail(data.email);
      setAvailabilityWarnings(data.availabilityWarnings || []);
      setStep('email');
    } catch (error) {
      console.error('Error generating email:', error);
      alert('Failed to generate email preview. Please try again.');
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleSubmit = async () => {
    if (isLoading || !userId || !editedEmail) return;

    setIsLoading(true);

    try {
      // Calculate date range (next 2 weeks)
      const now = new Date();
      const dateRangeStart = new Date(now);
      dateRangeStart.setDate(dateRangeStart.getDate() + 1);
      const dateRangeEnd = new Date(now);
      dateRangeEnd.setDate(dateRangeEnd.getDate() + 14);

      // Create the scheduling request
      const res = await fetch('/api/scheduler/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_type: formData.meeting_type,
          duration_minutes: formData.duration_minutes,
          title: formData.title || `${MEETING_TYPES.find(t => t.value === formData.meeting_type)?.label} with ${companyName}`,
          context: formData.context || undefined,
          meeting_platform: 'teams',
          date_range_start: dateRangeStart.toISOString(),
          date_range_end: dateRangeEnd.toISOString(),
          company_id: companyId,
          source_communication_id: sourceCommunicationId || undefined,
          internal_attendees: [
            { user_id: userId, is_organizer: true },
            ...selectedInternalUsers
              .filter(id => id !== userId)
              .map(id => ({ user_id: id, is_organizer: false })),
          ],
          external_attendees: [
            {
              email: formData.contact_email,
              name: formData.contact_name || undefined,
              is_primary_contact: true,
            },
          ],
          // Include the edited email to send immediately
          initial_email: editedEmail,
          send_immediately: true,
        }),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to create scheduling request');
      }

      // Check if email failed even though request was created
      if (responseData.emailError) {
        alert(`Meeting scheduled but email failed to send: ${responseData.emailError}\n\nPlease try sending the email manually.`);
      }

      onScheduled();
      onClose();
    } catch (error) {
      console.error('Error creating scheduling request:', error);
      alert(error instanceof Error ? error.message : 'Failed to schedule meeting');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Get users that are NOT the current user, with suggested reps first
  const sortedUsers = availableUsers
    .filter(u => u.id !== userId)
    .sort((a, b) => {
      const aIsSuggested = suggestedReps.some(r => r.id === a.id);
      const bIsSuggested = suggestedReps.some(r => r.id === b.id);
      if (aIsSuggested && !bIsSuggested) return -1;
      if (!aIsSuggested && bIsSuggested) return 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              {step === 'email' && (
                <button
                  onClick={() => setStep('details')}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mr-1"
                >
                  <ArrowLeft className="h-4 w-4 text-gray-500" />
                </button>
              )}
              <Calendar className="h-5 w-5 text-blue-500" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {step === 'details' ? 'Schedule Meeting' : 'Review Email'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                Step {step === 'details' ? '1' : '2'} of 2
              </span>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Company context */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-[#2a2a2a]">
            <p className="text-xs text-gray-500">
              Scheduling for: <span className="font-medium text-gray-700 dark:text-gray-300">{companyName}</span>
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {step === 'details' ? (
              <div className="space-y-4">
                {/* Contact Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contact Email *
                  </label>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    required
                    placeholder="contact@company.com"
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border',
                      'bg-white dark:bg-gray-800',
                      'border-gray-200 dark:border-gray-700',
                      'text-gray-900 dark:text-gray-100',
                      'placeholder:text-gray-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                </div>

                {/* Contact Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="John Smith"
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border',
                      'bg-white dark:bg-gray-800',
                      'border-gray-200 dark:border-gray-700',
                      'text-gray-900 dark:text-gray-100',
                      'placeholder:text-gray-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                </div>

                {/* Internal Attendees */}
                {sortedUsers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Internal Attendees
                      </div>
                    </label>
                    <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                      {sortedUsers.map(user => {
                        const isSuggested = suggestedReps.some(r => r.id === user.id);
                        return (
                          <label
                            key={user.id}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                              selectedInternalUsers.includes(user.id)
                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selectedInternalUsers.includes(user.id)}
                              onChange={() => toggleInternalUser(user.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {user.name}
                                {isSuggested && (
                                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-normal">
                                    (Account Rep)
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {user.email}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {selectedInternalUsers.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedInternalUsers.length} attendee{selectedInternalUsers.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                )}

                {/* Meeting Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Meeting Type
                  </label>
                  <select
                    value={formData.meeting_type}
                    onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value })}
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border',
                      'bg-white dark:bg-gray-800',
                      'border-gray-200 dark:border-gray-700',
                      'text-gray-900 dark:text-gray-100',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  >
                    {MEETING_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Duration
                  </label>
                  <div className="flex gap-2">
                    {DURATIONS.map((duration) => (
                      <button
                        key={duration.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, duration_minutes: duration.value })}
                        className={cn(
                          'flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
                          formData.duration_minutes === duration.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        )}
                      >
                        {duration.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Meeting Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Discovery Call with Acme Corp"
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border',
                      'bg-white dark:bg-gray-800',
                      'border-gray-200 dark:border-gray-700',
                      'text-gray-900 dark:text-gray-100',
                      'placeholder:text-gray-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                </div>

                {/* Context */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Context (optional)
                  </label>
                  <textarea
                    value={formData.context}
                    onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                    rows={2}
                    placeholder="Any notes for this meeting..."
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border resize-none',
                      'bg-white dark:bg-gray-800',
                      'border-gray-200 dark:border-gray-700',
                      'text-gray-900 dark:text-gray-100',
                      'placeholder:text-gray-400',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Availability Warnings */}
                {availabilityWarnings.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-1">
                      ⚠️ Calendar Notes
                    </p>
                    <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                      {availabilityWarnings.map((warning, i) => (
                        <li key={i}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Email Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={editedEmail?.subject || ''}
                    onChange={(e) => setEditedEmail(prev => prev ? { ...prev, subject: e.target.value } : null)}
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border',
                      'bg-white dark:bg-gray-800',
                      'border-gray-200 dark:border-gray-700',
                      'text-gray-900 dark:text-gray-100',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                </div>

                {/* Email Body */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email Body
                    </label>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Edit3 className="h-3 w-3" />
                      Edit as needed
                    </span>
                  </div>
                  <textarea
                    value={editedEmail?.body || ''}
                    onChange={(e) => setEditedEmail(prev => prev ? { ...prev, body: e.target.value } : null)}
                    rows={12}
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border font-mono',
                      'bg-white dark:bg-gray-800',
                      'border-gray-200 dark:border-gray-700',
                      'text-gray-900 dark:text-gray-100',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    )}
                  />
                </div>

                {/* Regenerate button */}
                <button
                  type="button"
                  onClick={handleGenerateEmail}
                  disabled={isGeneratingEmail}
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGeneratingEmail ? 'Regenerating...' : 'Regenerate email'}
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-[#2a2a2a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>

            {step === 'details' ? (
              <button
                type="button"
                onClick={handleGenerateEmail}
                disabled={isGeneratingEmail || !formData.contact_email || !userId}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg',
                  'bg-blue-600 text-white hover:bg-blue-700',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors'
                )}
              >
                {isGeneratingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    Preview Email
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !userId || !editedEmail}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg',
                  'bg-green-600 text-white hover:bg-green-700',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors'
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send Email
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
