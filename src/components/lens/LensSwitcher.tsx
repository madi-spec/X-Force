'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLens, getAllLenses, LensType, canAccessLens, canSwitchLens, UserRole } from '@/lib/lens';
import {
  HeartHandshake,
  Target,
  Rocket,
  Ticket,
  ChevronDown,
  Check,
  LayoutGrid,
  Lock,
} from 'lucide-react';

const iconMap = {
  LayoutGrid,
  HeartHandshake,
  Target,
  Rocket,
  Ticket,
};

interface LensSwitcherProps {
  variant?: 'sidebar' | 'header' | 'compact';
  className?: string;
  /** User role for filtering allowed lenses. Defaults to 'admin' (all lenses) */
  userRole?: UserRole;
}

export function LensSwitcher({ variant = 'sidebar', className, userRole = 'admin' }: LensSwitcherProps) {
  const { currentLens, setLens, config } = useLens();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const allLenses = getAllLenses();

  // Check if user can switch lenses at all
  const canUserSwitchLens = canSwitchLens(userRole);

  // Filter lenses to only those the user can access
  const allowedLenses = useMemo(
    () => allLenses.filter(lens => canAccessLens(userRole, lens.id)),
    [allLenses, userRole]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const CurrentIcon = iconMap[config.icon as keyof typeof iconMap] || LayoutGrid;

  const handleSelect = (lens: LensType) => {
    setLens(lens);
    setIsOpen(false);
  };

  if (variant === 'compact') {
    return (
      <div ref={dropdownRef} className={cn('relative', className)}>
        <button
          onClick={() => canUserSwitchLens && setIsOpen(!isOpen)}
          disabled={!canUserSwitchLens}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors',
            config.bgColor,
            config.color,
            !canUserSwitchLens && 'cursor-not-allowed opacity-75'
          )}
        >
          <CurrentIcon className="h-3.5 w-3.5" />
          <span>{config.shortLabel}</span>
          {canUserSwitchLens ? (
            <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
          ) : (
            <Lock className="h-3 w-3 opacity-50" />
          )}
        </button>

        {isOpen && canUserSwitchLens && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            {allowedLenses.map((lens) => {
              const Icon = iconMap[lens.icon as keyof typeof iconMap] || LayoutGrid;
              const isActive = lens.id === currentLens;

              return (
                <button
                  key={lens.id}
                  onClick={() => handleSelect(lens.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-50'
                  )}
                >
                  <div className={cn('p-1 rounded', lens.bgColor)}>
                    <Icon className={cn('h-3.5 w-3.5', lens.color)} />
                  </div>
                  <span className="flex-1 text-left text-gray-900">
                    {lens.label}
                  </span>
                  {isActive && <Check className="h-4 w-4 text-green-600" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'header') {
    return (
      <div ref={dropdownRef} className={cn('relative', className)}>
        <button
          onClick={() => canUserSwitchLens && setIsOpen(!isOpen)}
          disabled={!canUserSwitchLens}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            'bg-gray-100 hover:bg-gray-200',
            'text-gray-700',
            !canUserSwitchLens && 'cursor-not-allowed opacity-75'
          )}
        >
          <CurrentIcon className={cn('h-4 w-4', config.color)} />
          <span>{config.label}</span>
          {canUserSwitchLens ? (
            <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
          ) : (
            <Lock className="h-4 w-4 opacity-50" />
          )}
        </button>

        {isOpen && canUserSwitchLens && (
          <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
            <div className="px-3 pb-2 mb-2 border-b border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Focus Lens</p>
            </div>
            {allowedLenses.map((lens) => {
              const Icon = iconMap[lens.icon as keyof typeof iconMap] || LayoutGrid;
              const isActive = lens.id === currentLens;

              return (
                <button
                  key={lens.id}
                  onClick={() => handleSelect(lens.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    isActive
                      ? 'bg-gray-50'
                      : 'hover:bg-gray-50'
                  )}
                >
                  <div className={cn('p-1.5 rounded-lg', lens.bgColor)}>
                    <Icon className={cn('h-4 w-4', lens.color)} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {lens.label}
                    </p>
                    <p className="text-xs text-gray-500">{lens.description}</p>
                  </div>
                  {isActive && <Check className="h-4 w-4 text-green-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Sidebar variant (default)
  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        onClick={() => canUserSwitchLens && setIsOpen(!isOpen)}
        disabled={!canUserSwitchLens}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
          'bg-gray-800 hover:bg-gray-700',
          'text-white',
          !canUserSwitchLens && 'cursor-not-allowed opacity-75'
        )}
      >
        <div className={cn('p-1.5 rounded-lg', config.bgColor)}>
          <CurrentIcon className={cn('h-4 w-4', config.color)} />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Focus</p>
          <p className="text-sm font-medium">{config.label}</p>
        </div>
        {canUserSwitchLens ? (
          <ChevronDown
            className={cn('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-180')}
          />
        ) : (
          <Lock className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {isOpen && canUserSwitchLens && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-xl shadow-lg border border-gray-700 py-2 z-50">
          <div className="px-3 pb-2 mb-1 border-b border-gray-700">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Switch Focus Lens</p>
          </div>
          {allowedLenses.map((lens) => {
            const Icon = iconMap[lens.icon as keyof typeof iconMap] || LayoutGrid;
            const isActive = lens.id === currentLens;

            return (
              <button
                key={lens.id}
                onClick={() => handleSelect(lens.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  isActive ? 'bg-gray-700' : 'hover:bg-gray-700/50'
                )}
              >
                <div className={cn('p-1.5 rounded-lg', lens.bgColor)}>
                  <Icon className={cn('h-4 w-4', lens.color)} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{lens.label}</p>
                  <p className="text-xs text-gray-400">{lens.description}</p>
                </div>
                {isActive && <Check className="h-4 w-4 text-green-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
