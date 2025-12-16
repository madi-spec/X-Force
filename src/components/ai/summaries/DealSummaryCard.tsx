'use client';

import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Lightbulb, Users, Activity, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DealSummary } from '@/lib/ai/summaries/types';

interface DealSummaryCardProps {
  dealId: string;
  initialSummary?: DealSummary;
  className?: string;
  compact?: boolean;
}

export function DealSummaryCard({ dealId, initialSummary, className, compact = false }: DealSummaryCardProps) {
  const [summary, setSummary] = useState<DealSummary | null>(initialSummary || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async (force = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ai/summaries/deal/${dealId}`, {
        method: force ? 'POST' : 'GET',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate summary');
      }

      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialSummary) {
      generateSummary();
    }
  }, [dealId]);

  const TrendIcon = summary?.currentStatus?.trend === 'improving' ? TrendingUp :
                   summary?.currentStatus?.trend === 'declining' ? TrendingDown : Minus;

  const trendColor = summary?.currentStatus?.trend === 'improving' ? 'text-green-600' :
                    summary?.currentStatus?.trend === 'declining' ? 'text-red-600' : 'text-gray-500';

  if (error) {
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-900">AI Deal Summary</span>
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
          <Sparkles className="h-4 w-4 text-purple-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-900">Generating AI Summary...</span>
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
            <span className="text-sm font-medium text-gray-900">AI Deal Summary</span>
          </div>
          <button
            onClick={() => generateSummary(true)}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" />
            Generate
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">Click generate to create an AI summary of this deal.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-900">AI Summary</span>
          </div>
          <button
            onClick={() => generateSummary(true)}
            disabled={isLoading}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <RefreshCw className={cn('h-3 w-3 text-gray-400', isLoading && 'animate-spin')} />
          </button>
        </div>
        <p className="text-sm text-gray-700">{summary.headline}</p>
        {summary.recommendedActions?.[0] && (
          <div className="mt-2 text-xs bg-blue-50 text-blue-700 p-2 rounded-lg">
            <span className="font-medium">Next: </span>
            {summary.recommendedActions[0].action}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-900">AI Deal Summary</span>
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
              className="p-1 hover:bg-white rounded transition-colors"
              title="Regenerate summary"
            >
              <RefreshCw className={cn('h-4 w-4 text-gray-400', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-xs text-gray-500">Health</div>
          <div className={cn(
            'text-lg font-semibold',
            summary.currentStatus?.healthScore >= 70 ? 'text-green-600' :
            summary.currentStatus?.healthScore >= 40 ? 'text-amber-600' : 'text-red-600'
          )}>
            {summary.currentStatus?.healthScore || 'N/A'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Trend</div>
          <div className={cn('flex items-center justify-center gap-1', trendColor)}>
            <TrendIcon className="h-4 w-4" />
            <span className="text-sm capitalize">{summary.currentStatus?.trend || 'stable'}</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Days in Stage</div>
          <div className="text-lg font-semibold text-gray-700">
            {summary.currentStatus?.daysInStage || 0}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Last Contact</div>
          <div className="text-sm font-medium text-gray-700">
            {summary.engagement?.daysSinceContact === 0 ? 'Today' :
             summary.engagement?.daysSinceContact === 1 ? 'Yesterday' :
             `${summary.engagement?.daysSinceContact || '?'} days ago`}
          </div>
        </div>
      </div>

      {/* Headline & Overview */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">{summary.headline}</h3>
        <p className="text-sm text-gray-600 whitespace-pre-line">
          {isExpanded ? summary.overview : summary.overview?.substring(0, 400) + (summary.overview?.length > 400 ? '...' : '')}
        </p>
        {summary.overview?.length > 400 && (
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

      {/* Stakeholders */}
      {summary.stakeholderStatus && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-2">
            <Users className="h-3 w-3" />
            Stakeholders ({summary.stakeholderStatus.totalContacts})
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.stakeholderStatus.keyPlayers?.map((player, i) => (
              <div
                key={i}
                className={cn(
                  'text-xs px-2 py-1 rounded-full border',
                  player.sentiment === 'positive' ? 'bg-green-50 border-green-200 text-green-700' :
                  player.sentiment === 'negative' ? 'bg-red-50 border-red-200 text-red-700' :
                  'bg-gray-50 border-gray-200 text-gray-700'
                )}
              >
                {player.name} {player.role && <span className="opacity-75">({player.role})</span>}
              </div>
            ))}
            {summary.stakeholderStatus.hasDecisionMaker && (
              <span className="text-xs text-green-600">✓ Decision maker identified</span>
            )}
            {summary.stakeholderStatus.hasChampion && (
              <span className="text-xs text-blue-600">✓ Champion identified</span>
            )}
          </div>
        </div>
      )}

      {/* Key Points */}
      {summary.keyPoints?.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-xs font-medium text-gray-700 mb-2">Key Points</div>
          <ul className="space-y-1">
            {summary.keyPoints.slice(0, 4).map((kp, i) => (
              <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                <span className={cn(
                  'mt-0.5 w-2 h-2 rounded-full flex-shrink-0',
                  kp.importance === 'high' ? 'bg-red-400' :
                  kp.importance === 'medium' ? 'bg-amber-400' : 'bg-gray-300'
                )} />
                {kp.point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks & Opportunities */}
      {(summary.risks?.length > 0 || summary.opportunities?.length > 0) && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-4">
          {summary.risks?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-medium text-red-700">
                <AlertTriangle className="h-3 w-3" />
                Risks
              </div>
              <ul className="space-y-1">
                {summary.risks.slice(0, 3).map((risk, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                    <span className="text-red-400">•</span>
                    {typeof risk === 'string' ? risk : (risk as { description?: string; risk?: string; type?: string })?.description || (risk as { risk?: string })?.risk || (risk as { type?: string })?.type || ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary.opportunities?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-medium text-green-700">
                <Lightbulb className="h-3 w-3" />
                Opportunities
              </div>
              <ul className="space-y-1">
                {summary.opportunities.slice(0, 3).map((opp, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                    <span className="text-green-400">•</span>
                    {typeof opp === 'string' ? opp : (opp as { description?: string; opportunity?: string; potential?: string })?.description || (opp as { opportunity?: string })?.opportunity || (opp as { potential?: string })?.potential || ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recommended Actions */}
      {summary.recommendedActions?.length > 0 && (
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <div className="text-xs font-medium text-gray-700 mb-2">Recommended Actions</div>
          <div className="space-y-2">
            {summary.recommendedActions.slice(0, 3).map((action, i) => (
              <div
                key={i}
                className={cn(
                  'text-xs p-2 rounded-lg border bg-white',
                  action.priority === 'high'
                    ? 'border-red-200'
                    : action.priority === 'medium'
                    ? 'border-amber-200'
                    : 'border-gray-200'
                )}
              >
                <div className="flex items-start gap-2">
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-xs font-medium',
                    action.priority === 'high' ? 'bg-red-100 text-red-700' :
                    action.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  )}>
                    {action.priority}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{action.action}</span>
                    {action.reasoning && (
                      <p className="text-gray-500 mt-0.5">{action.reasoning}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
