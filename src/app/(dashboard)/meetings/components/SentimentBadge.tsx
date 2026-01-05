import type { Sentiment } from '@/types/meetings';

interface SentimentBadgeProps {
  sentiment: Sentiment | null;
}

const sentimentConfig: Record<Sentiment, { bg: string; text: string; label: string }> = {
  very_positive: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Very Positive' },
  positive: { bg: 'bg-green-100', text: 'text-green-700', label: 'Positive' },
  neutral: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Neutral' },
  negative: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Negative' },
  very_negative: { bg: 'bg-red-100', text: 'text-red-700', label: 'Very Negative' },
};

export function SentimentBadge({ sentiment }: SentimentBadgeProps) {
  if (!sentiment) return null;

  const config = sentimentConfig[sentiment] || sentimentConfig.neutral;

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}
