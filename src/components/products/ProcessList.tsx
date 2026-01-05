'use client';

import { PipelineItem, HealthStatus } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessListProps {
  items: PipelineItem[];
  onItemClick: (item: PipelineItem) => void;
  onMarkWon?: (item: PipelineItem) => void;
  onMarkLost?: (item: PipelineItem) => void;
}

function HealthBadge({ status }: { status: HealthStatus }) {
  const config: Record<HealthStatus, { bg: string; text: string; label: string }> = {
    healthy: { bg: 'bg-[#dcfce7]', text: 'text-[#166534]', label: 'On Track' },
    attention: { bg: 'bg-[#fef3c7]', text: 'text-[#92400e]', label: 'Needs Attention' },
    stalled: { bg: 'bg-[#fee2e2]', text: 'text-[#991b1b]', label: 'Stalled' },
  };

  const style = config[status];

  return (
    <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', style.bg, style.text)}>
      {style.label}
    </span>
  );
}

export function ProcessList({ items, onItemClick, onMarkWon, onMarkLost }: ProcessListProps) {
  const formatMrr = (value: number | null): string => {
    if (!value) return '-';
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value}`;
  };

  const handleWon = (e: React.MouseEvent, item: PipelineItem) => {
    e.stopPropagation();
    onMarkWon?.(item);
  };

  const handleLost = (e: React.MouseEvent, item: PipelineItem) => {
    e.stopPropagation();
    onMarkLost?.(item);
  };

  return (
    <div className="bg-white rounded-xl border border-[#e6eaf0] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e6eaf0]">
            <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
              Company
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
              Product
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
              Stage
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
              Health
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
              Days in Stage
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
              Last Activity
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
              MRR
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
              Owner
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e6eaf0]">
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={() => onItemClick(item)}
              className="hover:bg-[#f6f8fb] cursor-pointer transition-colors"
            >
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-[#0b1220]">{item.company_name}</span>
              </td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 text-xs font-medium bg-[#eef2f7] text-[#667085] rounded">
                  {item.product_name}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-[#667085]">{item.stage_name || '-'}</span>
              </td>
              <td className="px-4 py-3">
                <HealthBadge status={item.health_status} />
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    'text-sm font-medium',
                    item.days_in_stage >= 30
                      ? 'text-[#ef4444]'
                      : item.days_in_stage >= 14
                      ? 'text-[#f59e0b]'
                      : 'text-[#667085]'
                  )}
                >
                  {item.days_in_stage}d
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    'text-sm font-medium',
                    item.days_since_activity > 14 ? 'text-[#f59e0b]' : 'text-[#667085]'
                  )}
                >
                  {item.days_since_activity}d ago
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-[#22c55e]">{formatMrr(item.mrr)}</span>
              </td>
              <td className="px-4 py-3">
                {item.owner_initials ? (
                  <div
                    className="w-7 h-7 rounded-full bg-[#eef2f7] text-xs font-medium text-[#667085] flex items-center justify-center"
                    title={item.owner_name || undefined}
                  >
                    {item.owner_initials}
                  </div>
                ) : (
                  <span className="text-sm text-[#9ca3af]">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {onMarkWon && (
                    <button
                      onClick={(e) => handleWon(e, item)}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-[#dcfce7] hover:bg-[#bbf7d0] text-[#16a34a] transition-colors"
                      title="Mark as Won"
                    >
                      Won
                    </button>
                  )}
                  {onMarkLost && (
                    <button
                      onClick={(e) => handleLost(e, item)}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-[#fee2e2] hover:bg-[#fecaca] text-[#dc2626] transition-colors"
                      title="Mark as Lost"
                    >
                      Lost
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <div className="flex items-center justify-center h-32 text-sm text-[#9ca3af]">
          No items to display
        </div>
      )}
    </div>
  );
}
