'use client';

import * as React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip';
import { getTooltip, type TooltipDefinition } from '@/lib/tooltips';
import { cn } from '@/lib/utils';

// ============================================
// TOOLTIP CONTENT RENDERER
// ============================================

interface TooltipBodyProps {
  definition: TooltipDefinition;
}

function TooltipBody({ definition }: TooltipBodyProps) {
  const thresholdColors: Record<string, string> = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    gray: 'bg-gray-400',
  };

  const thresholdBgColors: Record<string, string> = {
    green: 'bg-emerald-50',
    yellow: 'bg-amber-50',
    red: 'bg-red-50',
    blue: 'bg-blue-50',
    gray: 'bg-gray-50',
  };

  const thresholdTextColors: Record<string, string> = {
    green: 'text-emerald-700',
    yellow: 'text-amber-700',
    red: 'text-red-700',
    blue: 'text-blue-700',
    gray: 'text-gray-700',
  };

  return (
    <div className="max-w-sm space-y-3 p-1">
      {/* Header */}
      <div>
        <h4 className="font-semibold text-sm text-gray-900">
          {definition.title}
        </h4>
        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
          {definition.description}
        </p>
      </div>

      {/* Formula Box */}
      {definition.formula && (
        <div className="rounded-lg bg-gray-900 px-3 py-2 border border-gray-800">
          <code className="text-xs text-emerald-400 font-mono">
            {definition.formula}
          </code>
        </div>
      )}

      {/* Example */}
      {definition.example && (
        <div className="flex items-start gap-2 text-xs">
          <span className="text-gray-400 shrink-0">e.g.</span>
          <span className="text-gray-600 italic">
            {definition.example}
          </span>
        </div>
      )}

      {/* Thresholds */}
      {definition.thresholds && definition.thresholds.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              Levels
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="grid gap-1.5">
            {definition.thresholds.map((threshold, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md text-xs',
                  thresholdBgColors[threshold.color || 'gray']
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full shrink-0',
                      thresholdColors[threshold.color || 'gray']
                    )}
                  />
                  <span className={cn('font-medium', thresholdTextColors[threshold.color || 'gray'])}>
                    {threshold.label}
                  </span>
                </div>
                <span className="text-gray-500 text-[11px]">
                  {threshold.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {definition.notes && definition.notes.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-gray-200">
          {definition.notes.map((note, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
              <span className="text-gray-300 mt-0.5">→</span>
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// INFO TOOLTIP - Simple icon with tooltip
// ============================================

export interface InfoTooltipProps {
  /** The term key to look up in tooltip definitions */
  term: string;
  /** Override the default icon size */
  size?: number;
  /** Additional CSS classes for the icon */
  className?: string;
  /** Custom tooltip content (overrides term lookup) */
  content?: React.ReactNode;
}

export function InfoTooltip({
  term,
  size = 14,
  className,
  content,
}: InfoTooltipProps) {
  const definition = getTooltip(term);

  if (!definition && !content) {
    // Term not found and no custom content
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[InfoTooltip] Unknown term: "${term}"`);
    }
    return null;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center rounded-full',
              'text-gray-400 hover:text-gray-600',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
              'transition-colors',
              className
            )}
            aria-label={`Info about ${definition?.title || term}`}
          >
            <Info size={size} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          {content || (definition && <TooltipBody definition={definition} />)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================
// METRIC LABEL - Label text with built-in tooltip
// ============================================

export interface MetricLabelProps {
  /** The visible label text */
  label: string;
  /** The term key to look up in tooltip definitions */
  term: string;
  /** Additional CSS classes for the label */
  className?: string;
  /** Whether to show the info icon (default: true) */
  showIcon?: boolean;
}

export function MetricLabel({
  label,
  term,
  className,
  showIcon = true,
}: MetricLabelProps) {
  const definition = getTooltip(term);

  if (!definition) {
    // Just render the label without tooltip
    return (
      <span className={cn('text-gray-500', className)}>
        {label}
      </span>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 cursor-help',
              'text-gray-500',
              className
            )}
          >
            {label}
            {showIcon && (
              <Info
                size={12}
                className="text-gray-400"
              />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          <TooltipBody definition={definition} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================
// TABLE HEADER WITH INFO - For table column headers
// ============================================

export interface TableHeaderWithInfoProps {
  /** The term key to look up in tooltip definitions */
  term: string;
  /** The header text (children) */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Alignment for sorting indicators etc. */
  align?: 'left' | 'center' | 'right';
}

export function TableHeaderWithInfo({
  term,
  children,
  className,
  align = 'left',
}: TableHeaderWithInfoProps) {
  const definition = getTooltip(term);

  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        alignClasses[align],
        className
      )}
    >
      {children}
      {definition && (
        <Info
          size={12}
          className="text-gray-400 opacity-60 group-hover:opacity-100 transition-opacity"
        />
      )}
    </span>
  );

  if (!definition) {
    return content;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help group">{content}</span>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          <TooltipBody definition={definition} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
