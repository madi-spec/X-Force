'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          // Variants
          variant === 'default' && 'bg-gray-900 text-white hover:bg-gray-800',
          variant === 'outline' && 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
          variant === 'ghost' && 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
          variant === 'destructive' && 'bg-red-600 text-white hover:bg-red-700',
          variant === 'secondary' && 'bg-gray-100 text-gray-900 hover:bg-gray-200',
          // Sizes
          size === 'default' && 'h-9 px-4 py-2',
          size === 'sm' && 'h-8 px-3 text-xs',
          size === 'lg' && 'h-11 px-6',
          size === 'icon' && 'h-9 w-9',
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
