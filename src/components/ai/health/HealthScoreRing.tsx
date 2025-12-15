'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface HealthScoreRingProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showTrend?: boolean;
  trend?: 'improving' | 'stable' | 'declining';
  className?: string;
}

export function HealthScoreRing({
  score,
  size = 'md',
  showTrend = false,
  trend,
  className,
}: HealthScoreRingProps) {
  // Size configurations
  const sizes = {
    sm: {
      container: 'w-12 h-12',
      strokeWidth: 3,
      radius: 20,
      fontSize: 'text-sm',
      trendSize: 'h-3 w-3',
    },
    md: {
      container: 'w-20 h-20',
      strokeWidth: 4,
      radius: 34,
      fontSize: 'text-xl',
      trendSize: 'h-4 w-4',
    },
    lg: {
      container: 'w-28 h-28',
      strokeWidth: 5,
      radius: 50,
      fontSize: 'text-3xl',
      trendSize: 'h-5 w-5',
    },
  };

  const config = sizes[size];
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Color based on score
  const getScoreColor = (score: number) => {
    if (score >= 70) return { stroke: '#10b981', text: 'text-green-600', bg: 'bg-green-50' }; // Green
    if (score >= 50) return { stroke: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50' }; // Amber
    if (score >= 30) return { stroke: '#f97316', text: 'text-orange-600', bg: 'bg-orange-50' }; // Orange
    return { stroke: '#ef4444', text: 'text-red-600', bg: 'bg-red-50' }; // Red
  };

  const colors = getScoreColor(score);

  // Trend icon
  const TrendIcon = trend === 'improving'
    ? TrendingUp
    : trend === 'declining'
      ? TrendingDown
      : Minus;

  const trendColor = trend === 'improving'
    ? 'text-green-500'
    : trend === 'declining'
      ? 'text-red-500'
      : 'text-gray-400';

  return (
    <div className={cn('relative inline-flex items-center justify-center', config.container, className)}>
      <svg className="transform -rotate-90 w-full h-full">
        {/* Background circle */}
        <circle
          cx="50%"
          cy="50%"
          r={config.radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={config.strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx="50%"
          cy="50%"
          r={config.radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-bold', config.fontSize, colors.text)}>
          {score}
        </span>
        {showTrend && trend && (
          <TrendIcon className={cn(config.trendSize, trendColor)} />
        )}
      </div>
    </div>
  );
}

// Compact inline version
interface HealthScoreBadgeProps {
  score: number;
  trend?: 'improving' | 'stable' | 'declining';
  showLabel?: boolean;
  className?: string;
}

export function HealthScoreBadge({
  score,
  trend,
  showLabel = true,
  className,
}: HealthScoreBadgeProps) {
  const getColors = (score: number) => {
    if (score >= 70) return 'bg-green-100 text-green-700 border-green-200';
    if (score >= 50) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (score >= 30) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const TrendIcon = trend === 'improving'
    ? TrendingUp
    : trend === 'declining'
      ? TrendingDown
      : null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        getColors(score),
        className
      )}
    >
      {showLabel && <span>Health:</span>}
      <span className="font-bold">{score}</span>
      {TrendIcon && (
        <TrendIcon
          className={cn(
            'h-3 w-3',
            trend === 'improving' ? 'text-green-600' : 'text-red-600'
          )}
        />
      )}
    </div>
  );
}
