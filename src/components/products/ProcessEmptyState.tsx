'use client';

import { ProcessDefinition } from '@/types/products';

interface ProcessEmptyStateProps {
  process: ProcessDefinition;
}

export function ProcessEmptyState({ process }: ProcessEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-[#e6eaf0]">
      <span className="text-5xl mb-4">{process.icon}</span>
      <h3 className="text-lg font-medium text-[#0b1220] mb-2">
        No {process.name.toLowerCase()} items
      </h3>
      <p className="text-sm text-[#667085] text-center max-w-md">
        {process.id === 'sales' && 'Start by adding companies to your sales pipeline.'}
        {process.id === 'onboarding' && 'Close a deal to begin the onboarding process.'}
        {process.id === 'customer_service' && 'Active customers with support needs will appear here.'}
        {process.id === 'engagement' && 'Active customers ready for engagement activities will appear here.'}
      </p>
    </div>
  );
}
