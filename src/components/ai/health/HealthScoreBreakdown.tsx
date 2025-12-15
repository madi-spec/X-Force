'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity,
  Users,
  Timer,
  MessageCircle,
  Heart,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { HealthScoreRing } from './HealthScoreRing';

interface HealthScoreBreakdownProps {
  dealId: string;
  initialScore?: number;
  initialTrend?: 'improving' | 'stable' | 'declining';
  showRecalculate?: boolean;
  className?: string;
}

interface HealthData {
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  updatedAt: string | null;
  breakdown: {
    engagement: number;
    velocity: number;
    stakeholder: number;
    activity: number;
    sentiment: number;
    riskFactors: string[];
    positiveFactors: string[];
  } | null;
}

const componentConfig = [
  {
    key: 'engagement',
    label: 'Engagement',
    icon: MessageCircle,
    description: 'Recent contact and response frequency',
  },
  {
    key: 'velocity',
    label: 'Velocity',
    icon: Timer,
    description: 'Speed of deal progression through stages',
  },
  {
    key: 'stakeholder',
    label: 'Stakeholders',
    icon: Users,
    description: 'Decision maker and champion coverage',
  },
  {
    key: 'activity',
    label: 'Activity',
    icon: Activity,
    description: 'Volume and diversity of interactions',
  },
  {
    key: 'sentiment',
    label: 'Sentiment',
    icon: Heart,
    description: 'Tone and positivity of communications',
  },
];

export function HealthScoreBreakdown({
  dealId,
  initialScore,
  initialTrend,
  showRecalculate = true,
  className,
}: HealthScoreBreakdownProps) {
  const [data, setData] = useState<HealthData | null>(
    initialScore !== undefined
      ? {
          score: initialScore,
          trend: initialTrend || 'stable',
          updatedAt: null,
          breakdown: null,
        }
      : null
  );
  const [loading, setLoading] = useState(!initialScore);
  const [recalculating, setRecalculating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch health data
  useEffect(() => {
    if (dealId && !data?.breakdown) {
      fetchHealthData();
    }
  }, [dealId]);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/ai/health-score?dealId=${dealId}`);
      if (!response.ok) throw new Error('Failed to fetch health data');
      const healthData = await response.json();
      setData(healthData);
    } catch (err) {
      setError('Failed to load health data');
      console.error('Error fetching health data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      setError(null);
      const response = await fetch('/api/ai/health-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      });
      if (!response.ok) throw new Error('Failed to recalculate');

      // Refetch to get updated data
      await fetchHealthData();
    } catch (err) {
      setError('Failed to recalculate health score');
      console.error('Error recalculating:', err);
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200 p-6', className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200 p-6', className)}>
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={fetchHealthData}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200', className)}>
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <HealthScoreRing
              score={data.score}
              size="lg"
              showTrend
              trend={data.trend}
            />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Health Score</h2>
              <p className="text-sm text-gray-500">
                {data.score >= 70
                  ? 'Deal is healthy'
                  : data.score >= 50
                    ? 'Needs attention'
                    : data.score >= 30
                      ? 'At risk'
                      : 'Critical'}
              </p>
              {data.updatedAt && (
                <p className="text-xs text-gray-400 mt-1">
                  Updated {formatRelativeTime(data.updatedAt)}
                </p>
              )}
            </div>
          </div>

          {showRecalculate && (
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', recalculating && 'animate-spin')} />
              {recalculating ? 'Calculating...' : 'Recalculate'}
            </button>
          )}
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Expandable breakdown */}
      {data.breakdown && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-6 py-3 flex items-center justify-between border-t border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">Score Breakdown</span>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>

          {expanded && (
            <div className="px-6 pb-6 space-y-6">
              {/* Component scores */}
              <div className="space-y-3">
                {componentConfig.map(({ key, label, icon: Icon, description }) => {
                  const score = data.breakdown![key as keyof typeof data.breakdown] as number;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">{label}</span>
                        </div>
                        <span
                          className={cn(
                            'text-sm font-medium',
                            score >= 70 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
                          )}
                        >
                          {score}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          )}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                    </div>
                  );
                })}
              </div>

              {/* Risk factors */}
              {data.breakdown.riskFactors && data.breakdown.riskFactors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Risk Factors
                  </h4>
                  <ul className="space-y-1">
                    {data.breakdown.riskFactors.map((factor, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{factor.replace(/^[⚠✓]\s*/, '')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Positive factors */}
              {data.breakdown.positiveFactors && data.breakdown.positiveFactors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Positive Factors
                  </h4>
                  <ul className="space-y-1">
                    {data.breakdown.positiveFactors.map((factor, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>{factor.replace(/^[⚠✓]\s*/, '')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Helper function
function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}
