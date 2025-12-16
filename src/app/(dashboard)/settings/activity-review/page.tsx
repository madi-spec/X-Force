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
  ExternalLink,
  AlertCircle,
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

interface Stats {
  total: number;
  pending: number;
  reviewNeeded: number;
  matched: number;
  excluded: number;
}

export default function ActivityReviewPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<Record<string, string>>({});
  const [excludeReason, setExcludeReason] = useState<Record<string, string>>({});

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

  useEffect(() => {
    fetchActivities();
    fetchDeals();
  }, [fetchActivities, fetchDeals]);

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
        // Remove from list
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
        // Remove from list
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
                      {activity.metadata?.fromEmail && (
                        <p className="text-gray-600">
                          <strong>From:</strong> {String(activity.metadata.fromEmail)}
                        </p>
                      )}
                      {activity.metadata?.to && Array.isArray(activity.metadata.to) && (
                        <p className="text-gray-600">
                          <strong>To:</strong> {activity.metadata.to.join(', ')}
                        </p>
                      )}
                      {activity.metadata?.attendees && Array.isArray(activity.metadata.attendees) && (
                        <p className="text-gray-600">
                          <strong>Attendees:</strong> {activity.metadata.attendees.join(', ')}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    {/* Exclude */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <X className="h-4 w-4 text-gray-500" />
                        <h4 className="font-medium text-gray-900">Exclude from Deals</h4>
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
    </div>
  );
}
