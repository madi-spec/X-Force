'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Building2,
  User,
  Calendar,
  Clock,
  Mail,
  Phone,
  Video,
  MapPin,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Send,
  MessageSquare,
  Play,
  Pause,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
  Package,
  Users,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Attendee {
  id: string;
  side: 'internal' | 'external';
  name: string;
  email: string;
  title: string | null;
  is_primary_contact: boolean;
  is_organizer: boolean;
  invite_status: string | null;
}

interface SchedulingAction {
  id: string;
  action_type: string;
  message_subject: string | null;
  message_content: string | null;
  previous_status: string | null;
  new_status: string | null;
  ai_reasoning: string | null;
  actor: string;
  created_at: string;
}

interface SourceCommunication {
  id: string;
  subject: string | null;
  channel: string;
  direction: string;
  occurred_at: string;
  content_preview: string | null;
}

interface SchedulingRequestDetail {
  id: string;
  title: string | null;
  meeting_type: string;
  duration_minutes: number;
  status: string;
  context: string | null;
  meeting_platform: string | null;
  meeting_link: string | null;
  meeting_location: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  preferred_times: { morning?: boolean; afternoon?: boolean; evening?: boolean } | null;
  timezone: string | null;
  proposed_times: string[] | null;
  scheduled_time: string | null;
  attempt_count: number;
  no_show_count: number;
  next_action_at: string | null;
  next_action_type: string | null;
  urgency: string | null;
  current_channel: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  created_at: string;
  company_id: string | null;
  company: { id: string; name: string } | null;
  source_communication_id: string | null;
  source_communication: SourceCommunication | null;
  attendees: Attendee[];
  actions: SchedulingAction[];
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
}

interface InternalUser {
  id: string;
  name: string;
  email: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  title: string | null;
  company_id: string | null;
  company: { id: string; name: string } | null;
}

interface CompanyProduct {
  id: string;
  status: string;
  product: {
    id: string;
    name: string;
    icon: string | null;
  };
}

