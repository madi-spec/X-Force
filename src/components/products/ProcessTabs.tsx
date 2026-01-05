'use client';

import { ProcessType, PROCESSES } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessTabsProps {
  activeProcess: ProcessType;
  processStats: Array<{ process: ProcessType; total: number; needsAttention: number }>;
  onProcessChange: (process: ProcessType) => void;
}

export function ProcessTabs({ activeProcess, processStats, onProcessChange }: ProcessTabsProps) {
  return (
    <div className="bg-white border-b border-[#e6eaf0] px-6">
      <div className="flex gap-1">
        {Object.values(PROCESSES).map((process) => {
          const stats = processStats.find(s => s.process === process.id) || { total: 0, needsAttention: 0 };
          const isActive = activeProcess === process.id;

          return (
            <button
              key={process.id}
              onClick={() => onProcessChange(process.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'text-[#0b1220] border-[#0b1220]'
                  : 'text-[#667085] border-transparent hover:text-[#0b1220]'
              )}
            >
              <span className="text-base">{process.icon}</span>
              <span>{process.name}</span>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-semibold',
                isActive ? 'bg-[#0b1220] text-white' : 'bg-[#eef2f7] text-[#667085]'
              )}>
                {stats.total}
              </span>
              {stats.needsAttention > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
