'use client';

import { cn } from '@/lib/utils';
import {
  Building2,
  Clock,
  DollarSign,
  Heart,
  User,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { QueueItem, QueueConfig } from '@/lib/work';

interface QueueItemListProps {
  queue: QueueConfig | null;
  items: QueueItem[];
  selectedCompanyId: string | null;
  onSelectItem: (item: QueueItem) => void;
  loading?: boolean;
  className?: string;
}

const urgencyConfig = {
  critical: { color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-l-red-500' },
  high: { color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-l-orange-500' },
  medium: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-l-yellow-500' },
  low: { color: 'text-gray-500', bgColor: 'bg-gray-100', borderColor: 'border-l-gray-300' },
};

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function QueueItemCard({
  item,
  isSelected,
  onClick,
}: {
  item: QueueItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const urgency = urgencyConfig[item.urgency];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-lg border-l-4 transition-all',
        urgency.borderColor,
        isSelected
          ? 'bg-blue-50 border border-blue-200 shadow-sm'
          : 'bg-white border border-gray-200 hover:bg-gray-50 hover:shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Company name and urgency */}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="text-sm font-medium text-gray-900 truncate">
              {item.company_name}
            </span>
            <span className={cn(
              'px-1.5 py-0.5 rounded text-xs font-medium shrink-0',
              urgency.bgColor,
              urgency.color
            )}>
              {item.urgency}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm text-gray-700 mt-1 line-clamp-1">
            {item.title}
          </p>

          {/* Subtitle / Reason */}
          {item.subtitle && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
              {item.subtitle}
            </p>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {item.mrr !== null && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(item.mrr)}/mo
              </span>
            )}
            {item.health_score !== null && (
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {Math.round(item.health_score)}
              </span>
            )}
            {item.owner_name && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {item.owner_name.split(' ')[0]}
              </span>
            )}
            {item.days_in_queue > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.days_in_queue}d
              </span>
            )}
          </div>
        </div>

        <ChevronRight className={cn(
          'h-5 w-5 shrink-0 transition-colors',
          isSelected ? 'text-blue-600' : 'text-gray-300'
        )} />
      </div>
    </button>
  );
}

function QueueItemSkeleton() {
  return (
    <div className="p-4 rounded-lg border border-gray-200 border-l-4 border-l-gray-200 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </div>
      <div className="h-4 w-48 bg-gray-100 rounded mt-2" />
      <div className="h-3 w-64 bg-gray-100 rounded mt-1" />
      <div className="flex gap-3 mt-2">
        <div className="h-3 w-16 bg-gray-100 rounded" />
        <div className="h-3 w-12 bg-gray-100 rounded" />
        <div className="h-3 w-20 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

export function QueueItemList({
  queue,
  items,
  selectedCompanyId,
  onSelectItem,
  loading = false,
  className,
}: QueueItemListProps) {
  if (!queue) {
    return (
      <div className={cn('flex flex-col', className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Select a queue to view items</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-900">{queue.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <div className={cn('px-2 py-1 rounded text-xs font-medium', queue.bgColor, queue.color)}>
            {queue.description}
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <>
            <QueueItemSkeleton />
            <QueueItemSkeleton />
            <QueueItemSkeleton />
          </>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <div className={cn('h-12 w-12 rounded-xl mx-auto mb-3 flex items-center justify-center', queue.bgColor)}>
              <AlertCircle className={cn('h-6 w-6', queue.color)} />
            </div>
            <p className="text-sm font-medium text-gray-900">All clear!</p>
            <p className="text-xs text-gray-500 mt-1">No items in this queue</p>
          </div>
        ) : (
          items.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              isSelected={selectedCompanyId === item.company_id}
              onClick={() => onSelectItem(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}
