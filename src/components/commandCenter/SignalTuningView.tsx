'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Settings,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Filter,
  BarChart2,
  Sliders,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  SignalType,
  SignalSeverity,
  ThresholdConfig,
  getDefaultSeverity,
  getSeverityBaseScore,
} from '@/lib/signals/events';

// ============================================
// TYPES
// ============================================

interface SignalStats {
  signal_type: SignalType;
  total_count: number;
  active_count: number;
  resolved_count: number;
  false_positive_count: number;
  false_positive_rate: number;
  avg_time_to_resolution_hours: number | null;
}

interface SignalTuningViewProps {
  className?: string;
  isAdmin?: boolean;
  onClose?: () => void;
}

// ============================================
// SEVERITY BADGE
// ============================================

function SeverityBadge({ severity }: { severity: SignalSeverity }) {
  const styles = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase',
        styles[severity]
      )}
    >
      {severity}
    </span>
  );
}

// ============================================
// STAT CARD
// ============================================

function StatCard({
  label,
  value,
  subtitle,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        {Icon && (
          <Icon className="w-4 h-4 text-gray-400" />
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-light text-gray-900">{value}</span>
        {trend && (
          <span
            className={cn(
              'text-xs font-medium',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600',
              trend === 'neutral' && 'text-gray-500'
            )}
          >
            {trend === 'up' && '↑'}
            {trend === 'down' && '↓'}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}

// ============================================
// SIGNAL TYPE ROW
// ============================================

function SignalTypeRow({
  signalType,
  stats,
  threshold,
  onEditThreshold,
  isExpanded,
  onToggleExpand,
}: {
  signalType: SignalType;
  stats: SignalStats | null;
  threshold: ThresholdConfig | null;
  onEditThreshold: (type: SignalType) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const defaultSeverity = getDefaultSeverity(signalType);
  const baseScore = getSeverityBaseScore(defaultSeverity);

  // Format signal type name
  const formatName = (type: string) =>
    type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={onToggleExpand}
        className="w-full px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors"
      >
        <ChevronRight
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              {formatName(signalType)}
            </span>
            <SeverityBadge severity={defaultSeverity} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Base score: {baseScore}
          </p>
        </div>

        {stats && (
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="font-medium text-gray-900">{stats.total_count}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-900">{stats.active_count}</div>
              <div className="text-xs text-gray-500">Active</div>
            </div>
            <div className="text-center">
              <div
                className={cn(
                  'font-medium',
                  stats.false_positive_rate > 20 ? 'text-red-600' : 'text-gray-900'
                )}
              >
                {stats.false_positive_rate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">FP Rate</div>
            </div>
          </div>
        )}

        {!stats && (
          <span className="text-xs text-gray-400">No data</span>
        )}

        <Sliders className="w-4 h-4 text-gray-400" />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stats */}
            {stats && (
              <>
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statistics (30 days)
                  </h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total signals:</span>
                      <span className="font-medium">{stats.total_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Currently active:</span>
                      <span className="font-medium">{stats.active_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Resolved:</span>
                      <span className="font-medium">{stats.resolved_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">False positives:</span>
                      <span className={cn(
                        'font-medium',
                        stats.false_positive_count > 0 && 'text-amber-600'
                      )}>
                        {stats.false_positive_count}
                      </span>
                    </div>
                    {stats.avg_time_to_resolution_hours && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg resolution:</span>
                        <span className="font-medium">
                          {stats.avg_time_to_resolution_hours.toFixed(1)}h
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Threshold Config */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Threshold Configuration
              </h4>
              {threshold ? (
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Trigger threshold:</span>
                    <span className="font-medium">{threshold.trigger_threshold}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Lookback window:</span>
                    <span className="font-medium">{threshold.lookback_hours}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cooldown period:</span>
                    <span className="font-medium">{threshold.cooldown_hours}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={cn(
                      'font-medium',
                      threshold.enabled ? 'text-green-600' : 'text-gray-400'
                    )}>
                      {threshold.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Using default thresholds</p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </h4>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => onEditThreshold(signalType)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Edit Thresholds
                </button>
                <button
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  View History
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SignalTuningView({
  className,
  isAdmin = false,
  onClose,
}: SignalTuningViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<SignalStats[]>([]);
  const [thresholds, setThresholds] = useState<Map<SignalType, ThresholdConfig>>(new Map());
  const [expandedType, setExpandedType] = useState<SignalType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Group signal types by category
  const signalCategories: Record<string, SignalType[]> = {
    'Customer Health': ['churn_risk', 'expansion_ready', 'health_declining', 'health_improving'],
    'Engagement': ['engagement_spike', 'engagement_drop', 'champion_dark', 'new_stakeholder'],
    'Deals': ['deal_stalled', 'competitive_threat', 'budget_at_risk', 'timeline_slip', 'buying_signal'],
    'Commitments': ['promise_at_risk', 'sla_breach', 'deadline_approaching', 'commitment_overdue'],
    'Communications': ['message_needs_reply', 'escalation_detected', 'objection_raised', 'positive_sentiment'],
    'Lifecycle': ['onboarding_blocked', 'milestone_due', 'renewal_approaching', 'trial_ending'],
  };

  // Get visible signal types based on category filter
  const visibleSignalTypes = selectedCategory === 'all'
    ? Object.values(signalCategories).flat()
    : signalCategories[selectedCategory] || [];

  // Calculate summary stats
  const totalActive = stats.reduce((sum, s) => sum + s.active_count, 0);
  const totalResolved = stats.reduce((sum, s) => sum + s.resolved_count, 0);
  const totalFalsePositives = stats.reduce((sum, s) => sum + s.false_positive_count, 0);
  const avgFPRate = stats.length > 0
    ? stats.reduce((sum, s) => sum + s.false_positive_rate, 0) / stats.length
    : 0;

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Fetch from API
      // For now, use mock data
      const mockStats: SignalStats[] = [
        {
          signal_type: 'churn_risk',
          total_count: 45,
          active_count: 12,
          resolved_count: 30,
          false_positive_count: 3,
          false_positive_rate: 6.7,
          avg_time_to_resolution_hours: 24,
        },
        {
          signal_type: 'message_needs_reply',
          total_count: 128,
          active_count: 34,
          resolved_count: 89,
          false_positive_count: 5,
          false_positive_rate: 3.9,
          avg_time_to_resolution_hours: 4.5,
        },
        {
          signal_type: 'deal_stalled',
          total_count: 23,
          active_count: 8,
          resolved_count: 12,
          false_positive_count: 3,
          false_positive_rate: 13.0,
          avg_time_to_resolution_hours: 72,
        },
      ];
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to load signal stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEditThreshold = (signalType: SignalType) => {
    // TODO: Open threshold edit modal
    console.log('Edit threshold for:', signalType);
  };

  const getStatsForType = (signalType: SignalType): SignalStats | null => {
    return stats.find(s => s.signal_type === signalType) || null;
  };

  return (
    <div className={cn('bg-gray-50 min-h-full', className)}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Signal Tuning
              </h1>
              <p className="text-sm text-gray-500">
                Configure signal detection thresholds and view performance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Info banner for non-admins */}
        {!isAdmin && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <span className="font-medium">View only mode.</span> Contact your administrator to modify signal thresholds.
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Active Signals"
            value={totalActive}
            subtitle="Needing attention"
            icon={Activity}
          />
          <StatCard
            label="Resolved (30d)"
            value={totalResolved}
            subtitle="Addressed by team"
            icon={CheckCircle}
          />
          <StatCard
            label="False Positives"
            value={totalFalsePositives}
            subtitle="Marked as noise"
            icon={XCircle}
          />
          <StatCard
            label="Avg FP Rate"
            value={`${avgFPRate.toFixed(1)}%`}
            subtitle={avgFPRate > 10 ? 'Needs tuning' : 'Healthy'}
            trend={avgFPRate > 10 ? 'down' : 'neutral'}
            icon={BarChart2}
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="px-6 py-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Filter:
          </span>
          <button
            onClick={() => setSelectedCategory('all')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors',
              selectedCategory === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            )}
          >
            All
          </button>
          {Object.keys(signalCategories).map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors',
                selectedCategory === category
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Signal Types List */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              Loading signal data...
            </div>
          ) : (
            visibleSignalTypes.map(signalType => (
              <SignalTypeRow
                key={signalType}
                signalType={signalType}
                stats={getStatsForType(signalType)}
                threshold={thresholds.get(signalType) || null}
                onEditThreshold={handleEditThreshold}
                isExpanded={expandedType === signalType}
                onToggleExpand={() =>
                  setExpandedType(expandedType === signalType ? null : signalType)
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default SignalTuningView;
