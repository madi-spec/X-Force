'use client';

import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingKeyPoint } from '@/types';

interface KeyPointsListProps {
  keyPoints: MeetingKeyPoint[];
}

export function KeyPointsList({ keyPoints }: KeyPointsListProps) {
  if (keyPoints.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-indigo-600" />
        <h3 className="font-semibold text-gray-900">Key Discussion Points</h3>
      </div>
      <ul className="space-y-3">
        {keyPoints.map((point, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              className={cn(
                'shrink-0 w-2 h-2 rounded-full mt-2',
                point.importance === 'high' && 'bg-red-500',
                point.importance === 'medium' && 'bg-amber-500',
                point.importance === 'low' && 'bg-gray-400'
              )}
            />
            <div>
              <span className="text-sm font-medium text-gray-900">
                {point.topic}
              </span>
              <p className="text-sm text-gray-600 mt-0.5">{point.details}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
