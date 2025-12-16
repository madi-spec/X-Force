'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Building2,
  Briefcase,
} from 'lucide-react';

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

interface TranscriptsTableProps {
  transcripts: Transcript[];
  onSort: (column: string) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onDelete: (ids: string[]) => void;
  onRegenerate: (ids: string[]) => void;
  loading?: boolean;
}

function getSentimentColor(sentiment: string | null): string {
  if (!sentiment) return 'bg-gray-100 text-gray-600';
  const s = sentiment.toLowerCase();
  if (s.includes('positive') || s.includes('very_positive')) return 'bg-green-100 text-green-700';
  if (s.includes('negative') || s.includes('very_negative')) return 'bg-red-100 text-red-700';
  return 'bg-yellow-100 text-yellow-700';
}

function getSourceBadge(source: string): { bg: string; text: string } {
  switch (source) {
    case 'fireflies':
      return { bg: 'bg-purple-100', text: 'text-purple-700' };
    case 'zoom':
      return { bg: 'bg-blue-100', text: 'text-blue-700' };
    case 'teams':
      return { bg: 'bg-cyan-100', text: 'text-cyan-700' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600' };
  }
}

function SortHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort
}: {
  label: string;
  column: string;
  sortBy: string;
  sortOrder: string;
  onSort: (column: string) => void;
}) {
  const isActive = sortBy === column;
  return (
    <button
      onClick={() => onSort(column)}
      className="flex items-center gap-1 hover:text-gray-900"
    >
      {label}
      {isActive ? (
        sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
      ) : (
        <ChevronUp className="h-4 w-4 opacity-30" />
      )}
    </button>
  );
}

export function TranscriptsTable({
  transcripts,
  onSort,
  sortBy,
  sortOrder,
  onDelete,
  onRegenerate,
  loading,
}: TranscriptsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transcripts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transcripts.map((t) => t.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} transcript(s)? This cannot be undone.`)) {
      onDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleBulkRegenerate = () => {
    if (selectedIds.size === 0) return;
    onRegenerate(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {selectedIds.size} transcript(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkRegenerate}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 rounded"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate Analysis
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 rounded"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === transcripts.length && transcripts.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortHeader label="Title" column="title" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortHeader label="Date" column="meeting_date" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company / Deal
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sentiment
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Metrics
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortHeader label="Words" column="word_count" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  Loading transcripts...
                </td>
              </tr>
            ) : transcripts.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No transcripts found
                </td>
              </tr>
            ) : (
              transcripts.map((transcript) => {
                const sourceBadge = getSourceBadge(transcript.source);
                return (
                  <tr key={transcript.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(transcript.id)}
                        onChange={() => toggleSelect(transcript.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={transcript.deal ? `/deals/${transcript.deal.id}?tab=transcripts&tid=${transcript.id}` : '#'}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-1"
                      >
                        {transcript.title}
                      </Link>
                      {transcript.analysis?.headline && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                          {transcript.analysis.headline}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {transcript.meetingDate
                        ? new Date(transcript.meetingDate).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${sourceBadge.bg} ${sourceBadge.text}`}>
                        {transcript.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {transcript.company && (
                          <Link
                            href={`/organizations/${transcript.company.id}`}
                            className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600"
                          >
                            <Building2 className="h-3 w-3" />
                            {transcript.company.name}
                          </Link>
                        )}
                        {transcript.deal && (
                          <Link
                            href={`/deals/${transcript.deal.id}`}
                            className="flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600"
                          >
                            <Briefcase className="h-3 w-3" />
                            {transcript.deal.name}
                          </Link>
                        )}
                        {!transcript.company && !transcript.deal && (
                          <span className="text-xs text-gray-400">Unassigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {transcript.analysis?.sentiment ? (
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getSentimentColor(transcript.analysis.sentiment)}`}>
                          {transcript.analysis.sentiment.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {transcript.analysis ? (
                        <div className="text-xs text-gray-600">
                          <span className="text-green-600">{transcript.analysis.buyingSignals} signals</span>
                          {' / '}
                          <span className="text-blue-600">{transcript.analysis.actionItems} actions</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {transcript.wordCount?.toLocaleString() || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {transcript.isAnalyzed ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
                          Analyzed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 relative">
                      <button
                        onClick={() => setActionMenuId(actionMenuId === transcript.id ? null : transcript.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <MoreHorizontal className="h-4 w-4 text-gray-500" />
                      </button>
                      {actionMenuId === transcript.id && (
                        <div className="absolute right-4 top-10 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                          {transcript.deal && (
                            <Link
                              href={`/deals/${transcript.deal.id}?tab=transcripts&tid=${transcript.id}`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              onClick={() => setActionMenuId(null)}
                            >
                              <ExternalLink className="h-4 w-4" />
                              View
                            </Link>
                          )}
                          <button
                            onClick={() => {
                              onRegenerate([transcript.id]);
                              setActionMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Regenerate
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this transcript?')) {
                                onDelete([transcript.id]);
                              }
                              setActionMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
