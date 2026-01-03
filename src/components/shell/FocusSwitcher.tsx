'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useFocus } from '@/lib/focus';
import { getAllLenses, LensType, LensConfig } from '@/lib/lens';
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

interface FocusSwitcherProps {
  variant?: 'sidebar' | 'header' | 'compact';
  className?: string;
}

/**
 * Permission-aware Focus Lens Switcher
 *
 * Shows only permitted lenses and indicates when switching is disabled.
 * Integrates with FocusContext for server-authoritative permissions.
 */
export function FocusSwitcher({ variant = 'sidebar', className }: FocusSwitcherProps) {
  const {
    currentLens,
    config,
    setLens,
    canSwitchTo,
    permittedLenses,
    canSwitchLens,
    isLoading,
    error,
  } = useFocus();

  const [isOpen, setIsOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const allLenses = getAllLenses();

  // Filter to only permitted lenses
  const availableLenses = allLenses.filter((lens) =>
    permittedLenses.includes(lens.id)
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

  const handleSelect = async (lens: LensType) => {
    if (lens === currentLens || isTransitioning) return;
    if (!canSwitchTo(lens)) return;

    setIsTransitioning(true);
    const success = await setLens(lens);
    setIsTransitioning(false);

    if (success) {
      setIsOpen(false);
    }
  };

  // Don't show switcher if user can only access one lens
  const showSwitcher = canSwitchLens && availableLenses.length > 1;

  // Render loading state
  if (isLoading) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className={cn(
          'rounded-lg',
          variant === 'sidebar' && 'h-14 bg-gray-800',
          variant === 'header' && 'h-9 w-32 bg-gray-100',
          variant === 'compact' && 'h-7 w-20 bg-gray-100'
        )} />
      </div>
    );
  }

  // Compact variant - just shows current lens
  if (variant === 'compact') {
    return (
      <div ref={dropdownRef} className={cn('relative', className)}>
        <button
          onClick={() => showSwitcher && setIsOpen(!isOpen)}
          disabled={!showSwitcher || isTransitioning}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors',
            config.bgColor,
            config.color,
            !showSwitcher && 'cursor-default',
            isTransitioning && 'opacity-50'
          )}
        >
          <CurrentIcon className="h-3.5 w-3.5" />
          <span>{config.shortLabel}</span>
          {showSwitcher && (
            <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
          )}
        </button>

        {isOpen && showSwitcher && (
          <LensDropdown
            lenses={availableLenses}
            currentLens={currentLens}
            onSelect={handleSelect}
            canSwitchTo={canSwitchTo}
            isTransitioning={isTransitioning}
            position="bottom-left"
          />
        )}
      </div>
    );
  }

  // Header variant
  if (variant === 'header') {
    return (
      <div ref={dropdownRef} className={cn('relative', className)}>
        <button
          onClick={() => showSwitcher && setIsOpen(!isOpen)}
          disabled={!showSwitcher || isTransitioning}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            'bg-gray-100 hover:bg-gray-200',
            'text-gray-700',
            !showSwitcher && 'cursor-default hover:bg-gray-100',
            isTransitioning && 'opacity-50'
          )}
        >
          <CurrentIcon className={cn('h-4 w-4', config.color)} />
          <span>{config.label}</span>
          {showSwitcher ? (
            <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
          ) : (
            <Lock className="h-3 w-3 text-gray-400" />
          )}
        </button>

        {error && (
          <div className="absolute top-full right-0 mt-1 px-3 py-2 bg-red-50 text-red-700 text-xs rounded-lg shadow-lg border border-red-200 z-50">
            {error}
          </div>
        )}

        {isOpen && showSwitcher && (
          <LensDropdown
            lenses={availableLenses}
            currentLens={currentLens}
            onSelect={handleSelect}
            canSwitchTo={canSwitchTo}
            isTransitioning={isTransitioning}
            position="bottom-right"
            showDescriptions
          />
        )}
      </div>
    );
  }

  // Sidebar variant (default)
  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        onClick={() => showSwitcher && setIsOpen(!isOpen)}
        disabled={!showSwitcher || isTransitioning}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
          'bg-gray-800 hover:bg-gray-700',
          'text-white',
          !showSwitcher && 'cursor-default hover:bg-gray-800',
          isTransitioning && 'opacity-50'
        )}
      >
        <div className={cn('p-1.5 rounded-lg', config.bgColor)}>
          <CurrentIcon className={cn('h-4 w-4', config.color)} />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Focus</p>
          <p className="text-sm font-medium">{config.label}</p>
        </div>
        {showSwitcher ? (
          <ChevronDown
            className={cn('h-4 w-4 text-gray-400 transition-transform', isOpen && 'rotate-180')}
          />
        ) : (
          <Lock className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {error && (
        <div className="mt-2 px-3 py-2 bg-red-900/20 text-red-400 text-xs rounded-lg">
          {error}
        </div>
      )}

      {isOpen && showSwitcher && (
        <LensDropdown
          lenses={availableLenses}
          currentLens={currentLens}
          onSelect={handleSelect}
          canSwitchTo={canSwitchTo}
          isTransitioning={isTransitioning}
          position="top-full"
          showDescriptions
          variant="dark"
        />
      )}
    </div>
  );
}

