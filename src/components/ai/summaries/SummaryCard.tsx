'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Lightbulb, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  entityType: 'deal' | 'company' | 'contact';
  entityId: string;
  initialSummary?: any;
  className?: string;
}

export function SummaryCard({ entityType, entityId, initialSummary, className }: SummaryCardProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async (force = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ai/summaries/${entityType}/${entityId}`, {
        method: force ? 'POST' : 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setIsLoading(false);
    }
  };

  // Load summary on mount if not provided
  useState(() => {
    if (!initialSummary) {
      generateSummary();
    }
  });

  if (error) {
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-900">AI Summary</span>
          </div>
          <button
            onClick={() => generateSummary(true)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Retry
          </button>
        </div>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  if (isLoading && !summary) {
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium text-gray-900">AI Summary</span>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-900">AI Summary</span>
          </div>
          <button
            onClick={() => generateSummary(true)}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" />
            Generate
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">No AI summary available yet.</p>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-900">AI Summary</span>
            {summary.confidence && (
              <span className="text-xs text-gray-400">
                {Math.round(summary.confidence * 100)}% confidence
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {summary.generatedAt && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(summary.generatedAt).toLocaleDateString()}
              </span>
            )}
            <button
              onClick={() => generateSummary(true)}
              disabled={isLoading}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Regenerate summary"
            >
              <RefreshCw className={cn('h-4 w-4 text-gray-400', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* Headline & Overview */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">{summary.headline}</h3>
        <p className="text-sm text-gray-600 whitespace-pre-line">
          {isExpanded ? summary.overview : summary.overview?.substring(0, 300) + (summary.overview?.length > 300 ? '...' : '')}
        </p>
        {summary.overview?.length > 300 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-blue-600 hover:text-blue-700 mt-2 flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Show more
              </>
            )}
          </button>
        )}
      </div>

      {/* Risks & Opportunities */}
      {(summary.risks?.length > 0 || summary.opportunities?.length > 0) && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-4">
          {/* Risks */}
          {summary.risks?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-medium text-red-700">
                <AlertTriangle className="h-3 w-3" />
                Risks
              </div>
              <ul className="space-y-1">
                {summary.risks.slice(0, 3).map((risk: string, i: number) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                    <span className="text-red-400">•</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Opportunities */}
          {summary.opportunities?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-medium text-green-700">
                <Lightbulb className="h-3 w-3" />
                Opportunities
              </div>
              <ul className="space-y-1">
                {summary.opportunities.slice(0, 3).map((opp: string, i: number) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                    <span className="text-green-400">•</span>
                    {opp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recommended Actions */}
      {summary.recommendedActions?.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-xs font-medium text-gray-700 mb-2">Recommended Actions</div>
          <div className="space-y-2">
            {summary.recommendedActions.slice(0, 3).map((action: any, i: number) => (
              <div
                key={i}
                className={cn(
                  'text-xs p-2 rounded-lg border',
                  action.priority === 'high'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : action.priority === 'medium'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                )}
              >
                <span className="font-medium">{action.action}</span>
                {action.reasoning && (
                  <p className="text-xs opacity-75 mt-0.5">{action.reasoning}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
