'use client';

import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, Lightbulb, User, Mail, Phone, Clock, MessageSquare, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContactSummary } from '@/lib/ai/summaries/types';

interface ContactSummaryCardProps {
  contactId: string;
  initialSummary?: ContactSummary;
  className?: string;
  compact?: boolean;
}

export function ContactSummaryCard({ contactId, initialSummary, className, compact = false }: ContactSummaryCardProps) {
  const [summary, setSummary] = useState<ContactSummary | null>(initialSummary || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async (force = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ai/summaries/contact/${contactId}`, {
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
  }, [contactId]);

  const SentimentIcon = summary?.influence?.sentiment === 'positive' ? ThumbsUp :
                        summary?.influence?.sentiment === 'negative' ? ThumbsDown : Minus;

  const sentimentColor = summary?.influence?.sentiment === 'positive' ? 'text-green-600' :
                         summary?.influence?.sentiment === 'negative' ? 'text-red-600' : 'text-gray-500';

  if (error) {
    return (
      <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-900">AI Contact Summary</span>
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
            <span className="text-sm font-medium text-gray-900">AI Contact Summary</span>
          </div>
          <button
            onClick={() => generateSummary(true)}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" />
            Generate
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">Click generate to create an AI summary of this contact.</p>
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
        {summary.relationshipTips?.[0] && (
          <div className="mt-2 text-xs bg-blue-50 text-blue-700 p-2 rounded-lg">
            <span className="font-medium">Tip: </span>
            {summary.relationshipTips[0]}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-900">AI Contact Summary</span>
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
          <div className="text-xs text-gray-500">Sentiment</div>
          <div className={cn('flex items-center justify-center gap-1', sentimentColor)}>
            <SentimentIcon className="h-4 w-4" />
            <span className="text-sm capitalize">{summary.influence?.sentiment || 'neutral'}</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Engagement</div>
          <div className={cn(
            'text-sm font-semibold capitalize',
            summary.influence?.engagementLevel === 'highly_engaged' ? 'text-green-600' :
            summary.influence?.engagementLevel === 'disengaged' ? 'text-red-600' :
            summary.influence?.engagementLevel === 'passive' ? 'text-amber-600' : 'text-blue-600'
          )}>
            {summary.influence?.engagementLevel?.replace('_', ' ') || 'Unknown'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Interactions</div>
          <div className="text-lg font-semibold text-gray-700 flex items-center justify-center gap-1">
            <MessageSquare className="h-3 w-3 text-gray-400" />
            {summary.engagement?.totalInteractions || 0}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Last Contact</div>
          <div className="text-sm font-medium text-gray-700">
            {summary.engagement?.daysSinceContact === 0 ? 'Today' :
             summary.engagement?.daysSinceContact === 1 ? 'Yesterday' :
             `${summary.engagement?.daysSinceContact || '?'} days`}
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

      {/* Role & Influence */}
      {(summary.profile?.role || summary.influence?.decisionMakingRole) && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-2">
            <User className="h-3 w-3" />
            Role & Influence
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.profile?.title && (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                {summary.profile.title}
              </span>
            )}
            {summary.influence?.decisionMakingRole && summary.influence.decisionMakingRole !== 'unknown' && (
              <span className={cn(
                'text-xs px-2 py-1 rounded-full',
                summary.influence.decisionMakingRole === 'decision_maker' ? 'bg-purple-100 text-purple-700' :
                summary.influence.decisionMakingRole === 'influencer' ? 'bg-blue-100 text-blue-700' :
                summary.influence.decisionMakingRole === 'champion' ? 'bg-green-100 text-green-700' :
                summary.influence.decisionMakingRole === 'blocker' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              )}>
                {summary.influence.decisionMakingRole.replace('_', ' ')}
              </span>
            )}
            {summary.influence?.buyingInfluence && (
              <span className={cn(
                'text-xs px-2 py-1 rounded-full',
                summary.influence.buyingInfluence === 'high' ? 'bg-amber-100 text-amber-700' :
                summary.influence.buyingInfluence === 'medium' ? 'bg-amber-50 text-amber-600' :
                'bg-gray-100 text-gray-500'
              )}>
                {summary.influence.buyingInfluence} influence
              </span>
            )}
          </div>
        </div>
      )}

      {/* Communication Preferences */}
      {summary.communication && (
        <div className="px-4 pb-4">
          <div className="text-xs font-medium text-gray-700 mb-2">Communication Preferences</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {summary.communication.preferredChannel && summary.communication.preferredChannel !== 'unknown' && (
              <div className="flex items-center gap-2 text-gray-600">
                {summary.communication.preferredChannel === 'email' ? (
                  <Mail className="h-3 w-3" />
                ) : summary.communication.preferredChannel === 'phone' ? (
                  <Phone className="h-3 w-3" />
                ) : (
                  <MessageSquare className="h-3 w-3" />
                )}
                Prefers {summary.communication.preferredChannel}
              </div>
            )}
            {summary.communication.bestTimeToReach && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-3 w-3" />
                Best: {summary.communication.bestTimeToReach}
              </div>
            )}
            {summary.communication.responsePattern && (
              <div className="col-span-2 text-gray-500 italic">
                {summary.communication.responsePattern}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interests & Pain Points */}
      {(summary.interests?.length > 0 || summary.painPoints?.length > 0) && (
        <div className="px-4 pb-4">
          <div className="text-xs font-medium text-gray-700 mb-2">Interests & Pain Points</div>
          <div className="flex flex-wrap gap-1">
            {summary.interests?.map((interest, i) => (
              <span
                key={`i-${i}`}
                className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700"
              >
                {interest}
              </span>
            ))}
            {summary.painPoints?.map((pain, i) => (
              <span
                key={`p-${i}`}
                className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700"
              >
                {pain}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Insights */}
      {summary.keyInsights && summary.keyInsights.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-2">
            <Lightbulb className="h-3 w-3" />
            Key Insights
          </div>
          <ul className="space-y-1">
            {summary.keyInsights.slice(0, 4).map((item, i) => (
              <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                <span className="text-blue-400">•</span>
                <span>{item.insight}</span>
                {item.source && <span className="text-gray-400 ml-1">({item.source})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Relationship Tips */}
      {summary.relationshipTips && summary.relationshipTips.length > 0 && (
        <div className="p-4 bg-blue-50 border-t border-blue-100">
          <div className="text-xs font-medium text-blue-800 mb-2">Relationship Tips</div>
          <ul className="space-y-1">
            {summary.relationshipTips.slice(0, 3).map((tip, i) => (
              <li key={i} className="text-xs text-blue-700 flex items-start gap-1">
                <span>•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
