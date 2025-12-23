'use client';

import { useState } from 'react';
import {
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Calendar,
  Mail,
  Phone,
  FileText,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

interface ActiveAction {
  id: string;
  title: string;
  description?: string | null;
  tier: number;
  tier_trigger?: string | null;
  why_now?: string | null;
  action_type: string;
  status: string;
  sla_minutes?: number | null;
  sla_status?: string | null;
  created_at: string;
  due_at?: string | null;
}

interface ActiveActionsPanelProps {
  actions: ActiveAction[];
  onActionClick?: (actionId: string) => void;
  onMarkComplete?: (actionId: string) => void;
}

const tierConfig: Record<number, { name: string; color: string; bgColor: string }> = {
  1: { name: 'RESPOND NOW', color: 'text-red-700', bgColor: 'bg-red-100' },
  2: { name: "DON'T LOSE THIS", color: 'text-orange-700', bgColor: 'bg-orange-100' },
  3: { name: 'KEEP YOUR WORD', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  4: { name: 'MOVE BIG DEALS', color: 'text-green-700', bgColor: 'bg-green-100' },
  5: { name: 'BUILD PIPELINE', color: 'text-blue-700', bgColor: 'bg-blue-100' },
};

const actionTypeIcons: Record<string, React.ElementType> = {
  respond_email: Mail,
  send_followup: Mail,
  schedule_meeting: Calendar,
  make_call: Phone,
  send_proposal: FileText,
  fulfill_commitment: CheckCircle2,
  default: Zap,
};

function getSlaStatusColor(slaStatus: string | null | undefined): string {
  switch (slaStatus) {
    case 'breached':
      return 'text-red-600 bg-red-50';
    case 'at_risk':
      return 'text-orange-600 bg-orange-50';
    case 'on_track':
      return 'text-green-600 bg-green-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

export function ActiveActionsPanel({
  actions,
  onActionClick,
  onMarkComplete,
}: ActiveActionsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sort actions by tier (priority)
  const sortedActions = [...actions].sort((a, b) => a.tier - b.tier);

  // Group by tier for summary
  const tierCounts = actions.reduce((acc, a) => {
    acc[a.tier] = (acc[a.tier] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const hasCritical = tierCounts[1] > 0 || tierCounts[2] > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className={cn('w-5 h-5', hasCritical ? 'text-red-500' : 'text-blue-500')} />
          <h3 className="font-medium text-gray-900">
            Active Actions ({actions.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(tierCounts)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([tier, count]) => {
              const config = tierConfig[Number(tier)] || tierConfig[5];
              return (
                <span
                  key={tier}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    config.bgColor,
                    config.color
                  )}
                >
                  T{tier}: {count}
                </span>
              );
            })}
        </div>
      </div>

      {/* Critical Alert Banner */}
      {tierCounts[1] > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">
              {tierCounts[1]} {tierCounts[1] === 1 ? 'person is' : 'people are'} waiting for your response
            </span>
          </div>
        </div>
      )}

      {/* Actions List */}
      {sortedActions.length > 0 ? (
        <div className="space-y-2">
          {sortedActions.map((action) => {
            const config = tierConfig[action.tier] || tierConfig[5];
            const Icon = actionTypeIcons[action.action_type] || actionTypeIcons.default;
            const isExpanded = expandedId === action.id;

            return (
              <div
                key={action.id}
                className={cn(
                  'rounded-lg border transition-all',
                  action.tier === 1
                    ? 'border-red-200 bg-red-50/50'
                    : action.tier === 2
                    ? 'border-orange-200 bg-orange-50/50'
                    : 'border-gray-200 bg-gray-50'
                )}
              >
                <div
                  className="p-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : action.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={cn(
                        'p-1.5 rounded-lg',
                        config.bgColor,
                        config.color
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {action.title}
                        </p>
                        <span
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded',
                            config.bgColor,
                            config.color
                          )}
                        >
                          T{action.tier}
                        </span>
                      </div>

                      {/* Why Now */}
                      {action.why_now && (
                        <p className="text-xs text-gray-600 mt-1">
                          {action.why_now}
                        </p>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-1.5">
                        {action.sla_status && (
                          <span
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded',
                              getSlaStatusColor(action.sla_status)
                            )}
                          >
                            {action.sla_status === 'breached'
                              ? 'SLA Breached'
                              : action.sla_status === 'at_risk'
                              ? 'At Risk'
                              : 'On Track'}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(action.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Expand Arrow */}
                    <ChevronRight
                      className={cn(
                        'w-4 h-4 text-gray-400 transition-transform',
                        isExpanded && 'rotate-90'
                      )}
                    />
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0">
                    <div className="pl-10 border-t border-gray-200 pt-3 mt-1">
                      {action.description && (
                        <p className="text-sm text-gray-700 mb-3">
                          {action.description}
                        </p>
                      )}
                      {action.tier_trigger && (
                        <p className="text-xs text-gray-500 mb-3">
                          Triggered by: {action.tier_trigger}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        {onActionClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onActionClick(action.id);
                            }}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Take Action
                          </button>
                        )}
                        {onMarkComplete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkComplete(action.id);
                            }}
                            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            Mark Complete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic text-center py-4">
          No active actions for this account.
        </p>
      )}
    </div>
  );
}
