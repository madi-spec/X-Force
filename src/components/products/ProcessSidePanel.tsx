'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PipelineItem, StageDefinition, HealthStatus } from '@/types/products';
import { ScheduleMeetingModal } from '@/components/scheduler/ScheduleMeetingModal';
import { ComposeEmailModal } from './ComposeEmailModal';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';

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
  const router = useRouter();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  const stageDropdownRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (stageDropdownOpen) {
        setStageDropdownOpen(false);
      } else {
        onClose();
      }
    }
  }, [onClose, stageDropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(e.target as Node)) {
        setStageDropdownOpen(false);
      }
    }
    if (stageDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [stageDropdownOpen]);

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

  // Filter stages to only show ones for this item's product
  const productStages = stages.filter(s => s.product_id === item.product_id);
  const sortedStages = [...productStages].sort((a, b) => a.stage_order - b.stage_order);

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
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Days in Stage" value={item.days_in_stage} variant={getDaysVariant()} />
            <StatBox
              label="Last Activity"
              value={`${item.days_since_activity}d ago`}
              variant={item.days_since_activity > 14 ? 'warning' : 'default'}
            />
            <StatBox label="MRR" value={formatMrr(item.mrr)} variant="success" />
            <StatBox label="Owner" value={item.owner_initials || '-'} />
          </div>

          {/* Stage Selector Dropdown */}
          <div ref={stageDropdownRef} className="relative">
            <h3 className="text-xs text-[#667085] uppercase tracking-wider font-medium mb-2">Stage</h3>
            <button
              onClick={() => setStageDropdownOpen(!stageDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-[#e6eaf0] rounded-lg hover:border-[#d1d5db] transition-colors"
            >
              <span className="text-sm font-medium text-[#0b1220]">
                {item.stage_name || 'Select stage'}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 text-[#667085] transition-transform",
                stageDropdownOpen && "rotate-180"
              )} />
            </button>

            {stageDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e6eaf0] rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                {sortedStages.map((stage) => {
                  const isCurrentStage = stage.id === item.current_stage_id;
                  return (
                    <button
                      key={stage.id}
                      onClick={() => {
                        if (!isCurrentStage) {
                          onStageMove(item, stage);
                        }
                        setStageDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-[#f6f8fb] transition-colors',
                        isCurrentStage && 'bg-[#eef2f7]'
                      )}
                    >
                      <span className={cn(
                        isCurrentStage ? 'font-medium text-[#3b82f6]' : 'text-[#0b1220]'
                      )}>
                        {stage.name}
                      </span>
                      {isCurrentStage && (
                        <Check className="h-4 w-4 text-[#3b82f6]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-xs text-[#667085] uppercase tracking-wider font-medium mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-3 py-2 text-sm text-[#667085] bg-[#f6f8fb] rounded-lg hover:bg-[#eef2f7] transition-colors"
              >
                Schedule Meeting
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                className="px-3 py-2 text-sm text-[#667085] bg-[#f6f8fb] rounded-lg hover:bg-[#eef2f7] transition-colors"
              >
                Send Email
              </button>
              <button
                onClick={() => router.push(`/companies/${item.company_id}`)}
                className="px-3 py-2 text-sm text-[#667085] bg-[#f6f8fb] rounded-lg hover:bg-[#eef2f7] transition-colors"
              >
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

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSuccess={() => setShowScheduleModal(false)}
        companyId={item.company_id}
      />

      {/* Compose Email Modal */}
      <ComposeEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSent={() => setShowEmailModal(false)}
        companyId={item.company_id}
        companyName={item.company_name}
      />
    </>
  );
}
