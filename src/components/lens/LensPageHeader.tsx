'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useLens } from '@/lib/lens';
import {
  HeartHandshake,
  Target,
  Rocket,
  Ticket,
  LayoutGrid,
} from 'lucide-react';
import { LensType } from '@/lib/lens';

const lensIcons: Record<LensType, typeof LayoutGrid> = {
  focus: LayoutGrid,
  customer_success: HeartHandshake,
  sales: Target,
  onboarding: Rocket,
  support: Ticket,
};

interface LensPageHeaderProps {
  /** Base page title (will be prefixed with lens context) */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Show lens indicator badge */
  showLensBadge?: boolean;
  /** Additional content to render on the right side */
  actions?: ReactNode;
  /** Custom class name */
  className?: string;
}

/**
 * Lens-aware page header that shows context based on current lens
 */
export function LensPageHeader({
  title,
  subtitle,
  showLensBadge = true,
  actions,
  className,
}: LensPageHeaderProps) {
  const { config } = useLens();
  const LensIcon = lensIcons[config.id];

  return (
    <div className={cn('flex items-start justify-between mb-6', className)}>
      <div>
        <div className="flex items-center gap-2">
          {showLensBadge && (
            <div className={cn('p-1.5 rounded-lg', config.bgColor)}>
              <LensIcon className={cn('h-4 w-4', config.color)} />
            </div>
          )}
          <h1 className="text-xl font-normal text-gray-900">{title}</h1>
        </div>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
        {showLensBadge && (
          <p className="text-xs text-gray-400 mt-0.5">
            {config.label} view
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

/**
 * Lens-aware breadcrumb that includes lens prefix
 */
interface LensBreadcrumbProps {
  items: Array<{ label: string; href?: string }>;
  className?: string;
}

export function LensBreadcrumb({ items, className }: LensBreadcrumbProps) {
  const { config } = useLens();

  return (
    <nav className={cn('flex items-center gap-1 text-xs text-gray-500 mb-4', className)}>
      {config.breadcrumbPrefix && (
        <>
          <span className={cn('font-medium', config.color)}>{config.breadcrumbPrefix}</span>
          <span>/</span>
        </>
      )}
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <span>/</span>}
          {item.href ? (
            <a href={item.href} className="hover:text-gray-700 transition-colors">
              {item.label}
            </a>
          ) : (
            <span className="text-gray-700">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
