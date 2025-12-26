'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Archive, RefreshCw, Clock, X, Loader2, Building2 } from 'lucide-react';

interface LegacyDeal {
  id: string;
  company_id: string;
  company_name: string;
  product_id: string;
  product_name: string;
  stage_id: string | null;
  stage_name: string | null;
  last_human_touch_at: string | null;
  created_at: string;
  snoozed_until: string | null;
  status: string;
}

export function LegacyDealsView() {
  const [deals, setDeals] = useState<LegacyDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/legacy-deals');
      if (!res.ok) throw new Error('Failed to fetch legacy deals');
      const data = await res.json();
      setDeals(data.deals || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching legacy deals:', err);
      setError('Failed to load legacy deals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const handleReEngage = async (dealId: string) => {
    setActionLoading(dealId);
    try {
      const res = await fetch(`/api/legacy-deals/${dealId}/re-engage`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to re-engage deal');
      }
      // Remove from list after successful re-engage
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
    } catch (err) {
      console.error('Error re-engaging deal:', err);
      alert(err instanceof Error ? err.message : 'Failed to re-engage deal');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSnooze = async (dealId: string) => {
    setActionLoading(dealId);
    try {
      const res = await fetch(`/api/legacy-deals/${dealId}/snooze`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to snooze deal');
      }
      // Remove from list after successful snooze
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
    } catch (err) {
      console.error('Error snoozing deal:', err);
      alert(err instanceof Error ? err.message : 'Failed to snooze deal');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async (dealId: string) => {
    if (!confirm('Are you sure you want to close this deal as lost?')) {
      return;
    }
    setActionLoading(dealId);
    try {
      const res = await fetch(`/api/legacy-deals/${dealId}/close`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to close deal');
      }
      // Remove from list after successful close
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
    } catch (err) {
      console.error('Error closing deal:', err);
      alert(err instanceof Error ? err.message : 'Failed to close deal');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchDeals}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Archive className="h-6 w-6 text-gray-400" />
          <h1 className="text-xl font-normal text-gray-900">Legacy Deals</h1>
        </div>
        <p className="text-sm text-gray-500">
          Older deals that need attention. Re-engage to move them into active sales, snooze to revisit later, or close if no longer relevant.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
        <div className="text-2xl font-light text-gray-900">{deals.length}</div>
        <div className="text-xs text-gray-500 uppercase tracking-wider">Legacy Deals</div>
      </div>

      {/* Deals List */}
      {deals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Archive className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No legacy deals</p>
          <p className="text-sm text-gray-400 mt-1">All deals are up to date</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Company
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Product
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Stage
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Last Touch
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Created
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deals.map((deal) => (
                <tr key={deal.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/companies/${deal.company_id}`}
                      className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      <Building2 className="h-4 w-4 text-gray-400" />
                      {deal.company_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{deal.product_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    {deal.stage_name ? (
                      <span className="text-sm text-gray-700">{deal.stage_name}</span>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Not started</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-sm text-gray-500"
                      title={deal.last_human_touch_at ? formatDate(deal.last_human_touch_at) : undefined}
                    >
                      {formatRelativeDate(deal.last_human_touch_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-500">{formatDate(deal.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {actionLoading === deal.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      ) : (
                        <>
                          <button
                            onClick={() => handleReEngage(deal.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                            title="Re-engage: Move to active sales"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Re-engage
                          </button>
                          <button
                            onClick={() => handleSnooze(deal.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Snooze for 14 days"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            Snooze
                          </button>
                          <button
                            onClick={() => handleClose(deal.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Close as lost"
                          >
                            <X className="h-3.5 w-3.5" />
                            Close
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
