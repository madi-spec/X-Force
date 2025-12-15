'use client';

import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Clock,
} from 'lucide-react';
import type { SignalCategory, SignalSeverity } from '@/lib/ai/signals/signalDetector';

interface SignalBadgeProps {
  category: SignalCategory;
  severity: SignalSeverity;
  count?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const categoryConfig = {
  risk: {
    icon: AlertTriangle,
    label: 'Risk',
    color: 'text-red-600',
    bg: 'bg-red-100',
  },
  opportunity: {
    icon: TrendingUp,
    label: 'Opportunity',
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
  insight: {
    icon: Lightbulb,
    label: 'Insight',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  action_needed: {
    icon: Clock,
    label: 'Action',
    color: 'text-amber-600',
    bg: 'bg-amber-100',
  },
};

const severityPulse = {
  critical: 'animate-pulse',
  high: '',
  medium: '',
  low: '',
};

export function SignalBadge({
  category,
  severity,
  count = 1,
  showLabel = false,
  size = 'sm',
  className,
}: SignalBadgeProps) {
  const config = categoryConfig[category];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full',
        config.bg,
        severityPulse[severity],
        size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1',
        className
      )}
      title={`${count} ${config.label}${count > 1 ? 's' : ''} (${severity})`}
    >
      <Icon className={cn(config.color, size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
      {count > 1 && (
        <span className={cn(config.color, 'font-medium', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {count}
        </span>
      )}
      {showLabel && (
        <span className={cn(config.color, size === 'sm' ? 'text-xs' : 'text-sm')}>
          {config.label}
        </span>
      )}
    </div>
  );
}

interface SignalCountBadgeProps {
  signals: { category: SignalCategory; severity: SignalSeverity }[];
  className?: string;
}

/**
 * Shows aggregated signal counts by category
 */
export function SignalCountBadge({ signals, className }: SignalCountBadgeProps) {
  if (signals.length === 0) return null;

  // Group by category and get highest severity
  const grouped = signals.reduce((acc, signal) => {
    if (!acc[signal.category]) {
      acc[signal.category] = { count: 0, maxSeverity: signal.severity };
    }
    acc[signal.category].count++;

    // Update max severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (severityOrder[signal.severity] < severityOrder[acc[signal.category].maxSeverity]) {
      acc[signal.category].maxSeverity = signal.severity;
    }

    return acc;
  }, {} as Record<SignalCategory, { count: number; maxSeverity: SignalSeverity }>);

  // Show badges for each category with signals
  const categories = Object.keys(grouped) as SignalCategory[];

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {categories.map(category => (
        <SignalBadge
          key={category}
          category={category}
          severity={grouped[category].maxSeverity}
          count={grouped[category].count}
        />
      ))}
    </div>
  );
}
