'use client';

import { PipelineItem, HealthStatus } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessCardProps {
  item: PipelineItem;
  onClick: () => void;
  onMarkWon?: (item: PipelineItem) => void;
  onMarkLost?: (item: PipelineItem) => void;
}

function HealthDot({ status }: { status: HealthStatus }) {
  const colors: Record<HealthStatus, string> = {
    healthy: 'bg-[#22c55e]',
    attention: 'bg-[#f59e0b]',
    stalled: 'bg-[#ef4444]',
  };

  return <span className={cn('w-1.5 h-1.5 rounded-full', colors[status])} />;
}

function DaysIndicator({
  daysInStage,
  daysSinceActivity,
  status
}: {
  daysInStage: number;
  daysSinceActivity: number;
  status: HealthStatus;
}) {
  const stageColor = daysInStage >= 30 ? 'text-[#ef4444]' : daysInStage >= 14 ? 'text-[#f59e0b]' : 'text-[#667085]';
  const activityColor = daysSinceActivity > 14 ? 'text-[#f59e0b]' : 'text-[#667085]';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn('font-medium', stageColor)} title="Days in stage">
        {daysInStage}d stage
      </span>
      <span className="text-[#d1d5db]">|</span>
      <span className={cn('font-medium', activityColor)} title="Days since last activity">
        {daysSinceActivity}d activity
      </span>
    </div>
  );
}

export function ProcessCard({ item, onClick, onMarkWon, onMarkLost }: ProcessCardProps) {
  const formatMrr = (value: number | null): string => {
    if (!value) return '-';
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value}`;
  };

  const handleWon = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkWon?.(item);
  };

  const handleLost = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkLost?.(item);
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-[#e6eaf0] p-3.5 shadow-sm cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {/* Company Name */}
      <h4 className="text-sm font-semibold text-[#0b1220] line-clamp-2 mb-1">
        {item.company_name}
      </h4>

      {/* Product & Stage */}
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-0.5 text-xs font-medium bg-[#eef2f7] text-[#667085] rounded">
          {item.product_name}
        </span>
        {item.stage_name && (
          <span className="text-xs text-[#9ca3af]">{item.stage_name}</span>
        )}
      </div>

      {/* Health Reason */}
      {item.health_reason && (
        <div className="flex items-center gap-1.5 mb-3">
          <HealthDot status={item.health_status} />
          <span className="text-xs text-[#667085]">{item.health_reason}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[#e6eaf0]">
        <div className="flex items-center gap-3">
          <DaysIndicator
            daysInStage={item.days_in_stage}
            daysSinceActivity={item.days_since_activity}
            status={item.health_status}
          />
          <span className="text-xs text-[#22c55e] font-medium">
            {formatMrr(item.mrr)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Won/Lost Buttons */}
          {onMarkWon && (
            <button
              onClick={handleWon}
              className="px-2 py-1 text-xs font-medium rounded bg-[#dcfce7] hover:bg-[#bbf7d0] text-[#16a34a] transition-colors"
              title="Mark as Won"
            >
              Won
            </button>
          )}
          {onMarkLost && (
            <button
              onClick={handleLost}
              className="px-2 py-1 text-xs font-medium rounded bg-[#fee2e2] hover:bg-[#fecaca] text-[#dc2626] transition-colors"
              title="Mark as Lost"
            >
              Lost
            </button>
          )}

          {/* Owner Avatar */}
          {item.owner_initials ? (
            <div
              className="w-6 h-6 rounded-full bg-[#eef2f7] text-xs font-medium text-[#667085] flex items-center justify-center"
              title={item.owner_name || undefined}
            >
              {item.owner_initials}
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-[#eef2f7] flex items-center justify-center">
              <svg className="w-3 h-3 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
