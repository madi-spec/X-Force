'use client';

import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingSentiment } from '@/types';

interface SentimentCardProps {
  sentiment: MeetingSentiment;
}

const overallConfig = {
  very_positive: { label: 'Very Positive', emoji: '😊', color: 'text-green-600' },
  positive: { label: 'Positive', emoji: '🙂', color: 'text-green-500' },
  neutral: { label: 'Neutral', emoji: '😐', color: 'text-gray-500' },
  negative: { label: 'Negative', emoji: '😕', color: 'text-amber-600' },
  very_negative: { label: 'Very Negative', emoji: '😞', color: 'text-red-600' },
};

const levelConfig = {
  high: { label: 'High', color: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
};

const trustConfig = {
  established: { label: 'Established', color: 'bg-green-100 text-green-700' },
  building: { label: 'Building', color: 'bg-blue-100 text-blue-700' },
  uncertain: { label: 'Uncertain', color: 'bg-amber-100 text-amber-700' },
};

export function SentimentCard({ sentiment }: SentimentCardProps) {
  const overall = overallConfig[sentiment.overall];
  const interest = levelConfig[sentiment.interestLevel];
  const urgency = levelConfig[sentiment.urgency];
  const trust = trustConfig[sentiment.trustLevel];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="h-5 w-5 text-pink-600" />
        <h3 className="font-semibold text-gray-900">Sentiment</h3>
      </div>

      {/* Overall Sentiment */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{overall.emoji}</span>
          <span className={cn('text-lg font-medium', overall.color)}>
            {overall.label}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Interest Level</span>
          <span className={cn('text-xs px-2 py-0.5 rounded', interest.color)}>
            {interest.label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Urgency</span>
          <span className={cn('text-xs px-2 py-0.5 rounded', urgency.color)}>
            {urgency.label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Trust</span>
          <span className={cn('text-xs px-2 py-0.5 rounded', trust.color)}>
            {trust.label}
          </span>
        </div>
      </div>
    </div>
  );
}
