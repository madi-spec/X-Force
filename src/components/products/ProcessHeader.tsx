'use client';

import { ProcessDefinition, ProcessStats } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessHeaderProps {
  process: ProcessDefinition;
  stats: ProcessStats | null;
  isLoading: boolean;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'success';
  isLoading?: boolean;
}

function StatCard({ label, value, icon, variant = 'default', isLoading }: StatCardProps) {
  const variantStyles = {
    default: 'text-[#0b1220]',
    warning: 'text-[#f59e0b]',
    success: 'text-[#22c55e]',
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-[#e6eaf0] p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 bg-[#eef2f7] rounded animate-pulse" />
          <div className="w-16 h-3 bg-[#eef2f7] rounded animate-pulse" />
        </div>
        <div className="w-12 h-6 bg-[#eef2f7] rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#e6eaf0] p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[#667085]">{icon}</span>
        <span className="text-xs text-[#667085] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className={cn('text-2xl font-semibold', variantStyles[variant])}>
        {value}
      </div>
    </div>
  );
}

export function ProcessHeader({ process, stats, isLoading }: ProcessHeaderProps) {
  const formatMrr = (value: number): string => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value}`;
  };

  const needsAttentionCount = (stats?.needsAttention || 0) + (stats?.stalled || 0);

  return (
    <div>
      {/* Title & Description */}
      <div className="mb-4">
        <h1 className="text-xl font-normal text-[#0b1220]">{process.name}</h1>
        <p className="text-sm text-[#667085]">{process.description}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Items"
          value={stats?.total || 0}
          isLoading={isLoading}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          }
        />

        <StatCard
          label="Need Attention"
          value={needsAttentionCount}
          variant={needsAttentionCount > 0 ? 'warning' : 'default'}
          isLoading={isLoading}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          }
        />

        <StatCard
          label="Total MRR"
          value={formatMrr(stats?.totalMrr || 0)}
          variant="success"
          isLoading={isLoading}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatCard
          label="Products"
          value={stats?.productCount || 0}
          isLoading={isLoading}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
