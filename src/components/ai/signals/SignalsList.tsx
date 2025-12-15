'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SignalCard, SignalData } from './SignalCard';
import {
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Clock,
  Loader2,
  RefreshCw,
  Filter,
} from 'lucide-react';
import type { SignalCategory, SignalSeverity } from '@/lib/ai/signals/signalDetector';

interface SignalsListProps {
  dealId?: string;
  initialSignals?: SignalData[];
  showFilters?: boolean;
  showRefresh?: boolean;
  groupByCategory?: boolean;
  maxSignals?: number;
  className?: string;
}

const categoryOrder: SignalCategory[] = ['risk', 'action_needed', 'opportunity', 'insight'];

const categoryLabels: Record<SignalCategory, { label: string; icon: typeof AlertTriangle }> = {
  risk: { label: 'Risks', icon: AlertTriangle },
  opportunity: { label: 'Opportunities', icon: TrendingUp },
  insight: { label: 'Insights', icon: Lightbulb },
  action_needed: { label: 'Actions Needed', icon: Clock },
};

export function SignalsList({
  dealId,
  initialSignals,
  showFilters = true,
  showRefresh = true,
  groupByCategory = true,
  maxSignals,
  className,
}: SignalsListProps) {
  const [signals, setSignals] = useState<SignalData[]>(initialSignals || []);
  const [loading, setLoading] = useState(!initialSignals);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SignalCategory | 'all'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<SignalSeverity | 'all'>('all');

  // Fetch signals
  useEffect(() => {
    if (!initialSignals) {
      fetchSignals();
    }
  }, [dealId]);

  const fetchSignals = async () => {
    try {
      setLoading(true);
      setError(null);

      // Run signal detection directly instead of fetching from DB
      const response = await fetch('/api/ai/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, save: false }),
      });

      if (!response.ok) throw new Error('Failed to detect signals');

      const data = await response.json();
      setSignals(data.signals || []);
    } catch (err) {
      setError('Failed to load signals');
      console.error('Error fetching signals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);

      // Run signal detection - use returned signals directly
      const detectResponse = await fetch('/api/ai/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, save: false }), // Don't save, just detect
      });

      if (!detectResponse.ok) throw new Error('Failed to detect signals');

      const data = await detectResponse.json();
      // Use detected signals directly instead of refetching from DB
      setSignals(data.signals || []);
    } catch (err) {
      setError('Failed to refresh signals');
      console.error('Error refreshing signals:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDismiss = async (signalId: string) => {
    try {
      const response = await fetch(`/api/ai/signals/${signalId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to dismiss signal');

      setSignals(prev => prev.filter(s => s.id !== signalId));
    } catch (err) {
      console.error('Error dismissing signal:', err);
    }
  };

  const handleAction = async (signalId: string, action: string) => {
    try {
      const response = await fetch(`/api/ai/signals/${signalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionTaken: action }),
      });

      if (!response.ok) throw new Error('Failed to mark signal as actioned');

      setSignals(prev => prev.filter(s => s.id !== signalId));
    } catch (err) {
      console.error('Error marking signal as actioned:', err);
    }
  };

  // Filter signals
  const filteredSignals = signals.filter(signal => {
    if (selectedCategory !== 'all' && signal.category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && signal.severity !== selectedSeverity) return false;
    return true;
  });

  // Group signals by category
  const groupedSignals = groupByCategory
    ? categoryOrder.reduce((acc, category) => {
        acc[category] = filteredSignals.filter(s => s.category === category);
        return acc;
      }, {} as Record<SignalCategory, SignalData[]>)
    : null;

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={fetchSignals}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with filters */}
      {(showFilters || showRefresh) && (
        <div className="flex items-center justify-between mb-4">
          {showFilters && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value as SignalCategory | 'all')}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1"
              >
                <option value="all">All Categories</option>
                {categoryOrder.map(cat => (
                  <option key={cat} value={cat}>
                    {categoryLabels[cat].label}
                  </option>
                ))}
              </select>
              <select
                value={selectedSeverity}
                onChange={e => setSelectedSeverity(e.target.value as SignalSeverity | 'all')}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          )}

          {showRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              {refreshing ? 'Scanning...' : 'Scan for Signals'}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {filteredSignals.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-green-100 mx-auto mb-3 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-gray-600 font-medium">No signals detected</p>
          <p className="text-sm text-gray-500 mt-1">Your deals are looking healthy!</p>
        </div>
      )}

      {/* Grouped signals */}
      {groupByCategory && groupedSignals && (
        <div className="space-y-6">
          {categoryOrder.map(category => {
            const categorySignals = groupedSignals[category];
            if (categorySignals.length === 0) return null;

            const { label, icon: Icon } = categoryLabels[category];

            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-medium text-gray-700">
                    {label} ({categorySignals.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {categorySignals.map((signal, idx) => (
                    <SignalCard
                      key={signal.id || `${signal.type}-${signal.dealId}-${idx}`}
                      signal={signal}
                      onDismiss={signal.id ? handleDismiss : undefined}
                      onAction={signal.id ? handleAction : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ungrouped signals */}
      {!groupByCategory && filteredSignals.length > 0 && (
        <div className="space-y-3">
          {filteredSignals.map((signal, idx) => (
            <SignalCard
              key={signal.id || `${signal.type}-${signal.dealId}-${idx}`}
              signal={signal}
              onDismiss={signal.id ? handleDismiss : undefined}
              onAction={signal.id ? handleAction : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
