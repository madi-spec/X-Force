'use client';

import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Lightbulb, Building2, Clock, DollarSign, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompanySummary } from '@/lib/ai/summaries/types';

interface CompanySummaryCardProps {
  companyId: string;
  initialSummary?: CompanySummary;
  className?: string;
  compact?: boolean;
}

export function CompanySummaryCard({ companyId, initialSummary, className, compact = false }: CompanySummaryCardProps) {
  const [summary, setSummary] = useState<CompanySummary | null>(initialSummary || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async (force = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ai/summaries/company/${companyId}`, {
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
  }, [companyId]);

  const healthColor = summary?.relationship?.healthStatus === 'healthy' ? 'text-green-600' :
                      summary?.relationship?.healthStatus === 'at_risk' ? 'text-amber-600' :
                      summary?.relationship?.healthStatus === 'churned' ? 'text-red-600' : 'text-blue-600';

  if (error) {
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-900">AI Company Summary</span>
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
            <span className="text-sm font-medium text-gray-900">AI Company Summary</span>
          </div>
          <button
            onClick={() => generateSummary(true)}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" />
            Generate
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">Click generate to create an AI summary of this company.</p>
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
        {summary.opportunities?.[0] && (
          <div className="mt-2 text-xs bg-green-50 text-green-700 p-2 rounded-lg">
            <span className="font-medium">Opportunity: </span>
            {typeof summary.opportunities[0] === 'string'
              ? summary.opportunities[0]
              : (summary.opportunities[0] as { description?: string; type?: string })?.description || (summary.opportunities[0] as { type?: string })?.type || ''}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-900">AI Company Summary</span>
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
          <div className="text-xs text-gray-500">Status</div>
          <div className={cn('text-sm font-medium capitalize', healthColor)}>
            {summary.relationship?.healthStatus?.replace('_', ' ') || 'prospect'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Active Deals</div>
          <div className="text-lg font-semibold text-gray-700">
            {summary.dealsSummary?.activeDeals || 0}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Pipeline Value</div>
          <div className="text-sm font-semibold text-gray-700 flex items-center justify-center gap-0.5">
            <DollarSign className="h-3 w-3" />
            {summary.dealsSummary?.totalPipelineValue
              ? (summary.dealsSummary.totalPipelineValue / 1000).toFixed(0) + 'K'
              : '0'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Contacts</div>
          <div className="text-lg font-semibold text-gray-700 flex items-center justify-center gap-1">
            <Users className="h-3 w-3 text-gray-400" />
            {summary.keyContacts?.length || 0}
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

      {/* Key Contacts */}
      {summary.keyContacts && summary.keyContacts.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-2">
            <Users className="h-3 w-3" />
            Key Contacts
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.keyContacts.slice(0, 5).map((contact, i) => (
              <div
                key={i}
                className={cn(
                  'text-xs px-2 py-1 rounded-full border',
                  contact.isPrimary ? 'bg-blue-50 border-blue-200 text-blue-700' :
                  'bg-gray-50 border-gray-200 text-gray-700'
                )}
              >
                {contact.name} {(contact.title || contact.role) && <span className="opacity-75">({contact.title || contact.role})</span>}
                {contact.isPrimary && <span className="ml-1 text-blue-500">*</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deal Overview */}
      {summary.dealsSummary && (summary.dealsSummary.activeDeals > 0 || summary.dealsSummary.closedWonValue > 0) && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-2">
            <Building2 className="h-3 w-3" />
            Deal History
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-blue-50 p-2 rounded text-center">
              <div className="font-semibold text-blue-700">{summary.dealsSummary.activeDeals}</div>
              <div className="text-blue-600">Active</div>
            </div>
            <div className="bg-green-50 p-2 rounded text-center">
              <div className="font-semibold text-green-700">
                ${summary.dealsSummary.closedWonValue ? (summary.dealsSummary.closedWonValue / 1000).toFixed(0) + 'K' : '0'}
              </div>
              <div className="text-green-600">Won Value</div>
            </div>
            <div className="bg-purple-50 p-2 rounded text-center">
              <div className="font-semibold text-purple-700">
                ${summary.dealsSummary.totalPipelineValue ? (summary.dealsSummary.totalPipelineValue / 1000).toFixed(0) + 'K' : '0'}
              </div>
              <div className="text-purple-600">Pipeline</div>
            </div>
          </div>
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
                    {typeof risk === 'string' ? risk : (risk as { description?: string; type?: string })?.description || (risk as { type?: string })?.type || JSON.stringify(risk)}
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
                    {typeof opp === 'string' ? opp : (opp as { description?: string; type?: string })?.description || (opp as { type?: string })?.type || JSON.stringify(opp)}
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
