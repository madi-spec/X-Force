'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Mail,
  Calendar,
  Building2,
  Briefcase,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Plus,
  User,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Activity {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
  external_id: string;
  match_status: string;
  match_confidence: number | null;
  match_reasoning: string | null;
  exclude_reason: string | null;
  company: { id: string; name: string } | null;
  deal: { id: string; name: string; stage: string } | null;
}

interface Deal {
  id: string;
  name: string;
  stage: string;
  company: { id: string; name: string } | null;
}

interface Company {
  id: string;
  name: string;
}

interface Stats {
  total: number;
  pending: number;
  reviewNeeded: number;
  matched: number;
  excluded: number;
}

interface ExtractedContact {
  name: string;
  email: string;
}

export default function ActivityReviewPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<Record<string, string>>({});
  const [excludeReason, setExcludeReason] = useState<Record<string, string>>({});

  // Create new modal state
  const [createModalActivity, setCreateModalActivity] = useState<Activity | null>(null);
  const [createStep, setCreateStep] = useState<'company' | 'deal' | 'contacts' | 'confirm'>('company');
  const [creatingEntity, setCreatingEntity] = useState(false);

  // Form data for creating new entities
  const [newCompanyName, setNewCompanyName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [newDealName, setNewDealName] = useState('');
  const [newDealStage, setNewDealStage] = useState('new_lead');
  const [contactsToCreate, setContactsToCreate] = useState<ExtractedContact[]>([]);
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null);
  const [createdDealId, setCreatedDealId] = useState<string | null>(null);

  // Filtered companies for search
  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', 'review_needed');
      params.set('limit', '50');

      const res = await fetch(`/api/activities/resolve-review?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setActivities(data.activities || []);
        setStats({
          total: data.count || 0,
          pending: 0,
          reviewNeeded: data.count || 0,
          matched: 0,
          excluded: 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch('/api/deals?limit=200');
      const data = await res.json();
      if (res.ok && data.deals) {
        setDeals(data.deals);
      }
    } catch (error) {
      console.error('Failed to fetch deals:', error);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies?limit=500');
      const data = await res.json();
      if (res.ok && data.companies) {
        setCompanies(data.companies);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    fetchDeals();
    fetchCompanies();
  }, [fetchActivities, fetchDeals, fetchCompanies]);

  const handleMatch = async (activityId: string) => {
    const dealId = selectedDealId[activityId];
    if (!dealId) {
      alert('Please select a deal to match');
      return;
    }

    setProcessingId(activityId);
    try {
      const res = await fetch('/api/activities/resolve-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId,
          action: 'match',
          dealId,
        }),
      });

      if (res.ok) {
        setActivities((prev) => prev.filter((a) => a.id !== activityId));
        setStats((prev) =>
          prev ? { ...prev, reviewNeeded: prev.reviewNeeded - 1, matched: prev.matched + 1 } : null
        );
      } else {
        const data = await res.json();
        alert(`Failed to match: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to match activity:', error);
      alert('Failed to match activity');
    } finally {
      setProcessingId(null);
    }
  };

  const handleExclude = async (activityId: string) => {
    setProcessingId(activityId);
    try {
      const res = await fetch('/api/activities/resolve-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId,
          action: 'exclude',
          excludeReason: excludeReason[activityId] || 'Manually excluded - not relevant to deals',
        }),
      });

      if (res.ok) {
        setActivities((prev) => prev.filter((a) => a.id !== activityId));
        setStats((prev) =>
          prev ? { ...prev, reviewNeeded: prev.reviewNeeded - 1, excluded: prev.excluded + 1 } : null
        );
      } else {
        const data = await res.json();
        alert(`Failed to exclude: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to exclude activity:', error);
      alert('Failed to exclude activity');
    } finally {
      setProcessingId(null);
    }
  };

  // Extract contacts from activity metadata
  const extractContactsFromActivity = (activity: Activity): ExtractedContact[] => {
    const contacts: ExtractedContact[] = [];
    const metadata = activity.metadata || {};

    // Extract from email 'to' field
    const toEmails = metadata.to as string[] | undefined;
    if (toEmails && Array.isArray(toEmails)) {
      toEmails.forEach((email) => {
        if (email && !email.includes('affiliatedtech.com') && !email.includes('xrailabs.com')) {
          contacts.push({
            name: email.split('@')[0].replace(/[._]/g, ' '),
            email: email.toLowerCase(),
          });
        }
      });
    }

    // Extract from email 'from' field
    const fromEmail = metadata.fromEmail as string | undefined;
    if (fromEmail && !fromEmail.includes('affiliatedtech.com') && !fromEmail.includes('xrailabs.com')) {
      contacts.push({
        name: fromEmail.split('@')[0].replace(/[._]/g, ' '),
        email: fromEmail.toLowerCase(),
      });
    }

    // Extract from calendar attendees
    const attendees = metadata.attendees as string[] | undefined;
    if (attendees && Array.isArray(attendees)) {
      attendees.forEach((attendee) => {
        if (attendee && !attendee.includes('affiliatedtech.com') && !attendee.includes('xrailabs.com')) {
          contacts.push({
            name: attendee.split('@')[0].replace(/[._]/g, ' '),
            email: attendee.toLowerCase(),
          });
        }
      });
    }

    // Dedupe by email
    const seen = new Set<string>();
    return contacts.filter((c) => {
      if (seen.has(c.email)) return false;
      seen.add(c.email);
      return true;
    });
  };

  // Extract company name guess from activity
  const guessCompanyName = (activity: Activity): string => {
    const metadata = activity.metadata || {};

    // Try to find external email domain
    const emails: string[] = [
      ...(metadata.to as string[] || []),
      metadata.fromEmail as string || '',
      ...(metadata.attendees as string[] || []),
    ].filter((e) => e && !e.includes('affiliatedtech.com') && !e.includes('xrailabs.com'));

    if (emails.length > 0) {
      const domain = emails[0].split('@')[1];
      if (domain) {
        // Convert domain to company name (e.g., "acme-pest.com" -> "Acme Pest")
        return domain
          .replace(/\.(com|net|org|io|co)$/, '')
          .replace(/[-_]/g, ' ')
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
    }

    // Fall back to subject parsing
    return '';
  };

  const openCreateModal = (activity: Activity) => {
    setCreateModalActivity(activity);
    setCreateStep('company');
    setCreatingEntity(false);

    // Pre-fill data from activity
    const guessedName = guessCompanyName(activity);
    setNewCompanyName(guessedName);
    setSelectedCompanyId('');
    setNewDealName(activity.subject || 'New Deal');
    setNewDealStage('new_lead');
    setContactsToCreate(extractContactsFromActivity(activity));
    setCreatedCompanyId(null);
    setCreatedDealId(null);
  };

  const closeCreateModal = () => {
    setCreateModalActivity(null);
    setCreateStep('company');
    setCreatingEntity(false);
    setNewCompanyName('');
    setSelectedCompanyId('');
    setCompanySearch('');
    setShowCompanyDropdown(false);
    setNewDealName('');
    setContactsToCreate([]);
    setCreatedCompanyId(null);
    setCreatedDealId(null);
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim() && !selectedCompanyId) {
      alert('Please enter a company name or select an existing company');
      return;
    }

    setCreatingEntity(true);
    try {
      if (selectedCompanyId) {
        // Use existing company
        setCreatedCompanyId(selectedCompanyId);
        setCreateStep('deal');
      } else {
        // Create new company
        const res = await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCompanyName.trim() }),
        });

        const data = await res.json();

        if (res.ok) {
          setCreatedCompanyId(data.company.id);
          setCompanies((prev) => [...prev, data.company]);
          setCreateStep('deal');
        } else if (res.status === 409 && data.existing) {
          // Company exists, offer to use it
          if (confirm(`Company "${data.existing.name}" already exists. Use this company?`)) {
            setCreatedCompanyId(data.existing.id);
            setCreateStep('deal');
          }
        } else {
          alert(`Failed to create company: ${data.error}`);
        }
      }
    } catch (error) {
      console.error('Failed to create company:', error);
      alert('Failed to create company');
    } finally {
      setCreatingEntity(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!newDealName.trim()) {
      alert('Please enter a deal name');
      return;
    }

    if (!createdCompanyId) {
      alert('No company selected');
      return;
    }

    setCreatingEntity(true);
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDealName.trim(),
          company_id: createdCompanyId,
          stage: newDealStage,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCreatedDealId(data.deal.id);
        setDeals((prev) => [data.deal, ...prev]);

        if (contactsToCreate.length > 0) {
          setCreateStep('contacts');
        } else {
          setCreateStep('confirm');
        }
      } else {
        alert(`Failed to create deal: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to create deal:', error);
      alert('Failed to create deal');
    } finally {
      setCreatingEntity(false);
    }
  };

  const handleCreateContacts = async () => {
    if (!createdCompanyId) {
      alert('No company selected');
      return;
    }

    setCreatingEntity(true);
    try {
      for (const contact of contactsToCreate) {
        if (!contact.name.trim()) continue;

        await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: contact.name.trim(),
            email: contact.email,
            company_id: createdCompanyId,
          }),
        });
      }
      setCreateStep('confirm');
    } catch (error) {
      console.error('Failed to create contacts:', error);
      alert('Some contacts may not have been created');
      setCreateStep('confirm');
    } finally {
      setCreatingEntity(false);
    }
  };

  const handleFinalMatch = async () => {
    if (!createModalActivity || !createdDealId) return;

    setCreatingEntity(true);
    try {
      const res = await fetch('/api/activities/resolve-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: createModalActivity.id,
          action: 'match',
          dealId: createdDealId,
          companyId: createdCompanyId,
        }),
      });

      if (res.ok) {
        setActivities((prev) => prev.filter((a) => a.id !== createModalActivity.id));
        setStats((prev) =>
          prev ? { ...prev, reviewNeeded: prev.reviewNeeded - 1, matched: prev.matched + 1 } : null
        );
        closeCreateModal();
      } else {
        const data = await res.json();
        alert(`Failed to match: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to match activity:', error);
      alert('Failed to match activity');
    } finally {
      setCreatingEntity(false);
    }
  };

  const filteredActivities = activities.filter((a) => {
    const matchesSearch =
      !search ||
      a.subject?.toLowerCase().includes(search.toLowerCase()) ||
      a.body?.toLowerCase().includes(search.toLowerCase());
    const matchesType = !typeFilter || a.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    if (type === 'meeting') return <Calendar className="h-4 w-4 text-purple-500" />;
    if (type === 'email_sent') return <Mail className="h-4 w-4 text-blue-500" />;
    return <Mail className="h-4 w-4 text-green-500" />;
  };

  const getTypeLabel = (type: string) => {
    if (type === 'meeting') return 'Calendar Event';
    if (type === 'email_sent') return 'Sent Email';
    return 'Received Email';
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity Review</h1>
            <p className="text-gray-500 mt-1">
              Review and match imported activities to deals
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-amber-600">{stats.reviewNeeded}</div>
            <div className="text-sm text-gray-500">Needs Review</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">{stats.matched}</div>
            <div className="text-sm text-gray-500">Matched (this session)</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-600">{stats.excluded}</div>
            <div className="text-sm text-gray-500">Excluded (this session)</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{filteredActivities.length}</div>
            <div className="text-sm text-gray-500">Showing</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by subject or content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="email_sent">Sent Emails</option>
            <option value="email_received">Received Emails</option>
            <option value="meeting">Calendar Events</option>
          </select>

          <button
            onClick={fetchActivities}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Refresh
          </button>
        </div>
      </div>

      {/* Activity List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">All caught up!</p>
          <p className="text-sm text-gray-500 mt-1">
            No activities need review at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredActivities.map((activity) => (
            <div
              key={activity.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Activity Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === activity.id ? null : activity.id)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getTypeIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {getTypeLabel(activity.type)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(activity.occurred_at)}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900 mt-1 truncate">
                      {activity.subject || '(No subject)'}
                    </h3>
                    {activity.match_reasoning && (
                      <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {activity.match_reasoning.slice(0, 100)}...
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {expandedId === activity.id ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === activity.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  {/* Activity Details */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Details</h4>
                    <div className="bg-white rounded-lg border border-gray-200 p-3 text-sm">
                      {Boolean(activity.metadata?.fromEmail) && (
                        <p className="text-gray-600">
                          <strong>From:</strong> {String(activity.metadata?.fromEmail)}
                        </p>
                      )}
                      {Array.isArray(activity.metadata?.to) && (
                        <p className="text-gray-600">
                          <strong>To:</strong> {(activity.metadata.to as string[]).join(', ')}
                        </p>
                      )}
                      {Array.isArray(activity.metadata?.attendees) && (
                        <p className="text-gray-600">
                          <strong>Attendees:</strong> {(activity.metadata.attendees as string[]).join(', ')}
                        </p>
                      )}
                      {activity.body && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-gray-600 whitespace-pre-wrap line-clamp-6">
                            {activity.body.slice(0, 500)}
                            {activity.body.length > 500 ? '...' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Reasoning */}
                  {activity.match_reasoning && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">AI Analysis</h4>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                        {activity.match_reasoning}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Match to Deal */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Briefcase className="h-4 w-4 text-blue-500" />
                        <h4 className="font-medium text-gray-900">Match to Deal</h4>
                      </div>
                      <select
                        value={selectedDealId[activity.id] || ''}
                        onChange={(e) =>
                          setSelectedDealId((prev) => ({ ...prev, [activity.id]: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm mb-3"
                      >
                        <option value="">Select a deal...</option>
                        {deals.map((deal) => (
                          <option key={deal.id} value={deal.id}>
                            {deal.name} {deal.company ? `(${deal.company.name})` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleMatch(activity.id)}
                        disabled={!selectedDealId[activity.id] || processingId === activity.id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingId === activity.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Match to Deal
                      </button>
                    </div>

                    {/* Create New */}
                    <div className="bg-white rounded-lg border border-green-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Plus className="h-4 w-4 text-green-500" />
                        <h4 className="font-medium text-gray-900">Create New</h4>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">
                        Create a new company, deal, and contacts from this activity
                      </p>
                      <button
                        onClick={() => openCreateModal(activity)}
                        disabled={processingId === activity.id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" />
                        Create New...
                      </button>
                    </div>

                    {/* Exclude */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <X className="h-4 w-4 text-gray-500" />
                        <h4 className="font-medium text-gray-900">Exclude</h4>
                      </div>
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={excludeReason[activity.id] || ''}
                        onChange={(e) =>
                          setExcludeReason((prev) => ({ ...prev, [activity.id]: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 text-sm mb-3"
                      />
                      <button
                        onClick={() => handleExclude(activity.id)}
                        disabled={processingId === activity.id}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingId === activity.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        Exclude Activity
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {filteredActivities.length >= 50 && (
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Showing first 50 activities. Review some to see more.
          </p>
        </div>
      )}

      {/* Create Modal */}
      {createModalActivity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Create from Activity
                </h2>
                <button
                  onClick={closeCreateModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Progress Steps */}
              <div className="flex items-center gap-2 mb-6">
                {['company', 'deal', 'contacts', 'confirm'].map((step, idx) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        createStep === step
                          ? 'bg-blue-600 text-white'
                          : idx < ['company', 'deal', 'contacts', 'confirm'].indexOf(createStep)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {idx < ['company', 'deal', 'contacts', 'confirm'].indexOf(createStep) ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    {idx < 3 && (
                      <div
                        className={`w-8 h-0.5 ${
                          idx < ['company', 'deal', 'contacts', 'confirm'].indexOf(createStep)
                            ? 'bg-green-500'
                            : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Step Content */}
              {createStep === 'company' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="h-5 w-5 text-gray-500" />
                    <h3 className="font-medium text-gray-900">Select or Create Company</h3>
                  </div>

                  <div className="space-y-4">
                    {/* Selected Company Display */}
                    {selectedCompanyId && (
                      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-900">
                            {companies.find((c) => c.id === selectedCompanyId)?.name}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCompanyId('');
                            setCompanySearch('');
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Change
                        </button>
                      </div>
                    )}

                    {/* Company Search */}
                    {!selectedCompanyId && (
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Search Existing Companies
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            value={companySearch}
                            onChange={(e) => {
                              setCompanySearch(e.target.value);
                              setShowCompanyDropdown(true);
                            }}
                            onFocus={() => setShowCompanyDropdown(true)}
                            placeholder="Type to search companies..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Company Dropdown */}
                        {showCompanyDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredCompanies.length > 0 ? (
                              <>
                                {filteredCompanies.slice(0, 10).map((c) => (
                                  <button
                                    key={c.id}
                                    onClick={() => {
                                      setSelectedCompanyId(c.id);
                                      setCompanySearch('');
                                      setShowCompanyDropdown(false);
                                      setNewCompanyName('');
                                    }}
                                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Building2 className="h-4 w-4 text-gray-400" />
                                    <span>{c.name}</span>
                                  </button>
                                ))}
                                {filteredCompanies.length > 10 && (
                                  <div className="px-4 py-2 text-sm text-gray-500 border-t">
                                    +{filteredCompanies.length - 10} more results
                                  </div>
                                )}
                              </>
                            ) : companySearch ? (
                              <div className="px-4 py-3 text-sm text-gray-500">
                                No companies found matching &quot;{companySearch}&quot;
                              </div>
                            ) : (
                              <div className="px-4 py-2 text-sm text-gray-500">
                                Type to search...
                              </div>
                            )}
                            <button
                              onClick={() => setShowCompanyDropdown(false)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 border-t"
                            >
                              Close
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Create New Company */}
                    {!selectedCompanyId && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Or Create New Company
                        </label>
                        <input
                          type="text"
                          value={newCompanyName}
                          onChange={(e) => setNewCompanyName(e.target.value)}
                          placeholder="Enter new company name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={closeCreateModal}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateCompany}
                      disabled={creatingEntity || (!newCompanyName.trim() && !selectedCompanyId)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {creatingEntity && <Loader2 className="h-4 w-4 animate-spin" />}
                      Next: Create Deal
                    </button>
                  </div>
                </div>
              )}

              {createStep === 'deal' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Briefcase className="h-5 w-5 text-gray-500" />
                    <h3 className="font-medium text-gray-900">Create Deal</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Deal Name
                      </label>
                      <input
                        type="text"
                        value={newDealName}
                        onChange={(e) => setNewDealName(e.target.value)}
                        placeholder="Enter deal name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stage
                      </label>
                      <select
                        value={newDealStage}
                        onChange={(e) => setNewDealStage(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="new_lead">New Lead</option>
                        <option value="qualifying">Qualifying</option>
                        <option value="discovery">Discovery</option>
                        <option value="demo">Demo</option>
                        <option value="data_review">Data Review</option>
                        <option value="trial">Trial</option>
                        <option value="negotiation">Negotiation</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setCreateStep('company')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleCreateDeal}
                      disabled={creatingEntity || !newDealName.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {creatingEntity && <Loader2 className="h-4 w-4 animate-spin" />}
                      {contactsToCreate.length > 0 ? 'Next: Add Contacts' : 'Complete'}
                    </button>
                  </div>
                </div>
              )}

              {createStep === 'contacts' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-5 w-5 text-gray-500" />
                    <h3 className="font-medium text-gray-900">Add Contacts (Optional)</h3>
                  </div>

                  <p className="text-sm text-gray-500 mb-4">
                    Found {contactsToCreate.length} potential contact(s) from this activity:
                  </p>

                  <div className="space-y-3">
                    {contactsToCreate.map((contact, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) => {
                            const updated = [...contactsToCreate];
                            updated[idx].name = e.target.value;
                            setContactsToCreate(updated);
                          }}
                          placeholder="Name"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <span className="text-sm text-gray-500 truncate max-w-[150px]">
                          {contact.email}
                        </span>
                        <button
                          onClick={() => {
                            setContactsToCreate((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {contactsToCreate.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      No contacts to add
                    </p>
                  )}

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setCreateStep('deal')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setCreateStep('confirm')}
                      className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                      Skip Contacts
                    </button>
                    <button
                      onClick={handleCreateContacts}
                      disabled={creatingEntity || contactsToCreate.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {creatingEntity && <Loader2 className="h-4 w-4 animate-spin" />}
                      Create Contacts
                    </button>
                  </div>
                </div>
              )}

              {createStep === 'confirm' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Check className="h-5 w-5 text-green-500" />
                    <h3 className="font-medium text-gray-900">Ready to Match</h3>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-green-800">
                      Created successfully! Click below to match this activity to the new deal.
                    </p>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 mb-6">
                    <p><strong>Company:</strong> {newCompanyName || companies.find(c => c.id === selectedCompanyId)?.name}</p>
                    <p><strong>Deal:</strong> {newDealName}</p>
                    {contactsToCreate.length > 0 && (
                      <p><strong>Contacts:</strong> {contactsToCreate.map(c => c.name).join(', ')}</p>
                    )}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={closeCreateModal}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Close Without Matching
                    </button>
                    <button
                      onClick={handleFinalMatch}
                      disabled={creatingEntity}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {creatingEntity && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Check className="h-4 w-4" />
                      Match Activity to Deal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
