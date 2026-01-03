'use client';

import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'destructive' | 'success' | 'warning';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
          'transition-colors',
          // Variants
          variant === 'default' && 'bg-gray-100 text-gray-800',
          variant === 'outline' && 'border border-gray-300 text-gray-700',
          variant === 'destructive' && 'bg-red-100 text-red-800',
          variant === 'success' && 'bg-green-100 text-green-800',
          variant === 'warning' && 'bg-amber-100 text-amber-800',
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export { Badge };
