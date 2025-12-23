'use client';

import { Brain, RefreshCw, Clock } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

interface RelationshipSummaryCardProps {
  summary: string | null;
  updatedAt: string | null;
  healthScore: number | null;
  interactionCount: number;
  lastInteractionAt: string | null;
  onRefreshSummary?: () => void;
  isRefreshing?: boolean;
}

function getHealthScoreColor(score: number | null): string {
  if (score === null) return 'bg-gray-100 text-gray-600';
  if (score >= 80) return 'bg-green-100 text-green-700';
  if (score >= 60) return 'bg-yellow-100 text-yellow-700';
  if (score >= 40) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

function getHealthScoreLabel(score: number | null): string {
  if (score === null) return 'Not scored';
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}

export function RelationshipSummaryCard({
  summary,
  updatedAt,
  healthScore,
  interactionCount,
  lastInteractionAt,
  onRefreshSummary,
  isRefreshing = false,
}: RelationshipSummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-500" />
          <h3 className="font-medium text-gray-900">
            Relationship Summary
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {/* Health Score Badge */}
          <div
            className={cn(
              'px-3 py-1 rounded-full text-sm font-medium',
              getHealthScoreColor(healthScore)
            )}
          >
            {healthScore !== null ? `${healthScore}%` : 'N/A'} - {getHealthScoreLabel(healthScore)}
          </div>
          {/* Refresh Button */}
          {onRefreshSummary && (
            <button
              onClick={onRefreshSummary}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              title="Refresh summary"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            </button>
          )}
        </div>
      </div>

      {/* Summary Text */}
      <div className="mb-4">
        {summary ? (
          <p className="text-gray-700 leading-relaxed">
            {summary}
          </p>
        ) : (
          <p className="text-gray-500 italic">
            No relationship summary available yet. Continue engaging to build context.
          </p>
        )}
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="font-medium text-gray-900">
            {interactionCount}
          </span>
          <span>interactions</span>
        </div>
        {lastInteractionAt && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>Last contact {formatRelativeTime(lastInteractionAt)}</span>
          </div>
        )}
        {updatedAt && (
          <div className="text-sm text-gray-400">
            Summary updated {formatRelativeTime(updatedAt)}
          </div>
        )}
      </div>
    </div>
  );
}
