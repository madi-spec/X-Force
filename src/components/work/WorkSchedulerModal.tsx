'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Calendar,
  Clock,
  Users,
  Video,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  MEETING_TYPES,
  MEETING_PLATFORMS,
  type MeetingType,
  type MeetingPlatform,
  type PreferredTimes,
} from '@/lib/scheduler/types';
import {
  extractSchedulerContext,
  shouldSchedulingResolveWorkItem,
} from '@/lib/scheduler/events';
import { QueueItem } from '@/lib/work';
import { WorkItemDetailProjection } from '@/lib/work/projections';

interface WorkSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (schedulingRequestId: string, meetingBooked: boolean) => void;
  workItem: QueueItem;
  workItemProjection: WorkItemDetailProjection;
  linkedCommunication?: {
    id: string;
    contact_name?: string;
    contact_email?: string;
    contact_id?: string;
    subject?: string;
    body_preview?: string;
  };
}

interface Contact {
  id: string;
  name: string;
  email: string;
  title?: string;
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
  { value: MEETING_TYPES.CHECK_IN, label: 'Check-in', description: 'Status and relationship check' },
  { value: MEETING_TYPES.TECHNICAL, label: 'Technical Discussion', description: 'Deep dive on technical topics' },
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
];

const DAY_OPTIONS = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
];

