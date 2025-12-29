'use client';

import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DuplicateBadgeProps {
  count: number;
  onClick?: () => void;
  className?: string;
}

/**
 * Small badge showing duplicate count
 * Amber/warning color scheme
 * Click to open DuplicateManager
 */
export function DuplicateBadge({ count, onClick, className }: DuplicateBadgeProps) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        'bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
        className
      )}
    >
      <Copy className="h-3 w-3" />
      {count} duplicate{count > 1 ? 's' : ''}
    </button>
  );
}
