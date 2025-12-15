'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Clock,
  X,
  Check,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type { SignalType, SignalSeverity, SignalCategory } from '@/lib/ai/signals/signalDetector';

export interface SignalData {
  id?: string;
  type: SignalType;
  severity: SignalSeverity;
  category: SignalCategory;
  title: string;
  description: string;
  dealId: string;
  dealName: string;
  companyName?: string;
  suggestedAction?: string;
  detectedAt: Date | string;
}

interface SignalCardProps {
  signal: SignalData;
  onDismiss?: (signalId: string) => void;
  onAction?: (signalId: string, action: string) => void;
  showDealLink?: boolean;
  compact?: boolean;
  className?: string;
}

const categoryConfig = {
  risk: {
    icon: AlertTriangle,
    label: 'Risk',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
  },
  opportunity: {
    icon: TrendingUp,
    label: 'Opportunity',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-500',
  },
  insight: {
    icon: Lightbulb,
    label: 'Insight',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
  },
  action_needed: {
    icon: Clock,
    label: 'Action Needed',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-500',
  },
};

const severityConfig = {
  critical: {
    badge: 'bg-red-100 text-red-800',
    ring: 'ring-red-500',
  },
  high: {
    badge: 'bg-orange-100 text-orange-800',
    ring: 'ring-orange-500',
  },
  medium: {
    badge: 'bg-yellow-100 text-yellow-800',
    ring: 'ring-yellow-500',
  },
  low: {
    badge: 'bg-gray-100 text-gray-800',
    ring: 'ring-gray-400',
  },
};

export function SignalCard({
  signal,
  onDismiss,
  onAction,
  showDealLink = true,
  compact = false,
  className,
}: SignalCardProps) {
  const [dismissing, setDismissing] = useState(false);
  const [actioning, setActioning] = useState(false);

  const category = categoryConfig[signal.category];
  const severity = severityConfig[signal.severity];
  const Icon = category.icon;

  const handleDismiss = async () => {
    if (!signal.id || !onDismiss) return;
    setDismissing(true);
    try {
      await onDismiss(signal.id);
    } finally {
      setDismissing(false);
    }
  };

  const handleAction = async () => {
    if (!signal.id || !onAction || !signal.suggestedAction) return;
    setActioning(true);
    try {
      await onAction(signal.id, signal.suggestedAction);
    } finally {
      setActioning(false);
    }
  };

  const detectedDate = typeof signal.detectedAt === 'string'
    ? new Date(signal.detectedAt)
    : signal.detectedAt;

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border',
          category.bgColor,
          category.borderColor,
          className
        )}
      >
        <Icon className={cn('h-4 w-4 flex-shrink-0', category.iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{signal.title}</p>
          {showDealLink && (
            <Link
              href={`/deals/${signal.dealId}`}
              className="text-xs text-gray-500 hover:text-gray-700 truncate block"
            >
              {signal.dealName}
            </Link>
          )}
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded-full', severity.badge)}>
          {signal.severity}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        category.bgColor,
        category.borderColor,
        signal.severity === 'critical' && 'ring-2 ring-red-300',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg', category.bgColor)}>
            <Icon className={cn('h-5 w-5', category.iconColor)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">{signal.title}</h3>
              <span className={cn('text-xs px-2 py-0.5 rounded-full', severity.badge)}>
                {signal.severity}
              </span>
            </div>
            {showDealLink && (
              <Link
                href={`/deals/${signal.dealId}`}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 mt-0.5"
              >
                {signal.companyName ? `${signal.companyName} - ` : ''}{signal.dealName}
                <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        {/* Dismiss button */}
        {onDismiss && signal.id && (
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="Dismiss signal"
          >
            {dismissing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-gray-700">{signal.description}</p>

      {/* Suggested action */}
      {signal.suggestedAction && (
        <div className="mt-3 p-3 bg-white/50 rounded-lg">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Suggested Action</p>
          <p className="text-sm text-gray-800">{signal.suggestedAction}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Detected {formatRelativeTime(detectedDate)}
        </p>

        {onAction && signal.suggestedAction && signal.id && (
          <button
            onClick={handleAction}
            disabled={actioning}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white transition-colors"
          >
            {actioning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Mark as Done
          </button>
        )}
      </div>
    </div>
  );
}

// Helper function
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
