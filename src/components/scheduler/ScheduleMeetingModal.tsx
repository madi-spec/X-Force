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
  Building2,
  Briefcase,
  Sparkles,
  Check,
  Zap,
  AlertTriangle,
  RefreshCw,
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
  type SchedulingDraft,
  type DraftProposedTime,
} from '@/lib/scheduler/types';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';

// Work item types for resolution
interface WorkItemContext {
  id: string;
  company_id?: string;
  company_name?: string;
  signal_type?: string;
  metadata?: Record<string, unknown>;
}

interface LinkedCommunication {
  id: string;
  contact_name?: string;
  contact_email?: string;
  contact_id?: string;
  subject?: string;
  body_preview?: string;
}

interface ScheduleSuggestion {
  meeting_title?: string;
  duration_minutes?: number;
  suggested_times?: string[];
}

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
  // Mode: 'staged' shows AI draft preview, 'direct' books immediately
  mode?: 'staged' | 'direct';
  // Work item context for resolution
  workItem?: WorkItemContext;
  linkedCommunication?: LinkedCommunication;
  // Schedule suggestions for direct mode
  scheduleSuggestions?: ScheduleSuggestion;
  // Callback when work item is resolved
  onWorkItemResolved?: () => void;
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

interface CompanyProduct {
  id: string;
  company_id: string;
  product_id: string;
  product_name: string;
  company_name: string;
  status: string;
}

