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
  AlertCircle,
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
  const [errorIndexes, setErrorIndexes] = useState<Map<number, string>>(new Map());

  const handleApply = useCallback(
    async (index: number) => {
      setApplyingIndex(index);
      // Clear any previous error for this index
      setErrorIndexes((prev) => {
        const newMap = new Map(prev);
        newMap.delete(index);
        return newMap;
      });

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
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to apply recommendation');
        }

        const data = await response.json();

        if (data.errorCount > 0) {
          throw new Error(data.errors?.[0] || 'Failed to apply recommendation');
        }

        setAppliedIndexes((prev) => [...prev, index]);

        // Refresh the page to show updated deal data
        router.refresh();
      } catch (err) {
        console.error('Error applying recommendation:', err);
        setErrorIndexes((prev) => {
          const newMap = new Map(prev);
          newMap.set(index, err instanceof Error ? err.message : 'Failed to apply');
          return newMap;
        });
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
          const error = errorIndexes.get(i);

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

                  {rec.type === 'stage_change' && rec.data?.stage ? (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded inline-block">
                      New stage: {String(rec.data.stage)}
                    </div>
                  ) : null}
                  {rec.type === 'deal_value' && rec.data?.value != null ? (
                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded inline-block">
                      New value: ${Number(rec.data.value).toLocaleString()}
                    </div>
                  ) : null}

                  {/* Error message */}
                  {error && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    onClick={() => handleApply(i)}
                    disabled={isApplying || isApplied}
                    className={cn(
                      'mt-2 text-xs font-medium px-3 py-1.5 rounded transition-colors',
                      isApplied
                        ? 'bg-green-100 text-green-700'
                        : error
                          ? 'bg-red-600 text-white hover:bg-red-700'
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
                    ) : error ? (
                      'Retry'
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
