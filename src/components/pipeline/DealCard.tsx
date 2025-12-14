'use client';

import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Building2, Calendar, DollarSign } from 'lucide-react';
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils';
import { getHealthScoreColor, getHealthScoreLabel, type Deal } from '@/types';

interface DealCardProps {
  deal: Deal;
}

export function DealCard({ deal }: DealCardProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only navigate if it wasn't a drag
    if (!isDragging) {
      router.push(`/deals/${deal.id}`);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-4 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <div className="block">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-medium text-gray-900 text-sm line-clamp-2">
            {deal.name}
          </h3>
          <div
            className={cn(
              'shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full',
              getHealthScoreColor(deal.health_score),
              deal.health_score >= 80 && 'bg-green-100',
              deal.health_score >= 60 && deal.health_score < 80 && 'bg-yellow-100',
              deal.health_score >= 40 && deal.health_score < 60 && 'bg-orange-100',
              deal.health_score < 40 && 'bg-red-100'
            )}
            title={getHealthScoreLabel(deal.health_score)}
          >
            {deal.health_score}
          </div>
        </div>

        {deal.company && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
            <Building2 className="h-3.5 w-3.5" />
            <span className="truncate">{deal.company.name}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-gray-900 font-medium">
            <DollarSign className="h-3.5 w-3.5 text-gray-400" />
            {formatCurrency(deal.estimated_value)}
          </div>

          {deal.expected_close_date && (
            <div className="flex items-center gap-1 text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              {formatRelativeTime(deal.expected_close_date)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
