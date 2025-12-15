'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Rocket,
  ArrowRight,
  DollarSign,
  UserPlus,
  Calendar,
  FileText,
  Loader2,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingRecommendation, MeetingRecommendationType } from '@/types';

interface RecommendationsPanelProps {
  recommendations: MeetingRecommendation[];
  transcriptionId: string;
  dealId?: string;
}

const typeConfig: Record<
  MeetingRecommendationType,
  { icon: typeof ArrowRight; color: string; label: string }
> = {
  stage_change: {
    icon: ArrowRight,
    color: 'text-purple-600 bg-purple-50',
    label: 'Move Stage',
  },
  deal_value: {
    icon: DollarSign,
    color: 'text-green-600 bg-green-50',
    label: 'Update Value',
  },
  add_contact: {
    icon: UserPlus,
    color: 'text-blue-600 bg-blue-50',
    label: 'Add Contact',
  },
  schedule_meeting: {
    icon: Calendar,
    color: 'text-amber-600 bg-amber-50',
    label: 'Schedule Meeting',
  },
  send_content: {
    icon: FileText,
    color: 'text-indigo-600 bg-indigo-50',
    label: 'Send Content',
  },
  other: {
    icon: Rocket,
    color: 'text-gray-600 bg-gray-50',
    label: 'Action',
  },
};

export function RecommendationsPanel({
  recommendations,
  transcriptionId,
  dealId,
}: RecommendationsPanelProps) {
  const router = useRouter();
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);
  const [appliedIndexes, setAppliedIndexes] = useState<number[]>([]);

  const handleApply = useCallback(
    async (index: number) => {
      setApplyingIndex(index);
      try {
        const response = await fetch(
          `/api/meetings/transcriptions/${transcriptionId}/apply-recommendations`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recommendationIndexes: [index] }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to apply recommendation');
        }

        setAppliedIndexes((prev) => [...prev, index]);

        // Refresh the page to show updated deal data
        router.refresh();
      } catch (error) {
        console.error('Error applying recommendation:', error);
      } finally {
        setApplyingIndex(null);
      }
    },
    [transcriptionId, router]
  );

  if (recommendations.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Rocket className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Recommended Actions</h3>
        </div>
        <p className="text-sm text-gray-500">No recommendations at this time</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-gray-100">
        <Rocket className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Recommended Actions</h3>
      </div>

      <div className="divide-y divide-gray-100">
        {recommendations.map((rec, i) => {
          const config = typeConfig[rec.type];
          const Icon = config.icon;
          const isApplying = applyingIndex === i;
          const isApplied = appliedIndexes.includes(i);

          return (
            <div key={i} className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn('p-2 rounded-lg', config.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {rec.action}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{rec.reasoning}</p>

                  {/* Show data details */}
                  {rec.data && (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded inline-block">
                      {rec.type === 'stage_change' && `New stage: ${rec.data.stage}`}
                      {rec.type === 'deal_value' &&
                        `New value: $${(rec.data.value as number).toLocaleString()}`}
                    </div>
                  )}

                  <button
                    onClick={() => handleApply(i)}
                    disabled={isApplying || isApplied}
                    className={cn(
                      'mt-2 text-xs font-medium px-3 py-1.5 rounded transition-colors',
                      isApplied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                    )}
                  >
                    {isApplying ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Applying...
                      </span>
                    ) : isApplied ? (
                      <span className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Applied
                      </span>
                    ) : (
                      'Apply'
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
