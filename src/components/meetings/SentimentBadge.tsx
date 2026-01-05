'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

interface SentimentBadgeProps {
  sentiment: Sentiment | string | null;
  size?: 'sm' | 'md';
}

const sentimentStyles: Record<Sentiment, { bg: string; text: string; icon: typeof TrendingUp }> = {
  positive: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    icon: TrendingUp,
  },
  neutral: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    icon: Minus,
  },
  negative: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    icon: TrendingDown,
  },
  mixed: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    icon: Minus,
  },
};

export function SentimentBadge({ sentiment, size = 'md' }: SentimentBadgeProps) {
  const normalizedSentiment = (sentiment?.toLowerCase() || 'neutral') as Sentiment;
  const style = sentimentStyles[normalizedSentiment] || sentimentStyles.neutral;
  const Icon = style.icon;

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs gap-1'
    : 'px-2.5 py-1 text-sm gap-1.5';

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-lg ${style.bg} ${style.text} ${sizeClasses}`}
    >
      <Icon className={iconSize} />
      <span className="capitalize">{normalizedSentiment}</span>
    </span>
  );
}
