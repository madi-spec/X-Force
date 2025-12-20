'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Clock,
  DollarSign,
  Zap,
  X,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react';
import { CommandCenterItem } from '@/types/commandCenter';

// ============================================
// TYPES
// ============================================

interface ExtraCreditPanelProps {
  overflowItems: CommandCenterItem[];
  onClose: () => void;
  onAddItems: (itemIds: string[]) => Promise<void>;
  className?: string;
}

// ============================================
// TIME OPTIONS
// ============================================

const TIME_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

// ============================================
// HELPERS
// ============================================

function formatValue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${Math.round(value)}`;
}

function getItemsThatFit(
  items: CommandCenterItem[],
  availableMinutes: number
): CommandCenterItem[] {
  const result: CommandCenterItem[] = [];
  let usedMinutes = 0;

  // Items are already sorted by momentum score
  for (const item of items) {
    if (usedMinutes + item.estimated_minutes <= availableMinutes) {
      result.push(item);
      usedMinutes += item.estimated_minutes;
    }
  }

  return result;
}

function getTotalValue(items: CommandCenterItem[]): number {
  return items.reduce((sum, item) => {
    const value = item.deal_value || 0;
    const probability = item.deal_probability || 0.5;
    return sum + value * probability;
  }, 0);
}

function getTotalMinutes(items: CommandCenterItem[]): number {
  return items.reduce((sum, item) => sum + item.estimated_minutes, 0);
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ExtraCreditPanel({
  overflowItems,
  onClose,
  onAddItems,
  className,
}: ExtraCreditPanelProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(30);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Calculate items that fit in selected time
  const fittingItems = getItemsThatFit(overflowItems, selectedMinutes);
  const potentialValue = getTotalValue(fittingItems);
  const totalMinutes = getTotalMinutes(fittingItems);

  // Auto-select fitting items when time changes
  useEffect(() => {
    setSelectedItems(new Set(fittingItems.map(item => item.id)));
  }, [selectedMinutes]);

  const handleToggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleAddToQueue = async () => {
    if (selectedItems.size === 0) return;

    setLoading(true);
    try {
      await onAddItems(Array.from(selectedItems));
      onClose();
    } catch (error) {
      console.error('Failed to add items:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      'fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-medium text-gray-900">Extra Credit</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Time Selector */}
      <div className="px-6 py-4 border-b border-gray-100">
        <p className="text-sm text-gray-600 mb-3">
          How much extra time do you have?
        </p>
        <div className="flex gap-2">
          {TIME_OPTIONS.map(option => (
            <button
              key={option.minutes}
              onClick={() => setSelectedMinutes(option.minutes)}
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                selectedMinutes === option.minutes
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Potential value</p>
            <p className="text-2xl font-light text-green-700">
              {formatValue(potentialValue)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">{fittingItems.length} actions</p>
            <p className="text-sm text-gray-500">{totalMinutes} min total</p>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {fittingItems.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              No items fit in {selectedMinutes} minutes
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Try selecting more time
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {fittingItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleToggleItem(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                  selectedItems.has(item.id)
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                  selectedItems.has(item.id)
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300'
                )}>
                  {selectedItems.has(item.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {item.estimated_minutes}m
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {item.momentum_score}
                    </span>
                    {item.deal_value && (
                      <span className="flex items-center gap-1 text-green-600">
                        <DollarSign className="h-3 w-3" />
                        {formatValue(item.deal_value)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleAddToQueue}
          disabled={loading || selectedItems.size === 0}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
            selectedItems.size > 0
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          )}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Plus className="h-5 w-5" />
              Add {selectedItems.size} to Today
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================
// BACKDROP
// ============================================

interface ExtraCreditBackdropProps {
  onClose: () => void;
}

export function ExtraCreditBackdrop({ onClose }: ExtraCreditBackdropProps) {
  return (
    <div
      className="fixed inset-0 bg-black/30 z-40"
      onClick={onClose}
    />
  );
}
