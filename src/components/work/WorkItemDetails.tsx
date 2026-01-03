'use client';

import { cn } from '@/lib/utils';
import { WorkItemDetailProjection, AttachedSignal } from '@/lib/work/projections';
import { getAllCTAs, ResolverCTA, actionResolvesItem, actionToResolvedBy } from '@/lib/work/resolvers';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  Info,
  Lightbulb,
  MessageSquare,
  Phone,
  Reply,
  TrendingUp,
  UserPlus,
  X,
  Zap,
  FileText,
  ListTodo,
  Target,
  RefreshCw,
  CheckSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface WorkItemDetailsProps {
  item: WorkItemDetailProjection;
  onAction: (action: ResolverCTA, item: WorkItemDetailProjection) => void;
  onClose: () => void;
  className?: string;
}

const priorityConfig = {
  critical: { label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-200' },
  high: { label: 'High', color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-orange-200' },
  medium: { label: 'Medium', color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-200' },
  low: { label: 'Low', color: 'text-gray-500', bgColor: 'bg-gray-100', borderColor: 'border-gray-200' },
};

const signalIcons: Record<string, typeof AlertTriangle> = {
  message_needs_reply: MessageSquare,
  meeting_scheduled: Calendar,
  follow_up_due: Clock,
  promise_at_risk: AlertTriangle,
  sla_breach: AlertTriangle,
  churn_risk: TrendingUp,
  expansion_ready: TrendingUp,
  deal_stalled: Clock,
  onboarding_blocked: AlertTriangle,
  case_escalated: AlertTriangle,
  case_opened: MessageSquare,
  milestone_due: Calendar,
};

const ctaIcons: Record<string, typeof Reply> = {
  Reply: Reply,
  Calendar: Calendar,
  Phone: Phone,
  MessageSquare: MessageSquare,
  ArrowRight: TrendingUp,
  CheckCircle: CheckCircle,
  AlertTriangle: AlertTriangle,
  UserPlus: UserPlus,
  FileText: FileText,
  ListTodo: ListTodo,
  ExternalLink: ExternalLink,
  Check: CheckCircle,
  CheckSquare: CheckSquare,
  Target: Target,
  RefreshCw: RefreshCw,
  TrendingUp: TrendingUp,
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CTAButton({
  cta,
  onClick,
  variant = 'primary',
}: {
  cta: ResolverCTA;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'quick';
}) {
  const Icon = ctaIcons[cta.icon] || Zap;

  if (variant === 'primary') {
    return (
      <Button
        onClick={onClick}
        className={cn(
          'w-full justify-center gap-2',
          cta.variant === 'destructive' && 'bg-red-600 hover:bg-red-700'
        )}
      >
        <Icon className="h-4 w-4" />
        {cta.label}
      </Button>
    );
  }

  if (variant === 'secondary') {
    return (
      <Button
        variant="outline"
        onClick={onClick}
        className="justify-center gap-2"
      >
        <Icon className="h-4 w-4" />
        {cta.shortLabel}
      </Button>
    );
  }

  // Quick action
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      {cta.shortLabel}
    </button>
  );
}

function SignalBadge({ signal }: { signal: AttachedSignal }) {
  const Icon = signalIcons[signal.signal_type] || Info;

  return (
    <div className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
      <div className="p-1.5 bg-white rounded border border-gray-200 shrink-0">
        <Icon className="h-3.5 w-3.5 text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-700 capitalize">
          {signal.signal_type.replace(/_/g, ' ')}
        </p>
        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
          {signal.signal_summary}
        </p>
        <p className="text-[10px] text-gray-400 mt-1">
          {formatTimeAgo(signal.attached_at)}
        </p>
      </div>
    </div>
  );
}

export function WorkItemDetails({
  item,
  onAction,
  onClose,
  className,
}: WorkItemDetailsProps) {
  const priority = priorityConfig[item.priority];
  const { primary, secondary, quickActions } = getAllCTAs(item);
  const SignalIcon = signalIcons[item.signal_type] || Info;

  return (
    <div className={cn('bg-white border-b border-gray-200', className)}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {item.title}
            </h3>
            <Badge
              variant="outline"
              className={cn('shrink-0', priority.bgColor, priority.color, priority.borderColor)}
            >
              {priority.label}
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {item.subtitle}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Why Here Section */}
      <div className="p-4 border-b border-gray-100 bg-amber-50/50">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg shrink-0">
            <Lightbulb className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">
              Why This Is Here
            </p>
            <p className="text-sm text-amber-900 mt-1">
              {item.why_here}
            </p>
          </div>
        </div>
      </div>

      {/* Source Signal */}
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Trigger
        </p>
        <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
          <div className="p-1.5 bg-white rounded border border-gray-200">
            <SignalIcon className="h-4 w-4 text-gray-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-700 capitalize">
              {item.signal_type.replace(/_/g, ' ')}
            </p>
            <p className="text-[10px] text-gray-500">
              from {item.source_type.replace(/_/g, ' ')}
            </p>
          </div>
          <div className="ml-auto text-xs text-gray-400">
            {formatTimeAgo(item.created_at)}
          </div>
        </div>
      </div>

      {/* Attached Signals */}
      {item.attached_signals.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Related Signals ({item.attached_signals.length})
          </p>
          <div className="space-y-2">
            {item.attached_signals.slice(0, 3).map((signal, index) => (
              <SignalBadge key={`${signal.signal_id}-${index}`} signal={signal} />
            ))}
            {item.attached_signals.length > 3 && (
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                +{item.attached_signals.length - 3} more signals
              </button>
            )}
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Take Action
        </p>

        {/* Primary CTA */}
        <CTAButton
          cta={primary}
          onClick={() => onAction(primary, item)}
          variant="primary"
        />

        {/* Secondary CTAs */}
        {secondary.length > 0 && (
          <div className="flex gap-2 mt-3">
            {secondary.map((cta) => (
              <CTAButton
                key={cta.action}
                cta={cta}
                onClick={() => onAction(cta, item)}
                variant="secondary"
              />
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
            {quickActions.map((cta) => (
              <CTAButton
                key={cta.action}
                cta={cta}
                onClick={() => onAction(cta, item)}
                variant="quick"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