interface SchedulingRequestDetailModalProps {
  isOpen: boolean;
  requestId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  initiated: { label: 'New', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  proposing: { label: 'Sending Options', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  awaiting_response: { label: 'Awaiting Response', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  negotiating: { label: 'Negotiating', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  confirming: { label: 'Confirming', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  confirmed: { label: 'Confirmed', color: 'text-green-700', bgColor: 'bg-green-100' },
  reminder_sent: { label: 'Reminder Sent', color: 'text-green-700', bgColor: 'bg-green-100' },
  completed: { label: 'Completed', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  no_show: { label: 'No Show', color: 'text-red-700', bgColor: 'bg-red-100' },
  cancelled: { label: 'Cancelled', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  paused: { label: 'Paused', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  discovery: 'Discovery Call',
  demo: 'Demo',
  follow_up: 'Follow-up',
  technical: 'Technical Review',
  executive: 'Executive Meeting',
  custom: 'Custom',
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  teams: <Video className="h-4 w-4" />,
  zoom: <Video className="h-4 w-4" />,
  google_meet: <Video className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  in_person: <MapPin className="h-4 w-4" />,
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  created: 'Request Created',
  email_sent: 'Email Sent',
  times_proposed: 'Times Proposed',
  time_selected: 'Time Selected',
  invite_sent: 'Invite Sent',
  invite_accepted: 'Invite Accepted',
  invite_declined: 'Invite Declined',
  reminder_sent: 'Reminder Sent',
  follow_up_sent: 'Follow-up Sent',
  status_changed: 'Status Changed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'Marked No Show',
};

export function SchedulingRequestDetailModal({
  isOpen,
  requestId,
  onClose,
  onUpdated,
}: SchedulingRequestDetailModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [request, setRequest] = useState<SchedulingRequestDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Edit mode states
  const [editingCompany, setEditingCompany] = useState(false);
  const [editingInternalAttendees, setEditingInternalAttendees] = useState(false);
  const [editingExternalAttendees, setEditingExternalAttendees] = useState(false);

  // Search states
  const [companySearch, setCompanySearch] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearchLoading, setCompanySearchLoading] = useState(false);

  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSearchLoading, setContactSearchLoading] = useState(false);

  // Products
  const [companyProducts, setCompanyProducts] = useState<CompanyProduct[]>([]);

  // Fetch request details
  useEffect(() => {
    if (!isOpen || !requestId) {
      setRequest(null);
      return;
    }

    async function fetchRequest() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/scheduler/requests/${requestId}`);
        if (res.ok) {
          const { data } = await res.json();
          setRequest(data);
        }
      } catch (error) {
        console.error('Error fetching request:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRequest();
  }, [isOpen, requestId]);

  // Reset when closing
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('details');
      setShowStatusDropdown(false);
      setEditingCompany(false);
      setEditingInternalAttendees(false);
      setEditingExternalAttendees(false);
      setCompanySearch('');
      setUserSearch('');
      setContactSearch('');
      setCompanies([]);
      setUsers([]);
      setContacts([]);
    }
  }, [isOpen]);

  // Fetch company products when company changes
  useEffect(() => {
    if (!request?.company_id) {
      setCompanyProducts([]);
      return;
    }

    async function fetchProducts() {
      const res = await fetch(`/api/companies/${request!.company_id}/products`);
      if (res.ok) {
        const data = await res.json();
        setCompanyProducts(data.companyProducts || []);
      }
    }
    fetchProducts();
  }, [request?.company_id]);

  // Debounced company search
  useEffect(() => {
    if (!editingCompany || companySearch.length < 2) {
      setCompanies([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCompanySearchLoading(true);
      try {
        const res = await fetch(`/api/companies?search=${encodeURIComponent(companySearch)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
        }
      } finally {
        setCompanySearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [companySearch, editingCompany]);

  // Debounced user search
  useEffect(() => {
    if (!editingInternalAttendees) {
      setUsers([]);
      return;
    }

    const timer = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const url = userSearch.length >= 2
          ? `/api/scheduler/users?search=${encodeURIComponent(userSearch)}&limit=20`
          : '/api/scheduler/users?limit=20';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearch, editingInternalAttendees]);

  // Debounced contact search
  useEffect(() => {
    if (!editingExternalAttendees || contactSearch.length < 2) {
      setContacts([]);
      return;
    }

    const timer = setTimeout(async () => {
      setContactSearchLoading(true);
      try {
        // If we have a company, filter contacts by company
        const params = new URLSearchParams({ search: contactSearch, limit: '20' });
        if (request?.company_id) {
          params.set('company_id', request.company_id);
        }
        const res = await fetch(`/api/contacts?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setContacts(data.contacts || []);
        }
      } finally {
        setContactSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [contactSearch, editingExternalAttendees, request?.company_id]);

  // Handler to update company
  const handleCompanySelect = async (company: Company) => {
    if (!request) return;

    setActionLoading('company');
    try {
      const res = await fetch(`/api/scheduler/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.id }),
      });

      if (res.ok) {
        const { data } = await res.json();
        setRequest((prev) => prev ? {
          ...prev,
          company_id: company.id,
          company: { id: company.id, name: company.name },
        } : null);
        onUpdated();
        setEditingCompany(false);
        setCompanySearch('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update company');
      }
    } catch (error) {
      console.error('Error updating company:', error);
      alert('Failed to update company');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler to add internal attendee
  const handleAddInternalAttendee = async (user: InternalUser) => {
    if (!request) return;

    setActionLoading(`add-user-${user.id}`);
    try {
      const res = await fetch(`/api/scheduler/requests/${request.id}/attendees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: 'internal',
          user_id: user.id,
          name: user.name,
          email: user.email,
        }),
      });

      if (res.ok) {
        // Refresh the request to get updated attendees
        const reqRes = await fetch(`/api/scheduler/requests/${request.id}`);
        if (reqRes.ok) {
          const { data } = await reqRes.json();
          setRequest(data);
        }
        onUpdated();
        setUserSearch('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add attendee');
      }
    } catch (error) {
      console.error('Error adding attendee:', error);
      alert('Failed to add attendee');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler to add external attendee
  const handleAddExternalAttendee = async (contact: Contact) => {
    if (!request) return;

    setActionLoading(`add-contact-${contact.id}`);
    try {
      const res = await fetch(`/api/scheduler/requests/${request.id}/attendees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: 'external',
          contact_id: contact.id,
          name: contact.name,
          email: contact.email,
          title: contact.title,
        }),
      });

      if (res.ok) {
        // Refresh the request to get updated attendees
        const reqRes = await fetch(`/api/scheduler/requests/${request.id}`);
        if (reqRes.ok) {
          const { data } = await reqRes.json();
          setRequest(data);
        }
        onUpdated();
        setContactSearch('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add attendee');
      }
    } catch (error) {
      console.error('Error adding attendee:', error);
      alert('Failed to add attendee');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler to remove attendee
  const handleRemoveAttendee = async (attendeeId: string) => {
    if (!request) return;
    if (!confirm('Remove this attendee?')) return;

    setActionLoading(`remove-${attendeeId}`);
    try {
      const res = await fetch(`/api/scheduler/requests/${request.id}/attendees?attendee_id=${attendeeId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setRequest((prev) => prev ? {
          ...prev,
          attendees: prev.attendees.filter((a) => a.id !== attendeeId),
        } : null);
        onUpdated();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove attendee');
      }
    } catch (error) {
      console.error('Error removing attendee:', error);
      alert('Failed to remove attendee');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!request) return;

    setActionLoading('status');
    try {
      const res = await fetch(`/api/scheduler/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        const { data } = await res.json();
        setRequest(data);
        onUpdated();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setActionLoading(null);
      setShowStatusDropdown(false);
    }
  };

  const handleCancel = async () => {
    if (!request) return;
    if (!confirm('Are you sure you want to cancel this scheduling request?')) return;

    setActionLoading('cancel');
    try {
      const res = await fetch(`/api/scheduler/requests/${request.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        onUpdated();
        onClose();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel request');
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
      alert('Failed to cancel request');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getAvailableStatusTransitions = (currentStatus: string): string[] => {
    const transitions: Record<string, string[]> = {
      initiated: ['proposing', 'paused', 'cancelled'],
      proposing: ['awaiting_response', 'paused', 'cancelled'],
      awaiting_response: ['negotiating', 'confirming', 'proposing', 'paused', 'cancelled'],
      negotiating: ['confirming', 'proposing', 'paused', 'cancelled'],
      confirming: ['confirmed', 'negotiating', 'paused', 'cancelled'],
      confirmed: ['reminder_sent', 'completed', 'no_show', 'cancelled'],
      reminder_sent: ['completed', 'no_show', 'cancelled'],
      no_show: ['proposing', 'cancelled'],
      paused: ['initiated', 'proposing', 'cancelled'],
    };
    return transitions[currentStatus] || [];
  };

  if (!isOpen) return null;

  const statusConfig = request ? STATUS_CONFIG[request.status] || STATUS_CONFIG.initiated : STATUS_CONFIG.initiated;
  const availableTransitions = request ? getAvailableStatusTransitions(request.status) : [];
  const externalAttendees = (request?.attendees || []).filter(a => a.side === 'external');
  const internalAttendees = (request?.attendees || []).filter(a => a.side === 'internal');

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#2a2a2a]">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-500" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Scheduling Request
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {request?.company ? (
                    <>
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{request.company.name}</span>
                    </>
                  ) : (
                    <span className="text-amber-600">No company assigned</span>
                  )}
                  <button
                    onClick={() => setEditingCompany(true)}
                    className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Change company"
                  >
                    <Pencil className="h-3 w-3 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-[#2a2a2a] px-6">
            <button
              onClick={() => setActiveTab('details')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'details'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              )}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'history'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              )}
            >
              History ({request?.actions?.length || 0})
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              </div>
            ) : !request ? (
              <div className="text-center py-12 text-gray-500">
                Request not found
              </div>
            ) : activeTab === 'details' ? (
              <div className="space-y-6">
                {/* Status & Quick Actions */}
                <div className="flex items-center justify-between">
                  <div className="relative">
                    <button
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      disabled={actionLoading !== null || availableTransitions.length === 0}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        statusConfig.bgColor,
                        statusConfig.color,
                        availableTransitions.length > 0 && 'hover:opacity-80 cursor-pointer'
                      )}
                    >
                      {actionLoading === 'status' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      {statusConfig.label}
                    </button>

                    {showStatusDropdown && availableTransitions.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10 min-w-[180px]">
                        {availableTransitions.map(status => {
                          const config = STATUS_CONFIG[status];
                          return (
                            <button
                              key={status}
                              onClick={() => handleStatusChange(status)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <span className={cn('w-2 h-2 rounded-full', config.bgColor)} />
                              {config.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {request.status === 'paused' ? (
                      <button
                        onClick={() => handleStatusChange('proposing')}
                        disabled={actionLoading !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                      >
                        <Play className="h-4 w-4" />
                        Resume
                      </button>
                    ) : request.status !== 'completed' && request.status !== 'cancelled' && (
                      <button
                        onClick={() => handleStatusChange('paused')}
                        disabled={actionLoading !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        <Pause className="h-4 w-4" />
                        Pause
                      </button>
                    )}

                    {request.status !== 'completed' && request.status !== 'cancelled' && (
                      <button
                        onClick={handleCancel}
                        disabled={actionLoading !== null}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                      >
                        {actionLoading === 'cancel' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Meeting Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Meeting Type
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {MEETING_TYPE_LABELS[request.meeting_type] || request.meeting_type}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Duration
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {request.duration_minutes} minutes
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Platform
                    </label>
                    <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                      {request.meeting_platform && PLATFORM_ICONS[request.meeting_platform]}
                      <span className="capitalize">{request.meeting_platform?.replace('_', ' ') || 'Not set'}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Attempts
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {request.attempt_count} attempt{request.attempt_count !== 1 ? 's' : ''}
                      {request.no_show_count > 0 && (
                        <span className="text-red-600 ml-2">({request.no_show_count} no-show)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Source Communication */}
                {request.source_communication && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Source Email
                          </p>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {request.source_communication.subject || 'No subject'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {request.source_communication.direction === 'inbound' ? 'Received' : 'Sent'}{' '}
                            {formatDate(request.source_communication.occurred_at)}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`/communications?id=${request.source_communication.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </a>
                    </div>
                  </div>
                )}

                {/* Scheduled Time */}
                {request.scheduled_time && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Meeting Scheduled</span>
                    </div>
                    <p className="text-green-900 dark:text-green-300 font-semibold">
                      {formatDateTime(request.scheduled_time)}
                    </p>
                    {request.meeting_link && (
                      <a
                        href={request.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 mt-2"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Join Meeting
                      </a>
                    )}
                  </div>
                )}

                {/* Date Range */}
                {!request.scheduled_time && (request.date_range_start || request.date_range_end) && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Available Date Range
                    </label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {formatDate(request.date_range_start)} - {formatDate(request.date_range_end)}
                    </p>
                  </div>
                )}

                {/* Proposed Times */}
                {request.proposed_times && request.proposed_times.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Proposed Times
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {request.proposed_times.map((time, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200"
                        >
                          {formatTime(time)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Company Products */}
                {companyProducts.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Products
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {companyProducts.map((cp) => (
                        <span
                          key={cp.id}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs',
                            cp.status === 'active' && 'bg-green-100 text-green-700',
                            cp.status === 'in_sales' && 'bg-yellow-100 text-yellow-700',
                            cp.status === 'in_onboarding' && 'bg-blue-100 text-blue-700',
                            !['active', 'in_sales', 'in_onboarding'].includes(cp.status) && 'bg-gray-100 text-gray-600'
                          )}
                        >
                          <span>{cp.product.icon || '📦'}</span>
                          {cp.product.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* External Attendees */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      External Attendees ({externalAttendees.length})
                    </label>
                    <button
                      onClick={() => setEditingExternalAttendees(!editingExternalAttendees)}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      {editingExternalAttendees ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {editingExternalAttendees ? 'Done' : 'Add'}
                    </button>
                  </div>

                  {/* Add External Attendee Search */}
                  {editingExternalAttendees && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          placeholder="Search contacts..."
                          className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        />
                        {contactSearchLoading && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                        )}
                      </div>
                      {contactSearch.length >= 2 && contacts.length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {contacts.map((contact) => {
                            const isAlreadyAttendee = externalAttendees.some(
                              (a) => a.email === contact.email
                            );
                            return (
                              <button
                                key={contact.id}
                                onClick={() => handleAddExternalAttendee(contact)}
                                disabled={isAlreadyAttendee || actionLoading === `add-contact-${contact.id}`}
                                className={cn(
                                  'w-full p-2 text-left text-sm rounded hover:bg-white dark:hover:bg-gray-700 flex items-center justify-between',
                                  isAlreadyAttendee && 'opacity-50'
                                )}
                              >
                                <div>
                                  <span className="font-medium">{contact.name}</span>
                                  <span className="text-gray-500 ml-2">{contact.email}</span>
                                </div>
                                {actionLoading === `add-contact-${contact.id}` ? (
                                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                                ) : isAlreadyAttendee ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Plus className="h-4 w-4 text-gray-400" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {contactSearch.length >= 2 && contacts.length === 0 && !contactSearchLoading && (
                        <p className="text-xs text-gray-500 py-2">No contacts found</p>
                      )}
                    </div>
                  )}

                  {externalAttendees.length > 0 ? (
                    <div className="space-y-2">
                      {externalAttendees.map(attendee => (
                        <div
                          key={attendee.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {attendee.name}
                                {attendee.is_primary_contact && (
                                  <span className="ml-2 text-xs text-blue-600">(Primary)</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500">{attendee.email}</p>
                              {attendee.title && (
                                <p className="text-xs text-gray-400">{attendee.title}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {attendee.invite_status && (
                              <span className={cn(
                                'text-xs px-2 py-1 rounded',
                                attendee.invite_status === 'accepted' && 'bg-green-100 text-green-700',
                                attendee.invite_status === 'declined' && 'bg-red-100 text-red-700',
                                attendee.invite_status === 'tentative' && 'bg-yellow-100 text-yellow-700',
                                attendee.invite_status === 'pending' && 'bg-gray-100 text-gray-700'
                              )}>
                                {attendee.invite_status}
                              </span>
                            )}
                            {!attendee.is_primary_contact && (
                              <button
                                onClick={() => handleRemoveAttendee(attendee.id)}
                                disabled={actionLoading === `remove-${attendee.id}`}
                                className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                {actionLoading === `remove-${attendee.id}` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No external attendees</p>
                  )}
                </div>

                {/* Internal Attendees */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Internal Attendees ({internalAttendees.length})
                    </label>
                    <button
                      onClick={() => setEditingInternalAttendees(!editingInternalAttendees)}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      {editingInternalAttendees ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {editingInternalAttendees ? 'Done' : 'Add'}
                    </button>
                  </div>

                  {/* Add Internal Attendee Search */}
                  {editingInternalAttendees && (
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Search team members..."
                          className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        />
                        {userSearchLoading && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                        )}
                      </div>
                      {users.length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {users.map((user) => {
                            const isAlreadyAttendee = internalAttendees.some(
                              (a) => a.email === user.email
                            );
                            return (
                              <button
                                key={user.id}
                                onClick={() => handleAddInternalAttendee(user)}
                                disabled={isAlreadyAttendee || actionLoading === `add-user-${user.id}`}
                                className={cn(
                                  'w-full p-2 text-left text-sm rounded hover:bg-white dark:hover:bg-gray-700 flex items-center justify-between',
                                  isAlreadyAttendee && 'opacity-50'
                                )}
                              >
                                <div>
                                  <span className="font-medium">{user.name}</span>
                                  <span className="text-gray-500 ml-2">{user.email}</span>
                                </div>
                                {actionLoading === `add-user-${user.id}` ? (
                                  <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
                                ) : isAlreadyAttendee ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Plus className="h-4 w-4 text-gray-400" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {internalAttendees.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {internalAttendees.map(attendee => (
                        <span
                          key={attendee.id}
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs group"
                        >
                          <User className="h-3 w-3" />
                          {attendee.name}
                          {attendee.is_organizer && <span className="text-blue-600">(Organizer)</span>}
                          {!attendee.is_organizer && (
                            <button
                              onClick={() => handleRemoveAttendee(attendee.id)}
                              disabled={actionLoading === `remove-${attendee.id}`}
                              className="ml-1 text-gray-400 hover:text-red-500"
                            >
                              {actionLoading === `remove-${attendee.id}` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No internal attendees</p>
                  )}
                </div>

                {/* Context */}
                {request.context && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Context / Notes
                    </label>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {request.context}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* History Tab */
              <div className="space-y-4">
                {(request?.actions?.length || 0) === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No actions recorded yet
                  </div>
                ) : (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

                    <div className="space-y-4">
                      {(request?.actions || []).map((action, index) => (
                        <div key={action.id} className="relative pl-10">
                          {/* Timeline dot */}
                          <div className={cn(
                            'absolute left-2.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900',
                            action.actor === 'ai' ? 'bg-purple-500' : 'bg-blue-500'
                          )} />

                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {ACTION_TYPE_LABELS[action.action_type] || action.action_type}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatTime(action.created_at)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                              <span className={cn(
                                'px-1.5 py-0.5 rounded',
                                action.actor === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                              )}>
                                {action.actor === 'ai' ? 'AI' : 'User'}
                              </span>
                              {action.previous_status && action.new_status && (
                                <span>
                                  {STATUS_CONFIG[action.previous_status]?.label} → {STATUS_CONFIG[action.new_status]?.label}
                                </span>
                              )}
                            </div>

                            {action.message_subject && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                <span className="font-medium">Subject:</span> {action.message_subject}
                              </p>
                            )}

                            {action.ai_reasoning && (
                              <p className="text-xs text-purple-600 dark:text-purple-400 italic">
                                AI: {action.ai_reasoning}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-[#2a2a2a] flex justify-between items-center">
            <div className="text-xs text-gray-500">
              Created {request ? formatDate(request.created_at) : ''}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>

          {/* Company Selection Overlay */}
          {editingCompany && (
            <div className="absolute inset-0 bg-white dark:bg-[#1a1a1a] flex flex-col rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#2a2a2a]">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-500" />
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Select Company
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setEditingCompany(false);
                    setCompanySearch('');
                  }}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Current Company */}
              {request?.company && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-[#2a2a2a]">
                  <p className="text-xs text-gray-500">
                    Current: <span className="font-medium text-gray-700 dark:text-gray-300">{request.company.name}</span>
                  </p>
                </div>
              )}

              {/* Search */}
              <div className="p-4 border-b border-gray-200 dark:border-[#2a2a2a]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="Search companies..."
                    autoFocus
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {companySearchLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                  )}
                </div>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto">
                {companySearch.length < 2 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    Type at least 2 characters to search
                  </div>
                ) : companies.length === 0 && !companySearchLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    No companies found
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {companies.map((company) => {
                      const isCurrent = request?.company_id === company.id;
                      return (
                        <button
                          key={company.id}
                          onClick={() => handleCompanySelect(company)}
                          disabled={actionLoading === 'company' || isCurrent}
                          className={cn(
                            'w-full px-4 py-3 text-left flex items-center justify-between',
                            'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                            isCurrent && 'bg-blue-50 dark:bg-blue-900/20'
                          )}
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {company.name}
                            </p>
                            {company.domain && (
                              <p className="text-xs text-gray-500">{company.domain}</p>
                            )}
                          </div>
                          {isCurrent ? (
                            <span className="text-xs text-blue-600 font-medium">Current</span>
                          ) : actionLoading === 'company' ? (
                            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4 text-gray-300" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
