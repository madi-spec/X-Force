'use client';

import { cn } from '@/lib/utils';
import { Clock, Calendar, DollarSign, CheckCircle, Zap, Target, TrendingUp } from 'lucide-react';
import { DailyPlan } from '@/types/commandCenter';

// ============================================
// TYPES
// ============================================

interface DaySummaryProps {
  plan: DailyPlan;
  itemsCompleted?: number;
  totalItems?: number;
  className?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DaySummary({
  plan,
  itemsCompleted = 0,
  totalItems = 0,
  className,
}: DaySummaryProps) {
  // Calculate completion percentage
  const completionRate =
    plan.items_planned > 0 ? Math.round((itemsCompleted / plan.items_planned) * 100) : 0;

  // Format potential value
  const formatValue = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${Math.round(value / 1000)}K`;
    return `$${Math.round(value)}`;
  };

  // Format time
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 shadow-sm',
        className
      )}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 divide-x divide-y md:divide-y-0 divide-gray-100">
        {/* Available Time */}
        <StatCard
          icon={Clock}
          iconColor="text-blue-600 bg-blue-50"
          label="Available"
          value={formatTime(plan.available_minutes)}
          subtitle={`of ${formatTime(plan.total_work_minutes)}`}
        />

        {/* In Meetings */}
        <StatCard
          icon={Calendar}
          iconColor="text-purple-600 bg-purple-50"
          label="In Meetings"
          value={formatTime(plan.meeting_minutes)}
          subtitle={plan.meeting_minutes > 0 ? 'blocked' : 'no meetings'}
        />

        {/* Actions Planned */}
        <StatCard
          icon={Target}
          iconColor="text-amber-600 bg-amber-50"
          label="Planned"
          value={plan.items_planned.toString()}
          subtitle={`${formatTime(plan.planned_minutes)} of work`}
        />

        {/* Completed */}
        <StatCard
          icon={CheckCircle}
          iconColor="text-green-600 bg-green-50"
          label="Completed"
          value={`${itemsCompleted}/${plan.items_planned}`}
          subtitle={`${completionRate}% done`}
          highlight={completionRate >= 80}
        />

        {/* Potential Value */}
        <StatCard
          icon={DollarSign}
          iconColor="text-emerald-600 bg-emerald-50"
          label="Potential"
          value={formatValue(plan.total_potential_value || 0)}
          subtitle="weighted pipeline"
        />

        {/* Momentum */}
        <StatCard
          icon={TrendingUp}
          iconColor="text-indigo-600 bg-indigo-50"
          label="Momentum"
          value={calculateAverageMomentum(plan)}
          subtitle="avg score"
        />
      </div>
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  icon: typeof Clock;
  iconColor: string;
  label: string;
  value: string;
  subtitle: string;
  highlight?: boolean;
}

function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  subtitle,
  highlight = false,
}: StatCardProps) {
  return (
    <div className="p-4 flex items-center gap-3">
      <div className={cn('p-2 rounded-lg', iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <p
          className={cn(
            'text-lg font-semibold',
            highlight ? 'text-green-600' : 'text-gray-900'
          )}
        >
          {value}
        </p>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
    </div>
  );
}

// ============================================
// COMPACT VERSION
// ============================================

interface DaySummaryCompactProps {
  availableMinutes: number;
  meetingMinutes: number;
  itemsPlanned: number;
  itemsCompleted: number;
  className?: string;
}

export function DaySummaryCompact({
  availableMinutes,
  meetingMinutes,
  itemsPlanned,
  itemsCompleted,
  className,
}: DaySummaryCompactProps) {
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-4 text-sm text-gray-600',
        className
      )}
    >
      <span className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5 text-blue-500" />
        {formatTime(availableMinutes)} free
      </span>
      <span className="flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5 text-purple-500" />
        {formatTime(meetingMinutes)} meetings
      </span>
      <span className="flex items-center gap-1">
        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        {itemsCompleted}/{itemsPlanned} done
      </span>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function calculateAverageMomentum(plan: DailyPlan): string {
  // Calculate from time blocks if available
  let totalScore = 0;
  let count = 0;

  for (const block of plan.time_blocks) {
    if (block.planned_items) {
      for (const item of block.planned_items) {
        totalScore += item.momentum_score;
        count++;
      }
    }
  }

  if (count === 0) return '--';
  return Math.round(totalScore / count).toString();
}
