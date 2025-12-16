'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { cn, formatCurrency } from '@/lib/utils';
import { type Deal, type PipelineStage } from '@/types';
import { DealCard } from './DealCard';

interface PipelineColumnProps {
  stage: PipelineStage;
  deals: Deal[];
}

export function PipelineColumn({ stage, deals }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = deals.reduce((sum, deal) => sum + deal.estimated_value, 0);

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={cn('h-2.5 w-2.5 rounded-full', stage.color)} />
          <h3 className="font-medium text-gray-900 text-sm">{stage.name}</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
            {deals.length}
          </span>
        </div>
        <span className="text-xs text-gray-500">{formatCurrency(totalValue)}</span>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl p-2 space-y-2 min-h-[200px] transition-colors',
          isOver ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-100'
        )}
      >
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <div className="flex items-center justify-center h-24 text-sm text-gray-400">
            No deals
          </div>
        )}
      </div>
    </div>
  );
}
