'use client';

import { useState, useEffect } from 'react';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Users,
  ShieldCheck,
  Lightbulb,
  DollarSign,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DealIntelligence, MomentumSignal, RiskFactor, NextAction } from '@/lib/ai/intelligence';

interface DealIntelligenceCardProps {
  dealId: string;
  className?: string;
}

// Momentum configuration
const momentumConfig = {
  accelerating: {
    label: 'Accelerating',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: TrendingUp,
  },
  stable: {
    label: 'Stable',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: Minus,
  },
  stalling: {
    label: 'Stalling',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: TrendingDown,
  },
  dead: {
    label: 'Dead',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: AlertTriangle,
  },
};

// Investment level configuration
const investmentConfig = {
  high: { label: 'High Touch', color: 'bg-purple-100 text-purple-700' },
  medium: { label: 'Balanced', color: 'bg-blue-100 text-blue-700' },
  low: { label: 'Low Touch', color: 'bg-gray-100 text-gray-700' },
  minimal: { label: 'Automated', color: 'bg-gray-50 text-gray-500' },
};

// Severity configuration
const severityConfig = {
  high: { color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { color: 'bg-amber-100 text-amber-700 border-amber-200' },
  low: { color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

// Priority configuration
const priorityConfig = {
  high: { color: 'text-red-600', dot: 'bg-red-500' },
  medium: { color: 'text-amber-600', dot: 'bg-amber-500' },
  low: { color: 'text-gray-500', dot: 'bg-gray-400' },
};

export function DealIntelligenceCard({ dealId, className }: DealIntelligenceCardProps) {
  const [intelligence, setIntelligence] = useState<DealIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchIntelligence = async (refresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const url = `/api/deals/${dealId}/intelligence${refresh ? '?refresh=true' : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch intelligence');
      }

      const data = await response.json();
      setIntelligence(data.intelligence);
      setCached(data.cached);
    } catch (err) {
      console.error('[DealIntelligenceCard] Error:', err);
      setError('Unable to compute deal intelligence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, [dealId]);

  if (loading) {
    return (
      <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200 p-6', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Deal Intelligence</h3>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-gray-100 rounded-lg" />
          <div className="h-24 bg-gray-100 rounded-lg" />
          <div className="h-20 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !intelligence) {
    return (
      <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200 p-6', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Deal Intelligence</h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>{error || 'Unable to compute intelligence'}</p>
          <button
            onClick={() => fetchIntelligence(true)}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const momentum = momentumConfig[intelligence.momentum];
  const MomentumIcon = momentum.icon;
  const investment = investmentConfig[intelligence.investment_level];

  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Deal Intelligence</h3>
        </div>
        <div className="flex items-center gap-2">
          {cached && (
            <span className="text-xs text-gray-400">Cached</span>
          )}
          <button
            onClick={() => fetchIntelligence(true)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            title="Refresh intelligence"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Uncertainty Warning */}
      {intelligence.is_uncertain && (
        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <HelpCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {intelligence.uncertainty_reason}
              </p>
              {intelligence.uncertainty_suggested_action && (
                <p className="text-xs text-amber-600 mt-1">
                  {intelligence.uncertainty_suggested_action}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Momentum & Win Probability */}
        <div className="grid grid-cols-2 gap-4">
          {/* Momentum */}
          <div className={cn('p-4 rounded-lg border', momentum.bgColor, momentum.borderColor)}>
            <div className="flex items-center gap-2 mb-2">
              <MomentumIcon className={cn('h-4 w-4', momentum.color)} />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Momentum
              </span>
            </div>
            <div className={cn('text-xl font-light', momentum.color)}>
              {momentum.label}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Score: {intelligence.momentum_score > 0 ? '+' : ''}{intelligence.momentum_score}
            </div>
          </div>

          {/* Win Probability */}
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Win Probability
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-light text-gray-900">
                {intelligence.win_probability}%
              </span>
              {intelligence.win_probability_trend === 'up' && (
                <TrendingUp className="h-4 w-4 text-green-500" />
              )}
              {intelligence.win_probability_trend === 'down' && (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Range: {intelligence.win_probability_low}% - {intelligence.win_probability_high}%
            </div>
          </div>
        </div>

        {/* Confidence Factors */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-4 w-4 text-gray-600" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Confidence Factors
            </span>
          </div>
          <div className="space-y-2">
            <ConfidenceBar label="Engagement" value={intelligence.confidence_engagement} />
            <ConfidenceBar label="Champion" value={intelligence.confidence_champion} />
            <ConfidenceBar label="Authority" value={intelligence.confidence_authority} />
            <ConfidenceBar label="Need" value={intelligence.confidence_need} />
            <ConfidenceBar label="Timeline" value={intelligence.confidence_timeline} />
          </div>
        </div>

        {/* Risk Factors */}
        {intelligence.risk_factors.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Risks
              </span>
            </div>
            <div className="space-y-2">
              {intelligence.risk_factors.map((risk, idx) => (
                <RiskItem key={idx} risk={risk} />
              ))}
            </div>
          </div>
        )}

        {/* Next Actions */}
        {intelligence.next_actions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Recommended Actions
              </span>
            </div>
            <div className="space-y-2">
              {intelligence.next_actions.map((action, idx) => (
                <ActionItem key={idx} action={action} />
              ))}
            </div>
          </div>
        )}

        {/* Economics Summary */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Economics
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-light text-gray-900">
                ${(intelligence.estimated_acv / 1000).toFixed(0)}K
              </div>
              <div className="text-xs text-gray-500">Est. ACV</div>
            </div>
            <div>
              <div className="text-lg font-light text-gray-900">
                ${(intelligence.expected_value / 1000).toFixed(0)}K
              </div>
              <div className="text-xs text-gray-500">Expected Value</div>
            </div>
            <div>
              <div className={cn('text-xs px-2 py-1 rounded inline-block', investment.color)}>
                {investment.label}
              </div>
              <div className="text-xs text-gray-500 mt-1">Investment</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500 text-center">
            Max {intelligence.max_human_hours} hours justified | ${intelligence.cost_of_delay_per_week}/week delay cost
          </div>
        </div>

        {/* Stage Info */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{intelligence.days_in_stage} days in {intelligence.stage}</span>
          </div>
          <div>
            {intelligence.total_days} days total
          </div>
        </div>
      </div>
    </div>
  );
}

// Confidence bar component
function ConfidenceBar({ label, value }: { label: string; value: number }) {
  const getColor = (val: number) => {
    if (val >= 70) return 'bg-green-500';
    if (val >= 50) return 'bg-blue-500';
    if (val >= 30) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-20">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getColor(value))}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
    </div>
  );
}

// Risk item component
function RiskItem({ risk }: { risk: RiskFactor }) {
  const severity = severityConfig[risk.severity];

  return (
    <div className={cn('p-3 rounded-lg border', severity.color)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{risk.description}</div>
          {risk.mitigation && (
            <div className="text-xs mt-1 opacity-75">
              <ArrowRight className="h-3 w-3 inline mr-1" />
              {risk.mitigation}
            </div>
          )}
        </div>
        <span className="text-xs uppercase font-medium">{risk.severity}</span>
      </div>
    </div>
  );
}

// Action item component
function ActionItem({ action }: { action: NextAction }) {
  const priority = priorityConfig[action.priority];

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', priority.dot)} />
      <div>
        <div className="text-sm text-gray-900">{action.action}</div>
        <div className="text-xs text-gray-500 mt-0.5">{action.rationale}</div>
      </div>
    </div>
  );
}
