'use client';

import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Trophy,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { CommandCenterItem } from '@/types/commandCenter';
import Link from 'next/link';

// ============================================
// TYPES
// ============================================

interface DayCompleteViewProps {
  completedCount: number;
  totalValue: number;
  topWin?: CommandCenterItem | null;
  planDate: string;
  className?: string;
}

// ============================================
// HELPERS
// ============================================

function formatValue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${Math.round(value)}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getMotivationalMessage(completedCount: number): string {
  if (completedCount === 0) return 'Tomorrow is a fresh start!';
  if (completedCount <= 5) return 'Solid progress today!';
  if (completedCount <= 10) return 'Crushing it!';
  if (completedCount <= 20) return 'Incredible productivity!';
  return 'Absolute machine!';
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DayCompleteView({
  completedCount,
  totalValue,
  topWin,
  planDate,
  className,
}: DayCompleteViewProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Celebration Header */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <Sparkles className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          {getGreeting()}! Work day complete.
        </h1>
        <p className="text-gray-600 text-lg">
          {getMotivationalMessage(completedCount)}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Actions Completed */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Actions Completed
          </div>
          <p className="text-3xl font-light text-gray-900">{completedCount}</p>
        </div>

        {/* Pipeline Touched */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            Pipeline Touched
          </div>
          <p className="text-3xl font-light text-gray-900">
            {totalValue > 0 ? formatValue(totalValue) : '-'}
          </p>
        </div>
      </div>

      {/* Top Win */}
      {topWin && (
        <div className="bg-white rounded-xl border border-amber-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wider">
              Top Win Today
            </h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{topWin.title}</p>
              <p className="text-sm text-gray-500">
                {topWin.company_name || topWin.target_name}
              </p>
            </div>
            {topWin.deal_value && (
              <span className="text-green-600 font-medium">
                {formatValue(topWin.deal_value)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Next Work Day Preview */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Ready for next week?</h3>
            <p className="text-sm text-gray-500">
              Preview your next work day
            </p>
          </div>
          <Link
            href="/command-center?preview=tomorrow"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Preview
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Motivational Footer */}
      <div className="text-center py-4">
        <p className="text-sm text-gray-400">
          Rest up. Tomorrow&apos;s momentum awaits.
        </p>
      </div>
    </div>
  );
}
