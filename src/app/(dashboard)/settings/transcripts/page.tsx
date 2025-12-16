'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Filter, Download, Loader2, FileText } from 'lucide-react';
import { TranscriptsTable } from '@/components/settings/TranscriptsTable';

interface Transcript {
  id: string;
  title: string;
  meetingDate: string;
  source: string;
  wordCount: number;
  summary: string | null;
  attendees: string[] | null;
  createdAt: string;
  company: { id: string; name: string } | null;
  deal: { id: string; name: string; stage: string } | null;
  analysis: {
    sentiment: string | null;
    buyingSignals: number;
    actionItems: number;
    headline: string | null;
  } | null;
  isAnalyzed: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  total: number;
  analyzed: number;
  bySource: Record<string, number>;
}

export default function TranscriptsPage() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [analyzed, setAnalyzed] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchTranscripts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      if (search) params.set('search', search);
      if (source) params.set('source', source);
      if (sentiment) params.set('sentiment', sentiment);
      if (analyzed) params.set('analyzed', analyzed);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/transcripts?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        console.error('API Error:', data.error, data.details || '');
        return;
      }

      setTranscripts(data.transcripts || []);
      setPagination(data.pagination || pagination);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Failed to fetch transcripts:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, sortBy, sortOrder, search, source, sentiment, analyzed, dateFrom, dateTo]);

  useEffect(() => {
    fetchTranscripts();
  }, [fetchTranscripts]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleDelete = async (ids: string[]) => {
    try {
      const res = await fetch('/api/transcripts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        fetchTranscripts();
      }
    } catch (error) {
      console.error('Failed to delete transcripts:', error);
    }
  };

  const [analyzing, setAnalyzing] = useState(false);

  const handleRegenerate = async (ids: string[]) => {
    if (analyzing) return;

    setAnalyzing(true);
    try {
      const res = await fetch('/api/transcripts/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert('Failed to analyze: ' + (data.error || 'Unknown error'));
        return;
      }

      alert(data.message);
      fetchTranscripts(); // Refresh the list
    } catch (error) {
      console.error('Failed to regenerate analysis:', error);
      alert('Failed to regenerate analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExport = () => {
    // Create CSV content
    const headers = ['Title', 'Date', 'Source', 'Company', 'Deal', 'Sentiment', 'Buying Signals', 'Action Items', 'Word Count', 'Status'];
    const rows = transcripts.map((t) => [
      t.title,
      t.meetingDate || '',
      t.source,
      t.company?.name || '',
      t.deal?.name || '',
      t.analysis?.sentiment || '',
      t.analysis?.buyingSignals || 0,
      t.analysis?.actionItems || 0,
      t.wordCount || 0,
      t.isAnalyzed ? 'Analyzed' : 'Pending',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcripts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch('');
    setSource('');
    setSentiment('');
    setAnalyzed('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="max-w-7xl mx-auto">
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
            <h1 className="text-xl font-normal text-gray-900">Transcripts Log</h1>
            <p className="text-xs text-gray-500 mt-1">
              View and manage all synced meeting transcripts
            </p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Transcripts</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">{stats.analyzed}</div>
            <div className="text-sm text-gray-500">Analyzed</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.bySource['fireflies'] || 0}</div>
            <div className="text-sm text-gray-500">From Fireflies</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-600">{stats.bySource['manual'] || 0}</div>
            <div className="text-sm text-gray-500">Manual Upload</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search transcripts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Quick Filters */}
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sources</option>
            <option value="fireflies">Fireflies</option>
            <option value="manual">Manual</option>
            <option value="zoom">Zoom</option>
            <option value="teams">Teams</option>
          </select>

          <select
            value={analyzed}
            onChange={(e) => setAnalyzed(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="true">Analyzed</option>
            <option value="false">Pending</option>
          </select>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg ${
              showFilters ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            More Filters
          </button>

          {(search || source || sentiment || analyzed || dateFrom || dateTo) && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sentiment</label>
              <select
                value={sentiment}
                onChange={(e) => setSentiment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <TranscriptsTable
        transcripts={transcripts}
        onSort={handleSort}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onDelete={handleDelete}
        onRegenerate={handleRegenerate}
        loading={loading}
      />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
            <select
              value={pagination.limit}
              onChange={(e) => setPagination({ ...pagination, page: 1, limit: parseInt(e.target.value) })}
              className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg"
            >
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && transcripts.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No transcripts found</p>
          <p className="text-sm text-gray-400 mt-1">
            Transcripts will appear here once synced from Fireflies or uploaded manually.
          </p>
        </div>
      )}
    </div>
  );
}