export function WorkSchedulerModal({
  isOpen,
  onClose,
  onSuccess,
  workItem,
  workItemProjection,
  linkedCommunication,
}: WorkSchedulerModalProps) {
  const supabase = createClient();

  // Extract prefill context from work item
  const prefillContext = extractSchedulerContext(
    {
      id: workItem.id,
      company_id: workItem.company_id,
      company_name: workItem.company_name,
      signal_type: workItemProjection.signal_type,
      title: workItem.title,
      subtitle: workItem.subtitle || undefined,
      why_here: workItemProjection.why_here,
      metadata: workItem.metadata,
    },
    linkedCommunication
  );

  // Form state with prefill
  const [meetingType, setMeetingType] = useState<MeetingType>(prefillContext.suggestedMeetingType);
  const [duration, setDuration] = useState(prefillContext.suggestedDuration);
  const [platform, setPlatform] = useState<MeetingPlatform>(MEETING_PLATFORMS.TEAMS);
  const [title, setTitle] = useState('');
  const [context, setContext] = useState(prefillContext.context);
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
  const [users, setUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft review state
  const [schedulingRequestId, setSchedulingRequestId] = useState<string | null>(null);
  const [draftEmail, setDraftEmail] = useState<{ subject: string; body: string } | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [showingDraft, setShowingDraft] = useState(false);
  const [sending, setSending] = useState(false);

  // Resolution info
  const resolutionCheck = shouldSchedulingResolveWorkItem(
    workItemProjection.signal_type,
    'MeetingBooked',
    false
  );

  // Set default date range (next 2 weeks)
  useEffect(() => {
    const today = new Date();
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

    setDateRangeStart(today.toISOString().split('T')[0]);
    setDateRangeEnd(twoWeeksLater.toISOString().split('T')[0]);
  }, []);

  // Pre-fill external attendee from prefill context
  useEffect(() => {
    if (prefillContext.contactEmail && prefillContext.contactName && externalAttendees.length === 0) {
      setExternalAttendees([{
        contact_id: prefillContext.contactId,
        name: prefillContext.contactName,
        email: prefillContext.contactEmail,
        is_primary_contact: true,
      }]);
    }
  }, [prefillContext.contactId, prefillContext.contactName, prefillContext.contactEmail]);

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
            // Add current user as organizer by default
            if (internalAttendees.length === 0) {
              setInternalAttendees([{ user_id: userData.id, is_organizer: true }]);
            }
          }
        }

        // Load users for internal attendees
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email')
          .order('name');
        if (usersData) setUsers(usersData);

        // Load contacts for external attendees (for this company)
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('id, name, email, title')
          .eq('company_id', workItem.company_id)
          .order('name');
        if (contactsData) setContacts(contactsData);

      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [isOpen, workItem.company_id]);

  // Step 1: Create request and preview draft
  const handleSubmit = useCallback(async () => {
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

      const input = {
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
        deal_id: prefillContext.dealId || undefined,
        company_id: workItem.company_id,
        source_communication_id: linkedCommunication?.id || prefillContext.triggerCommunicationId,
        // Work item context
        work_item_id: workItem.id,
        triggered_by_signal_type: workItemProjection.signal_type,
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
      setSchedulingRequestId(data.id);

      // Preview the draft email
      const previewRes = await fetch(`/api/scheduler/requests/${data.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailType: 'initial_outreach', preview: true }),
      });

      if (!previewRes.ok) {
        const previewData = await previewRes.json();
        throw new Error(previewData.error || 'Failed to generate email preview');
      }

      const previewData = await previewRes.json();
      setDraftEmail(previewData.email);
      setEditedSubject(previewData.email.subject);
      setEditedBody(previewData.email.body);
      setShowingDraft(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [
    meetingType, duration, title, context, platform, location,
    dateRangeStart, dateRangeEnd, preferredTimes, avoidDays,
    internalAttendees, externalAttendees, workItem, workItemProjection,
    prefillContext, linkedCommunication
  ]);

  // Step 2: Send the email after user review
  const handleSendEmail = useCallback(async () => {
    if (!schedulingRequestId) return;

    setSending(true);
    setError(null);

    try {
      // Send the email with user's edits
      const sendRes = await fetch(`/api/scheduler/requests/${schedulingRequestId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailType: 'initial_outreach',
          customSubject: editedSubject !== draftEmail?.subject ? editedSubject : undefined,
          customBody: editedBody !== draftEmail?.body ? editedBody : undefined,
        }),
      });

      if (!sendRes.ok) {
        const sendData = await sendRes.json();
        throw new Error(sendData.error || 'Failed to send scheduling email');
      }

      // Resolve the attention flag if there is one
      const attentionFlagId = workItem.metadata?.attention_flag_id as string | undefined;
      if (attentionFlagId) {
        try {
          await fetch(`/api/attention-flags/${attentionFlagId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution_notes: 'Scheduling email sent' }),
          });
          console.log('[WorkSchedulerModal] Resolved attention flag:', attentionFlagId);
        } catch (flagErr) {
          console.error('[WorkSchedulerModal] Failed to resolve attention flag:', flagErr);
        }
      }

      // Also try resolving via communication if present
      const communicationId = workItem.metadata?.communication_id as string | undefined;
      if (communicationId && !attentionFlagId) {
        try {
          await fetch(`/api/communications/${communicationId}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: 'Scheduling email sent' }),
          });
          console.log('[WorkSchedulerModal] Marked communication as responded:', communicationId);
        } catch (commErr) {
          console.error('[WorkSchedulerModal] Failed to mark communication responded:', commErr);
        }
      }

      // Notify parent - meeting not booked yet (just requested)
      onSuccess?.(schedulingRequestId, false);
      onClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSending(false);
    }
  }, [schedulingRequestId, editedSubject, editedBody, draftEmail, workItem.metadata, onSuccess, onClose]);

  // Go back to edit scheduling details
  const handleBackToEdit = useCallback(() => {
    setShowingDraft(false);
    setDraftEmail(null);
    setSchedulingRequestId(null);
  }, []);

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
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '16px',
      }}
    >
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '18px',
          border: '1px solid #e6eaf0',
          boxShadow: '0 18px 50px rgba(16, 24, 40, 0.16)',
          width: '100%',
          maxWidth: '672px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid #eef2f7',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                padding: '8px',
                borderRadius: '12px',
                background: '#eff6ff',
              }}
            >
              <Calendar style={{ width: '20px', height: '20px', color: '#2563eb' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#0b1220', margin: 0 }}>
                Schedule Meeting
              </h2>
              <p style={{ fontSize: '12px', color: '#667085', margin: 0 }}>
                with {workItem.company_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              borderRadius: '10px',
              border: '1px solid #e6eaf0',
              background: '#ffffff',
              fontSize: '12px',
              cursor: 'pointer',
              color: '#0b1220',
            }}
          >
            Cancel
          </button>
        </div>

        {/* Resolution Info */}
        {resolutionCheck.resolves && (
          <div
            style={{
              padding: '8px 16px',
              background: '#f0fdf4',
              borderBottom: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#15803d',
            }}
          >
            <Zap style={{ width: '16px', height: '16px' }} />
            <span>Booking a meeting will resolve this work item</span>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {loadingData ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <Loader2 style={{ width: '32px', height: '32px', color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : showingDraft && draftEmail ? (
            /* Draft Review Mode */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {error && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                  }}
                >
                  <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                  {error}
                </div>
              )}

              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles style={{ width: '16px', height: '16px', color: '#2563eb' }} />
                <span style={{ fontSize: '13px', color: '#1e40af' }}>
                  Review and edit the AI-generated email before sending
                </span>
              </div>

              {/* Subject */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                  Subject
                </label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#111827',
                  }}
                />
              </div>

              {/* Body */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                  Email Body
                </label>
                <textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={16}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#111827',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: '1.5',
                  }}
                />
              </div>

              {/* Recipients info */}
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                To: {externalAttendees.map(a => `${a.name} <${a.email}>`).join(', ')}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {error && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                  }}
                >
                  <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                  {error}
                </div>
              )}

              {/* AI-Prefilled Context Banner */}
              {prefillContext.context && (
                <div
                  style={{
                    background: '#faf5ff',
                    border: '1px solid #e9d5ff',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#7c3aed', marginBottom: '4px' }}>
                    <Sparkles style={{ width: '16px', height: '16px' }} />
                    <span style={{ fontWeight: 500 }}>Context from work item</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b21a8', margin: 0, whiteSpace: 'pre-line' }}>
                    {prefillContext.context}
                  </p>
                </div>
              )}

              {/* Meeting Type */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                  Meeting Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {MEETING_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMeetingType(option.value)}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: meetingType === option.value ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                        background: meetingType === option.value ? '#eff6ff' : '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: meetingType === option.value ? '#1d4ed8' : '#111827',
                      }}>
                        {option.label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration & Platform */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                    <Clock style={{ width: '14px', height: '14px' }} />
                    Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      background: '#ffffff',
                      fontSize: '13px',
                      color: '#111827',
                    }}
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                    <Video style={{ width: '14px', height: '14px' }} />
                    Platform
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as MeetingPlatform)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      background: '#ffffff',
                      fontSize: '13px',
                      color: '#111827',
                    }}
                  >
                    {PLATFORM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date Range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                    Earliest Date
                  </label>
                  <input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      background: '#ffffff',
                      fontSize: '13px',
                      color: '#111827',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                    Latest Date
                  </label>
                  <input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      background: '#ffffff',
                      fontSize: '13px',
                      color: '#111827',
                    }}
                  />
                </div>
              </div>

              {/* Preferred Times */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                  Preferred Times
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {(['morning', 'afternoon', 'evening'] as const).map((period) => (
                    <label
                      key={period}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: preferredTimes[period] ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                        background: preferredTimes[period] ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={preferredTimes[period]}
                        onChange={(e) => setPreferredTimes({ ...preferredTimes, [period]: e.target.checked })}
                        style={{ display: 'none' }}
                      />
                      <span style={{
                        fontSize: '13px',
                        textTransform: 'capitalize',
                        color: preferredTimes[period] ? '#1d4ed8' : '#374151',
                      }}>
                        {period}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Days to Avoid */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                  Days to Avoid
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
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
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        border: avoidDays.includes(day.value) ? '1px solid #ef4444' : '1px solid #e5e7eb',
                        background: avoidDays.includes(day.value) ? '#fef2f2' : '#ffffff',
                        color: avoidDays.includes(day.value) ? '#b91c1c' : '#374151',
                        cursor: 'pointer',
                      }}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* External Attendees */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                  <Users style={{ width: '14px', height: '14px' }} />
                  External Attendees (Who to invite)
                </label>

                {externalAttendees.map((attendee, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={attendee.name}
                      onChange={(e) => updateExternalAttendee(index, { name: e.target.value })}
                      placeholder="Name"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        background: '#ffffff',
                        fontSize: '13px',
                        color: '#111827',
                      }}
                    />
                    <input
                      type="email"
                      value={attendee.email}
                      onChange={(e) => updateExternalAttendee(index, { email: e.target.value })}
                      placeholder="Email"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        background: '#ffffff',
                        fontSize: '13px',
                        color: '#111827',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeExternalAttendee(index)}
                      style={{
                        padding: '8px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9ca3af',
                      }}
                    >
                      <Trash2 style={{ width: '16px', height: '16px' }} />
                    </button>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={addExternalAttendee}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      fontSize: '13px',
                      color: '#2563eb',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus style={{ width: '16px', height: '16px' }} />
                    Add Manually
                  </button>

                  {contacts.length > 0 && (
                    <select
                      onChange={(e) => {
                        const contact = contacts.find(c => c.id === e.target.value);
                        if (contact) selectContactAsAttendee(contact);
                        e.target.value = '';
                      }}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        background: '#ffffff',
                        fontSize: '13px',
                        color: '#111827',
                      }}
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                  Internal Team
                </label>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {internalAttendees.map((attendee) => {
                    const user = users.find(u => u.id === attendee.user_id);
                    return (
                      <span
                        key={attendee.user_id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 12px',
                          background: '#f3f4f6',
                          borderRadius: '9999px',
                          fontSize: '13px',
                          color: '#111827',
                        }}
                      >
                        {user?.name || 'Unknown'}
                        {attendee.is_organizer && (
                          <span style={{ fontSize: '11px', color: '#6b7280' }}>(Organizer)</span>
                        )}
                        {!attendee.is_organizer && (
                          <button
                            type="button"
                            onClick={() => removeInternalAttendee(attendee.user_id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#9ca3af',
                              padding: 0,
                              display: 'flex',
                            }}
                          >
                            <X style={{ width: '12px', height: '12px' }} />
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
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: '#ffffff',
                    fontSize: '13px',
                    color: '#111827',
                  }}
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

              {/* Context for AI */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                  <Sparkles style={{ width: '14px', height: '14px' }} />
                  Additional Context for AI Email
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Add any additional context for the AI to use when writing the scheduling email..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: '#ffffff',
                    fontSize: '13px',
                    color: '#111827',
                    resize: 'none',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            padding: '14px 16px',
            borderTop: '1px solid #eef2f7',
            background: '#f6f8fb',
          }}
        >
          {showingDraft ? (
            <>
              <button
                onClick={handleBackToEdit}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1px solid #e6eaf0',
                  background: '#ffffff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: '#0b1220',
                }}
              >
                Back to Edit
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#16a34a',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: sending ? 'not-allowed' : 'pointer',
                  color: '#ffffff',
                  opacity: sending ? 0.5 : 1,
                }}
              >
                {sending ? (
                  <>
                    <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                    Sending...
                  </>
                ) : (
                  <>
                    <Zap style={{ width: '14px', height: '14px' }} />
                    Send Email
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1px solid #e6eaf0',
                  background: '#ffffff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: '#0b1220',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || loadingData}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#2563eb',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: loading || loadingData ? 'not-allowed' : 'pointer',
                  color: '#ffffff',
                  opacity: loading || loadingData ? 0.5 : 1,
                }}
              >
                {loading ? (
                  <>
                    <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                    Generating Draft...
                  </>
                ) : (
                  <>
                    <Sparkles style={{ width: '14px', height: '14px' }} />
                    Preview Email
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
