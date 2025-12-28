'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Phone,
  UserPlus,
  Swords,
  DollarSign,
  ChevronRight,
  Clock,
  Target,
  CheckCircle,
  X,
  RefreshCw,
  Zap,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface LeverageMoment {
  id: string;
  type: string;
  urgency: string;
  required_role: string;
  confidence: number;
  confidence_label: string;
  situation: string;
  what_human_must_do: string;
  status: string;
  created_at: string;
  company: {
    id: string;
    name: string;
  } | null;
  deal: {
    id: string;
    name: string;
    stage: string;
    estimated_value: number;
  } | null;
}

interface HumanLeverageMomentsProps {
  className?: string;
}

// ============================================
// CONFIGURATION
// ============================================

const typeConfig: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  relationship_repair: {
    label: 'Re-engage',
    icon: Phone,
    color: 'text-amber-600 bg-amber-50',
  },
  exec_intro: {
    label: 'Exec Access',
    icon: UserPlus,
    color: 'text-purple-600 bg-purple-50',
  },
  competitive_threat: {
    label: 'Competitive',
    icon: Swords,
    color: 'text-red-600 bg-red-50',
  },
  pricing_exception: {
    label: 'Pricing',
    icon: DollarSign,
    color: 'text-green-600 bg-green-50',
  },
};

const urgencyConfig: Record<string, { label: string; color: string }> = {
  immediate: { label: 'Now', color: 'bg-red-100 text-red-700' },
  today: { label: 'Today', color: 'bg-amber-100 text-amber-700' },
  this_week: { label: 'This Week', color: 'bg-blue-100 text-blue-700' },
  before_next_milestone: { label: 'Soon', color: 'bg-gray-100 text-gray-600' },
};

// ============================================
// MAIN COMPONENT
// ============================================

export function HumanLeverageMoments({ className }: HumanLeverageMomentsProps) {
  const [moments, setMoments] = useState<LeverageMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMoments = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/leverage-moments?status=pending&limit=10');
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setMoments(data.moments || []);
    } catch (err) {
      console.error('[HumanLeverageMoments] Error:', err);
      setError('Unable to load leverage moments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoments();
  }, []);

  const handleAction = async (id: string, action: 'acknowledge' | 'complete' | 'dismiss') => {
    setActionLoading(id);

    try {
      const response = await fetch(`/api/leverage-moments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) throw new Error('Action failed');

      // Remove from list
      setMoments((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('[HumanLeverageMoments] Action error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200 p-6', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-amber-600" />
          <h3 className="font-semibold text-gray-900">Human Leverage Needed</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-gray-100 rounded-lg" />
          <div className="h-20 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200 p-6', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-amber-600" />
          <h3 className="font-semibold text-gray-900">Human Leverage Needed</h3>
        </div>
        <div className="text-center py-4 text-gray-500">
          <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchMoments}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (moments.length === 0) {
    return (
      <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200 p-6', className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-gray-900">Human Leverage Needed</h3>
          </div>
          <button
            onClick={fetchMoments}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="text-center py-6 text-gray-500">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
          <p className="text-sm">No leverage moments right now</p>
          <p className="text-xs text-gray-400 mt-1">AI is handling routine tasks</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-600" />
          <h3 className="font-semibold text-gray-900">Human Leverage Needed</h3>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {moments.length}
          </span>
        </div>
        <button
          onClick={fetchMoments}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Moments List */}
      <div className="divide-y divide-gray-100">
        {moments.map((moment) => {
          const config = typeConfig[moment.type] || typeConfig.relationship_repair;
          const urgency = urgencyConfig[moment.urgency] || urgencyConfig.this_week;
          const Icon = config.icon;
          const isExpanded = expandedId === moment.id;
          const isLoading = actionLoading === moment.id;

          return (
            <div key={moment.id} className="p-4">
              {/* Main Row */}
              <div
                className="flex items-start gap-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : moment.id)}
              >
                {/* Icon */}
                <div className={cn('p-2 rounded-lg', config.color)}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {moment.company?.name || 'Unknown Company'}
                    </span>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded', urgency.color)}>
                      {urgency.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {moment.what_human_must_do}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {moment.confidence}% confidence
                    </span>
                    {moment.deal && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {moment.deal.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Expand Arrow */}
                <ChevronRight
                  className={cn(
                    'h-4 w-4 text-gray-400 transition-transform',
                    isExpanded && 'rotate-90'
                  )}
                />
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="mt-4 pl-11 space-y-4">
                  {/* Situation */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                      Situation
                    </h4>
                    <p className="text-sm text-gray-700">{moment.situation}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <Link
                      href={`/leverage/${moment.id}`}
                      className="flex-1 h-8 px-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
                    >
                      View Full Brief
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(moment.id, 'complete');
                      }}
                      disabled={isLoading}
                      className="h-8 px-3 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Done
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(moment.id, 'dismiss');
                      }}
                      disabled={isLoading}
                      className="h-8 px-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
        <Link
          href="/leverage"
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1"
        >
          View all leverage moments
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
