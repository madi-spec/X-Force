'use client';

/**
 * AI Activity Page
 *
 * Shows audit trail of all AI-initiated actions:
 * - Timeline of actions taken by autopilot
 * - Filter by source (scheduler, communications, transcript)
 * - Filter by status (success, skipped, failed)
 * - Details modal for each action
 *
 * This page helps humans trust AI by providing full transparency.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  Calendar,
  FileText,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  ChevronRight,
  RefreshCw,
  Filter,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIActionLogEntry, AIActionSource, AIActionStatus } from '@/lib/autopilot/types';

// ============================================
// TYPES
// ============================================

interface AIActivityResponse {
  actions: AIActionLogEntry[];
  total: number;
  limit: number;
  offset: number;
  stats: {
    success: number;
    skipped: number;
    failed: number;
    bySource: Record<AIActionSource, number>;
  };
}

// ============================================
// CONSTANTS
// ============================================

const SOURCE_OPTIONS: { value: AIActionSource; label: string }[] = [
  { value: 'scheduler', label: 'Scheduler' },
  { value: 'communications', label: 'Communications' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'system', label: 'System' },
];

const STATUS_OPTIONS: { value: AIActionStatus; label: string }[] = [
  { value: 'success', label: 'Success' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'failed', label: 'Failed' },
];

// ============================================
// HELPERS
// ============================================

function getSourceIcon(source: AIActionSource) {
  switch (source) {
    case 'scheduler':
      return Calendar;
    case 'communications':
      return Mail;
    case 'transcript':
      return FileText;
    default:
      return Settings;
  }
}

function getStatusIcon(status: AIActionStatus) {
  switch (status) {
    case 'success':
      return CheckCircle;
    case 'skipped':
      return AlertCircle;
    case 'failed':
      return XCircle;
    default:
      return Clock;
  }
}

function getStatusColor(status: AIActionStatus) {
  switch (status) {
    case 'success':
      return 'text-green-600 bg-green-100';
    case 'skipped':
      return 'text-gray-600 bg-gray-100';
    case 'failed':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-yellow-600 bg-yellow-100';
  }
}

function formatActionType(actionType: string): string {
  return actionType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function groupByDate(actions: AIActionLogEntry[]): { date: string; actions: AIActionLogEntry[] }[] {
  const groups: Record<string, AIActionLogEntry[]> = {};

  for (const action of actions) {
    const date = new Date(action.created_at).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(action);
  }

  return Object.entries(groups).map(([date, actions]) => ({ date, actions }));
}

// ============================================
// COMPONENTS
// ============================================

function AIActionCard({
  action,
  onViewDetails,
}: {
  action: AIActionLogEntry;
  onViewDetails: () => void;
}) {
  const SourceIcon = getSourceIcon(action.source);
  const StatusIcon = getStatusIcon(action.status);
  const statusColor = getStatusColor(action.status);

  const companyName = (action.company as { name?: string } | null)?.name;
  const contactName = (action.contact as { name?: string } | null)?.name;
  const communicationSubject = (action.communication as { subject?: string } | null)?.subject;

  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] p-4 hover:shadow-md transition-all duration-300">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
          <SourceIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {formatActionType(action.action_type)}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full',
                statusColor
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {action.status}
            </span>
          </div>

          {(companyName || contactName || communicationSubject) && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              {companyName}
              {contactName && ` - ${contactName}`}
              {communicationSubject && ` - "${communicationSubject}"`}
            </p>
          )}

          {action.ai_reasoning && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-2">
              {action.ai_reasoning}
            </p>
          )}

          {action.error_message && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2">
              Error: {action.error_message}
            </p>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            {formatRelativeTime(action.created_at)}
          </p>
        </div>

        <button
          onClick={onViewDetails}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}

function AIActionDetailsModal({
  action,
  onClose,
}: {
  action: AIActionLogEntry;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#2a2a2a]">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Action Details
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Source</p>
              <p className="text-sm text-gray-900 dark:text-gray-100">{action.source}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Action Type</p>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {formatActionType(action.action_type)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
              <p className={cn('text-sm', getStatusColor(action.status).split(' ')[0])}>
                {action.status}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Created At</p>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {new Date(action.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {action.ai_reasoning && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">AI Reasoning</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                {action.ai_reasoning}
              </p>
            </div>
          )}

          {action.error_message && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Error</p>
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                {action.error_message}
              </p>
            </div>
          )}

          {action.inputs && Object.keys(action.inputs).length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Inputs</p>
              <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(action.inputs, null, 2)}
              </pre>
            </div>
          )}

          {action.outputs && Object.keys(action.outputs).length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Outputs</p>
              <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(action.outputs, null, 2)}
              </pre>
            </div>
          )}

          {action.idempotency_key && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Idempotency Key</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                {action.idempotency_key}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={cn('text-2xl font-light', color)}>{value.toLocaleString()}</p>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function AIActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [data, setData] = useState<AIActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<AIActionLogEntry | null>(null);

  // Filters from URL
  const sources = searchParams.get('source')?.split(',').filter(Boolean) || [];
  const statuses = searchParams.get('status')?.split(',').filter(Boolean) || [];

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (sources.length > 0) params.set('source', sources.join(','));
      if (statuses.length > 0) params.set('status', statuses.join(','));
      params.set('limit', '100');

      const res = await fetch(`/api/ai-activity?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sources.join(','), statuses.join(',')]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update URL with filters
  const updateFilters = (key: string, values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (values.length > 0) {
      params.set(key, values.join(','));
    } else {
      params.delete(key);
    }
    router.push(`/ai-activity?${params.toString()}`);
  };

  const toggleSource = (source: string) => {
    const newSources = sources.includes(source)
      ? sources.filter((s) => s !== source)
      : [...sources, source];
    updateFilters('source', newSources);
  };

  const toggleStatus = (status: string) => {
    const newStatuses = statuses.includes(status)
      ? statuses.filter((s) => s !== status)
      : [...statuses, status];
    updateFilters('status', newStatuses);
  };

  const clearFilters = () => {
    router.push('/ai-activity');
  };

  // Group actions by date
  const groupedActions = data ? groupByDate(data.actions) : [];
  const hasFilters = sources.length > 0 || statuses.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-normal text-gray-900 dark:text-gray-100">
            AI Activity
          </h1>
          <p className="text-xs text-gray-500">
            Audit trail of all AI-initiated actions
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-4 gap-4">
          <StatsCard
            label="Total Actions"
            value={data.total}
            color="text-gray-900 dark:text-gray-100"
          />
          <StatsCard
            label="Success"
            value={data.stats.success}
            color="text-green-600"
          />
          <StatsCard
            label="Skipped"
            value={data.stats.skipped}
            color="text-gray-600"
          />
          <StatsCard
            label="Failed"
            value={data.stats.failed}
            color="text-red-600"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-500">Filters:</span>
        </div>

        {/* Source filters */}
        <div className="flex items-center gap-1">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleSource(opt.value)}
              className={cn(
                'px-2 py-1 text-xs rounded-lg transition-colors',
                sources.includes(opt.value)
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => toggleStatus(opt.value)}
              className={cn(
                'px-2 py-1 text-xs rounded-lg transition-colors',
                statuses.includes(opt.value)
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Content */}
      {loading && !data ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : groupedActions.length === 0 ? (
        <div className="text-center py-12">
          <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No AI activity yet</p>
          <p className="text-xs text-gray-400 mt-1">
            AI actions will appear here once the autopilot runs
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedActions.map((group) => (
            <div key={group.date}>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                {group.date}
              </h3>
              <div className="space-y-2">
                {group.actions.map((action) => (
                  <AIActionCard
                    key={action.id}
                    action={action}
                    onViewDetails={() => setSelectedAction(action)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {selectedAction && (
        <AIActionDetailsModal
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
        />
      )}
    </div>
  );
}