interface Product {
  id: string;
  name: string;
  is_sellable: boolean;
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

// Helper to format date/time for display
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

export function ScheduleMeetingModal({
  isOpen,
  onClose,
  onSuccess,
  dealId: initialDealId,
  companyId: initialCompanyId,
  contactId,
  contactName,
  contactEmail,
  mode = 'staged',
  workItem,
  linkedCommunication,
  scheduleSuggestions,
  onWorkItemResolved,
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
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
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
  const [companyProducts, setCompanyProducts] = useState<CompanyProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [addingProduct, setAddingProduct] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // Draft review state
  const [schedulingRequestId, setSchedulingRequestId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SchedulingDraft | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [showingDraft, setShowingDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const [regeneratingDraft, setRegeneratingDraft] = useState(false);
  const [draftWarnings, setDraftWarnings] = useState<string[]>([]);

  // Availability warning state (legacy - now merged into draftWarnings)
  const [availabilityInfo, setAvailabilityInfo] = useState<{
    source: 'calendar' | 'generated' | 'error';
    calendarChecked: boolean;
    warnings: string[];
    error: string | null;
  } | null>(null);

  // Direct mode state
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Generate default times for direct mode if no suggestions provided
  const generateDefaultTimes = (): string[] => {
    const times: string[] = [];
    const now = new Date();
    for (let i = 1; i <= 3; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      // Skip weekends
      if (date.getDay() === 0) date.setDate(date.getDate() + 1);
      if (date.getDay() === 6) date.setDate(date.getDate() + 2);
      const hours = [9, 10, 14];
      date.setHours(hours[i - 1], 0, 0, 0);
      times.push(date.toISOString());
    }
    return times;
  };

  // Get suggested times for direct mode
  const suggestedTimes = scheduleSuggestions?.suggested_times || generateDefaultTimes();

  // Set default date range (next 2 weeks)
  useEffect(() => {
    const today = new Date();
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

    setDateRangeStart(today.toISOString().split('T')[0]);
    setDateRangeEnd(twoWeeksLater.toISOString().split('T')[0]);
  }, []);

  // Pre-fill external attendee if contact info provided (from props or linkedCommunication)
  useEffect(() => {
    const email = contactEmail || linkedCommunication?.contact_email;
    const name = contactName || linkedCommunication?.contact_name;
    const id = contactId || linkedCommunication?.contact_id;

    if (email && name && externalAttendees.length === 0) {
      setExternalAttendees([{
        contact_id: id,
        name,
        email,
        is_primary_contact: true,
      }]);
    }
  }, [contactId, contactName, contactEmail, linkedCommunication]);

  // Pre-fill from scheduleSuggestions (for direct mode)
  useEffect(() => {
    if (scheduleSuggestions?.meeting_title && !title) {
      setTitle(scheduleSuggestions.meeting_title);
    }
    if (scheduleSuggestions?.duration_minutes) {
      setDuration(scheduleSuggestions.duration_minutes);
    }
  }, [scheduleSuggestions]);

  // Pre-fill company from workItem
  useEffect(() => {
    if (workItem?.company_id && !companyId) {
      setCompanyId(workItem.company_id);
    }
  }, [workItem?.company_id]);

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

        // Load master products list (for adding new products to companies)
        const { data: masterProducts } = await supabase
          .from('products')
          .select('id, name, is_sellable')
          .eq('is_active', true)
          .eq('is_sellable', true)
          .order('display_order');
        if (masterProducts) setProducts(masterProducts);

        // Load company products with product names
        const { data: productsData } = await supabase
          .from('company_products')
          .select(`
            id,
            company_id,
            product_id,
            status,
            product:products(name),
            company:companies(name)
          `)
          .in('status', ['in_sales', 'in_onboarding', 'active'])
          .order('updated_at', { ascending: false });
        if (productsData) {
          const transformed = productsData.map(cp => {
            // Handle Supabase's nested select which may return array or object
            const product = cp.product as { name: string } | { name: string }[] | null;
            const company = cp.company as { name: string } | { name: string }[] | null;
            return {
              id: cp.id,
              company_id: cp.company_id,
              product_id: cp.product_id,
              status: cp.status,
              product_name: Array.isArray(product) ? product[0]?.name : product?.name || 'Unknown Product',
              company_name: Array.isArray(company) ? company[0]?.name : company?.name || 'Unknown Company',
            };
          });
          setCompanyProducts(transformed);
        }

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

  // Update company when product selection changes
  useEffect(() => {
    if (selectedProductIds.length > 0 && !companyId) {
      const product = companyProducts.find(p => p.id === selectedProductIds[0]);
      if (product && product.company_id) {
        setCompanyId(product.company_id);
      }
    }
  }, [selectedProductIds, companyProducts, companyId]);

  // Add a new product to a company
  const addProductToCompany = async (productId: string) => {
    if (!companyId || !productId) return;

    setAddingProduct(true);
    try {
      const { data: newCompanyProduct, error } = await supabase
        .from('company_products')
        .insert({
          company_id: companyId,
          product_id: productId,
          status: 'in_sales',
          sales_started_at: new Date().toISOString(),
          owner_user_id: currentUserId || null,
        })
        .select(`
          id,
          company_id,
          product_id,
          status,
          product:products(name),
          company:companies(name)
        `)
        .single();

      if (error) throw error;

      if (newCompanyProduct) {
        const product = newCompanyProduct.product as { name: string } | { name: string }[] | null;
        const company = newCompanyProduct.company as { name: string } | { name: string }[] | null;
        const transformed = {
          id: newCompanyProduct.id,
          company_id: newCompanyProduct.company_id,
          product_id: newCompanyProduct.product_id,
          status: newCompanyProduct.status,
          product_name: Array.isArray(product) ? product[0]?.name : product?.name || 'Unknown Product',
          company_name: Array.isArray(company) ? company[0]?.name : company?.name || 'Unknown Company',
        };
        setCompanyProducts(prev => [...prev, transformed]);
        setSelectedProductIds(prev => [...prev, newCompanyProduct.id]);
      }
    } catch (err) {
      console.error('Error adding product to company:', err);
      setError('Failed to add product');
    } finally {
      setAddingProduct(false);
    }
  };

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
        company_product_ids: selectedProductIds.length > 0 ? selectedProductIds : undefined,
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
      setSchedulingRequestId(data.id);

      // Get draft preview from the new preview endpoint
      // This generates AND saves the draft to the database
      const previewRes = await fetch(`/api/scheduler/requests/${data.id}/preview`, {
        method: 'GET',
      });

      if (!previewRes.ok) {
        const previewData = await previewRes.json();
        throw new Error(previewData.error || 'Failed to generate email preview');
      }

      const previewData = await previewRes.json();
      const draftData = previewData.draft;

      console.log('[ScheduleMeetingModal] Draft preview response:', previewData);

      if (!draftData?.subject && !draftData?.body) {
        throw new Error('Email draft is empty. Please try again.');
      }

      setDraft(draftData);
      setEditedSubject(draftData.subject || '');
      setEditedBody(draftData.body || '');
      setDraftWarnings(previewData.warnings || []);
      setHasUnsavedEdits(false);

      // Show if this was an existing draft
      if (previewData.isExisting) {
        console.log('[ScheduleMeetingModal] Loaded existing draft from', draftData.generatedAt);
      }

      setShowingDraft(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Debounced function to save draft edits to database
  const saveDraftEdits = useDebouncedCallback(async () => {
    if (!schedulingRequestId) return;

    try {
      const res = await fetch(`/api/scheduler/requests/${schedulingRequestId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editedSubject,
          body: editedBody,
        }),
      });

      if (res.ok) {
        setHasUnsavedEdits(false);
        console.log('[ScheduleMeetingModal] Draft edits saved to database');
      }
    } catch (err) {
      console.error('[ScheduleMeetingModal] Failed to save draft edits:', err);
    }
  }, 1000);

  // Handle subject changes
  const handleSubjectChange = useCallback((value: string) => {
    setEditedSubject(value);
    setHasUnsavedEdits(true);
    saveDraftEdits();
  }, [saveDraftEdits]);

  // Handle body changes
  const handleBodyChange = useCallback((value: string) => {
    setEditedBody(value);
    setHasUnsavedEdits(true);
    saveDraftEdits();
  }, [saveDraftEdits]);

  // Regenerate draft with new times
  const handleRegenerateDraft = async () => {
    if (!schedulingRequestId) return;

    if (!confirm('This will generate new proposed times and email content. Your current edits will be lost. Continue?')) {
      return;
    }

    setRegeneratingDraft(true);
    setError(null);

    try {
      const res = await fetch(`/api/scheduler/requests/${schedulingRequestId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailType: 'initial_outreach' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to regenerate draft');
      }

      const data = await res.json();
      setDraft(data.draft);
      setEditedSubject(data.draft.subject);
      setEditedBody(data.draft.body);
      setDraftWarnings(data.warnings || []);
      setHasUnsavedEdits(false);

      console.log('[ScheduleMeetingModal] Draft regenerated with new times');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setRegeneratingDraft(false);
    }
  };

  const handleSendEmail = async () => {
    if (!schedulingRequestId) return;

    // Flush any pending edits to database before sending
    if (hasUnsavedEdits) {
      saveDraftEdits.flush();
      // Give it a moment to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setSending(true);
    setError(null);

    try {
      // Send endpoint now reads from database - no body needed
      const sendRes = await fetch(`/api/scheduler/requests/${schedulingRequestId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!sendRes.ok) {
        const sendData = await sendRes.json();
        throw new Error(sendData.error || 'Failed to send email');
      }

      const sendData = await sendRes.json();
      console.log('[ScheduleMeetingModal] Email sent:', sendData);

      // Resolve work item context if provided
      await resolveWorkItemContext('Scheduling email sent');

      onSuccess?.(schedulingRequestId);
      onClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSending(false);
    }
  };

  // Direct booking handler (for mode='direct')
  const handleDirectBook = async () => {
    if (!selectedTime || externalAttendees.length === 0) return;

    setSending(true);
    setError(null);

    try {
      // Calculate end time
      const startDate = new Date(selectedTime);
      const endDate = new Date(startDate.getTime() + duration * 60000);

      const response = await fetch('/api/meetings/direct-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || `Meeting with ${externalAttendees[0]?.name || 'Contact'}`,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          attendees: externalAttendees.map(a => ({
            email: a.email,
            name: a.name,
          })),
          isOnlineMeeting: true,
          companyId: companyId || workItem?.company_id,
          companyProductIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
          contactId: externalAttendees[0]?.contact_id,
          workItemId: workItem?.id,
          attentionFlagId: workItem?.metadata?.attention_flag_id as string | undefined,
          communicationId: linkedCommunication?.id || (workItem?.metadata?.communication_id as string | undefined),
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to book meeting');
      }

      // Call work item resolved callback
      onWorkItemResolved?.();
      onSuccess?.('direct');
      onClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book meeting');
    } finally {
      setSending(false);
    }
  };

  // Helper to resolve work item context (attention flags, communications)
  const resolveWorkItemContext = async (notes: string) => {
    if (!workItem) return;

    const attentionFlagId = workItem.metadata?.attention_flag_id as string | undefined;
    const communicationId = linkedCommunication?.id || (workItem.metadata?.communication_id as string | undefined);

    if (attentionFlagId) {
      try {
        await fetch(`/api/attention-flags/${attentionFlagId}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution_notes: notes }),
        });
      } catch (err) {
        console.error('[ScheduleMeetingModal] Failed to resolve attention flag:', err);
      }
    }

    if (communicationId && !attentionFlagId) {
      try {
        await fetch(`/api/communications/${communicationId}/respond`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        });
      } catch (err) {
        console.error('[ScheduleMeetingModal] Failed to mark communication responded:', err);
      }
    }

    onWorkItemResolved?.();
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
                {mode === 'direct'
                  ? workItem?.company_name
                    ? `with ${workItem.company_name}`
                    : 'Select a time and send invite'
                  : 'AI will handle outreach and scheduling'}
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

        {/* Work item resolution indicator */}
        {workItem && mode === 'staged' && (
          <div className="px-4 py-2 bg-green-50 border-b border-green-200 flex items-center gap-2 text-green-700 text-sm">
            <Zap className="h-4 w-4" />
            <span>Sending a scheduling email will resolve this work item</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : showingDraft ? (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-medium">AI-Generated Email Draft</span>
                </div>
                <p className="text-sm text-blue-600">
                  Review and edit the email before sending. The scheduling request has been created.
                </p>
              </div>

              {/* Availability Warning */}
              {availabilityInfo && !availabilityInfo.calendarChecked && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-700 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Calendar Not Checked</span>
                  </div>
                  <p className="text-sm text-amber-600">
                    {availabilityInfo.error ||
                      'Could not verify calendar availability. The proposed times may conflict with existing meetings.'}
                  </p>
                  {availabilityInfo.warnings && availabilityInfo.warnings.length > 0 && (
                    <ul className="mt-2 text-sm text-amber-600 list-disc list-inside">
                      {availabilityInfo.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Attendee Warnings (calendar checked but some attendees failed) */}
              {availabilityInfo && availabilityInfo.calendarChecked && availabilityInfo.warnings && availabilityInfo.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-700 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Availability Notice</span>
                  </div>
                  <ul className="text-sm text-amber-600 list-disc list-inside">
                    {availabilityInfo.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Regenerate button and status */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleRegenerateDraft}
                  disabled={regeneratingDraft}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-4 h-4", regeneratingDraft && "animate-spin")} />
                  {regeneratingDraft ? 'Regenerating...' : 'Get new times'}
                </button>
                {hasUnsavedEdits && (
                  <span className="text-xs text-amber-600">Saving...</span>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Body
                </label>
                <textarea
                  value={editedBody}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div className="text-xs text-gray-500">
                To: {externalAttendees.map(a => a.email).join(', ')}
              </div>

              {/* Show draft warnings */}
              {draftWarnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-700 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Notices</span>
                  </div>
                  <ul className="text-sm text-amber-600 list-disc list-inside">
                    {draftWarnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : mode === 'direct' ? (
            /* Direct Mode UI - simplified time slot selection */
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Meeting Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meeting Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter meeting title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Attendee */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  With
                </label>
                {externalAttendees.length > 0 ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{externalAttendees[0].name}</span>
                    <span className="text-sm text-gray-400">({externalAttendees[0].email})</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    No contact selected
                  </div>
                )}
              </div>

              {/* Suggested Times */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select a Time
                </label>
                <div className="space-y-2">
                  {suggestedTimes.map((time, i) => (
                    <button
                      key={i}
                      type="button"
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

              {/* Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <Video className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-700">Teams Meeting</span>
                  </div>
                </div>
              </div>
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

                {/* Company & Products association */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Building2 className="h-4 w-4 inline mr-1" />
                      Company (optional)
                    </label>
                    <select
                      value={companyId}
                      onChange={(e) => {
                        setCompanyId(e.target.value);
                        // Clear product selections when company changes
                        setSelectedProductIds([]);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    >
                      <option value="">None</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Products - only show when company is selected */}
                  {companyId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Briefcase className="h-4 w-4 inline mr-1" />
                        Products (optional)
                      </label>

                      {/* Selected products */}
                      {selectedProductIds.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {selectedProductIds.map(productId => {
                            const product = companyProducts.find(p => p.id === productId);
                            return product ? (
                              <span
                                key={productId}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700"
                              >
                                {product.product_name}
                                <button
                                  type="button"
                                  onClick={() => setSelectedProductIds(selectedProductIds.filter(id => id !== productId))}
                                  className="text-blue-400 hover:text-blue-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}

                      {/* Product selector - filtered by selected company */}
                      {(() => {
                        const existingProductIds = companyProducts
                          .filter(p => p.company_id === companyId)
                          .map(p => p.product_id);
                        const availableExistingProducts = companyProducts.filter(
                          p => p.company_id === companyId && !selectedProductIds.includes(p.id)
                        );
                        const productsToAdd = products.filter(
                          p => !existingProductIds.includes(p.id)
                        );

                        return (
                          <div className="space-y-2">
                            {/* Existing products for this company */}
                            {availableExistingProducts.length > 0 && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value && !selectedProductIds.includes(e.target.value)) {
                                    setSelectedProductIds([...selectedProductIds, e.target.value]);
                                  }
                                  e.target.value = '';
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                                defaultValue=""
                              >
                                <option value="" disabled>Select existing product...</option>
                                {availableExistingProducts.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.product_name}
                                  </option>
                                ))}
                              </select>
                            )}

                            {/* Add new product to company */}
                            {productsToAdd.length > 0 && (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    addProductToCompany(e.target.value);
                                  }
                                  e.target.value = '';
                                }}
                                disabled={addingProduct}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 disabled:opacity-50"
                                defaultValue=""
                              >
                                <option value="" disabled>
                                  {addingProduct ? 'Adding...' : '+ Add new product to company...'}
                                </option>
                                {productsToAdd.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name}
                                  </option>
                                ))}
                              </select>
                            )}

                            {availableExistingProducts.length === 0 && productsToAdd.length === 0 && (
                              <p className="text-sm text-gray-500">All products already selected</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
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
          {showingDraft ? (
            <>
              <button
                onClick={() => setShowingDraft(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Back to Details
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4" />
                    Send Email
                  </>
                )}
              </button>
            </>
          ) : mode === 'direct' ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDirectBook}
                disabled={!selectedTime || externalAttendees.length === 0 || sending}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending Invite...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4" />
                    Send Invite
                  </>
                )}
              </button>
            </>
          ) : (
            <>
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
                    Generating Preview...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
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
