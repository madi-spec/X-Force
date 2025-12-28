'use client';

import { MessageSquare, Clock, FileText, Eye, PenSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { getTooltip } from '@/lib/tooltips';
import type { ActionQueue, ActionQueueCounts } from './types';

interface ActionQueueTabsProps {
  counts: ActionQueueCounts;
  activeQueue?: ActionQueue;
  onQueueChange: (queue: ActionQueue | undefined) => void;
}

const queues: { id: ActionQueue; label: string; icon: typeof MessageSquare; color: string; tooltipTerm: string }[] = [
  { id: 'respond', label: 'Respond', icon: MessageSquare, color: 'text-red-600 bg-red-50', tooltipTerm: 'queue_respond' },
  { id: 'follow_up', label: 'Follow Up', icon: Clock, color: 'text-amber-600 bg-amber-50', tooltipTerm: 'queue_follow_up' },
  { id: 'review', label: 'Review', icon: FileText, color: 'text-blue-600 bg-blue-50', tooltipTerm: 'queue_review' },
  { id: 'drafts', label: 'Drafts', icon: PenSquare, color: 'text-violet-600 bg-violet-50', tooltipTerm: 'queue_drafts' },
  { id: 'fyi', label: 'FYI', icon: Eye, color: 'text-gray-600 bg-gray-100', tooltipTerm: 'queue_fyi' },
];

export function ActionQueueTabs({ counts, activeQueue, onQueueChange }: ActionQueueTabsProps) {
  const totalCount = counts.respond + counts.follow_up + counts.review + counts.drafts + counts.fyi;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50/50">
        <button
          onClick={() => onQueueChange(undefined)}
          className={cn(
            'px-2.5 py-1 rounded text-xs font-medium transition-colors',
            !activeQueue
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:bg-gray-200'
          )}
        >
          All
          {totalCount > 0 && (
            <span className="ml-1 opacity-70">{totalCount}</span>
          )}
        </button>

        {queues.map((queue) => {
          const Icon = queue.icon;
          const count = counts[queue.id];
          const isActive = activeQueue === queue.id;
          const tooltip = getTooltip(queue.tooltipTerm);

          return (
            <Tooltip key={queue.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onQueueChange(queue.id)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                    isActive
                      ? queue.color
                      : 'text-gray-500 hover:bg-gray-200'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {queue.label}
                  {count > 0 && (
                    <span className={cn(
                      'ml-0.5 text-[10px]',
                      isActive ? 'opacity-80' : 'opacity-60'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              {tooltip && (
                <TooltipContent side="bottom">
                  <div className="max-w-xs space-y-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {tooltip.title}
                    </div>
                    <div className="text-gray-600 dark:text-gray-300 text-xs">
                      {tooltip.description}
                    </div>
                    {tooltip.notes && tooltip.notes.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-600">
                        {tooltip.notes.map((note, i) => (
                          <div key={i}>• {note}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
