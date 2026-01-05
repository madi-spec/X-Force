'use client';

import { useEffect, useCallback } from 'react';
import { PipelineItem, StageDefinition, HealthStatus } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessSidePanelProps {
  item: PipelineItem;
  stages: StageDefinition[];
  onClose: () => void;
  onStageMove: (item: PipelineItem, toStage: StageDefinition) => void;
}

function HealthAlert({ status, reason }: { status: HealthStatus; reason: string | null }) {
  if (status === 'healthy' || !reason) return null;

  const config = {
    attention: {
      bg: 'bg-[#fef3c7]',
      border: 'border-[#f59e0b]',
      text: 'text-[#92400e]',
      icon: '⚠️',
    },
    stalled: {
      bg: 'bg-[#fee2e2]',
      border: 'border-[#ef4444]',
      text: 'text-[#991b1b]',
      icon: '🔴',
    },
    healthy: {
      bg: 'bg-[#dcfce7]',
      border: 'border-[#22c55e]',
      text: 'text-[#166534]',
      icon: '✓',
    },
  };

  const style = config[status];

  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border', style.bg, style.border)}>
      <span>{style.icon}</span>
      <span className={cn('text-sm font-medium', style.text)}>{reason}</span>
    </div>
  );
}

function StatBox({ label, value, variant = 'default' }: { label: string; value: string | number; variant?: 'default' | 'success' | 'warning' }) {
  const textColors = {
    default: 'text-[#0b1220]',
    success: 'text-[#22c55e]',
    warning: 'text-[#f59e0b]',
  };

  return (
    <div className="bg-[#f6f8fb] rounded-lg p-3">
      <div className="text-xs text-[#667085] uppercase tracking-wider font-medium mb-1">{label}</div>
      <div className={cn('text-lg font-semibold', textColors[variant])}>{value}</div>
    </div>
  );
}

export function ProcessSidePanel({ item, stages, onClose, onStageMove }: ProcessSidePanelProps) {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [handleEscape]);

  const formatMrr = (value: number | null): string => {
    if (!value) return '-';
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value}`;
  };

  const getDaysVariant = (): 'default' | 'success' | 'warning' => {
    if (item.health_status === 'stalled') return 'warning';
    if (item.days_in_stage >= 14) return 'warning';
    return 'default';
  };

  const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-[480px] bg-white shadow-xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e6eaf0]">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-[#0b1220] truncate">{item.company_name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 text-xs font-medium bg-[#eef2f7] text-[#667085] rounded">
                  {item.product_name}
                </span>
                {item.stage_name && (
                  <span className="text-xs text-[#667085]">
                    Stage: <span className="font-medium">{item.stage_name}</span>
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-1 text-[#667085] hover:text-[#0b1220] rounded"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Health Alert */}
          <HealthAlert status={item.health_status} reason={item.health_reason} />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatBox label="Days in Stage" value={item.days_in_stage} variant={getDaysVariant()} />
            <StatBox label="MRR" value={formatMrr(item.mrr)} variant="success" />
            <StatBox label="Owner" value={item.owner_initials || '-'} />
          </div>

          {/* Stage Selector */}
          <div>
            <h3 className="text-xs text-[#667085] uppercase tracking-wider font-medium mb-3">Move to Stage</h3>
            <div className="space-y-2">
              {sortedStages.map((stage) => {
                const isCurrentStage = stage.id === item.current_stage_id;
                return (
                  <button
                    key={stage.id}
                    onClick={() => !isCurrentStage && onStageMove(item, stage)}
                    disabled={isCurrentStage}
                    className={cn(
                      'w-full px-4 py-2.5 text-sm text-left rounded-lg border transition-colors',
                      isCurrentStage
                        ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                        : 'bg-[#f6f8fb] text-[#0b1220] border-[#e6eaf0] hover:border-[#3b82f6] hover:bg-blue-50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{stage.name}</span>
                      {isCurrentStage && (
                        <span className="text-xs opacity-80">Current</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-xs text-[#667085] uppercase tracking-wider font-medium mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="px-3 py-2 text-sm text-[#667085] bg-[#f6f8fb] rounded-lg hover:bg-[#eef2f7] transition-colors">
                Schedule Meeting
              </button>
              <button className="px-3 py-2 text-sm text-[#667085] bg-[#f6f8fb] rounded-lg hover:bg-[#eef2f7] transition-colors">
                Send Email
              </button>
              <button className="px-3 py-2 text-sm text-[#667085] bg-[#f6f8fb] rounded-lg hover:bg-[#eef2f7] transition-colors">
                View Company
              </button>
              <button className="px-3 py-2 text-sm text-[#667085] bg-[#f6f8fb] rounded-lg hover:bg-[#eef2f7] transition-colors">
                View History
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e6eaf0] flex items-center gap-3">
          <button className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#3b82f6] rounded-lg hover:bg-[#2563eb] transition-colors">
            Log Activity
          </button>
          <button className="px-4 py-2.5 text-sm font-medium text-[#667085] border border-[#e6eaf0] rounded-lg hover:border-[#d1d5db] transition-colors">
            Add Task
          </button>
          <button className="p-2.5 text-[#667085] border border-[#e6eaf0] rounded-lg hover:border-[#d1d5db] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