// ============================================================================
// LENS DROPDOWN COMPONENT
// ============================================================================

interface LensDropdownProps {
  lenses: LensConfig[];
  currentLens: LensType;
  onSelect: (lens: LensType) => void;
  canSwitchTo: (lens: LensType) => boolean;
  isTransitioning: boolean;
  position: 'top-full' | 'bottom-left' | 'bottom-right';
  showDescriptions?: boolean;
  variant?: 'light' | 'dark';
}

function LensDropdown({
  lenses,
  currentLens,
  onSelect,
  canSwitchTo,
  isTransitioning,
  position,
  showDescriptions = false,
  variant = 'light',
}: LensDropdownProps) {
  const positionClasses = {
    'top-full': 'top-full left-0 right-0 mt-1',
    'bottom-left': 'top-full left-0 mt-1',
    'bottom-right': 'top-full right-0 mt-1',
  };

  const isDark = variant === 'dark';

  return (
    <div
      className={cn(
        'absolute z-50 py-2 rounded-xl shadow-lg border',
        positionClasses[position],
        isDark
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200',
        !showDescriptions && 'w-48'
      )}
    >
      <div className={cn(
        'px-3 pb-2 mb-1 border-b',
        isDark ? 'border-gray-700' : 'border-gray-100'
      )}>
        <p className={cn(
          'text-xs uppercase tracking-wider',
          isDark ? 'text-gray-500' : 'text-gray-500'
        )}>
          Switch Focus Lens
        </p>
      </div>

      {lenses.map((lens) => {
        const Icon = iconMap[lens.icon as keyof typeof iconMap] || LayoutGrid;
        const isActive = lens.id === currentLens;
        const isDisabled = !canSwitchTo(lens.id) || isTransitioning;

        return (
          <button
            key={lens.id}
            onClick={() => onSelect(lens.id)}
            disabled={isDisabled}
            className={cn(
              'w-full flex items-center gap-3 px-3 text-left transition-colors',
              showDescriptions ? 'py-2.5' : 'py-2',
              isDisabled && 'opacity-50 cursor-not-allowed',
              isActive
                ? isDark
                  ? 'bg-gray-700'
                  : 'bg-gray-50'
                : isDark
                  ? 'hover:bg-gray-700/50'
                  : 'hover:bg-gray-50'
            )}
          >
            <div className={cn('p-1.5 rounded-lg', lens.bgColor)}>
              <Icon className={cn('h-4 w-4', lens.color)} />
            </div>
            <div className="flex-1">
              <p className={cn(
                'text-sm font-medium',
                isDark ? 'text-white' : 'text-gray-900'
              )}>
                {lens.label}
              </p>
              {showDescriptions && (
                <p className={cn(
                  'text-xs',
                  isDark ? 'text-gray-400' : 'text-gray-500'
                )}>
                  {lens.description}
                </p>
              )}
            </div>
            {isActive && (
              <Check className={cn(
                'h-4 w-4 shrink-0',
                isDark ? 'text-green-500' : 'text-green-600'
              )} />
            )}
          </button>
        );
      })}
    </div>
  );
}
