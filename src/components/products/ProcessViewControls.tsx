'use client';

import { ViewMode, DisplayMode } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessViewControlsProps {
  viewMode: ViewMode;
  displayMode: DisplayMode;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
}

export function ProcessViewControls({
  viewMode,
  displayMode,
  onViewModeChange,
  onDisplayModeChange
}: ProcessViewControlsProps) {
  const views: { id: ViewMode; label: string }[] = [
    { id: 'all', label: 'All Items' },
    { id: 'stage', label: 'By Stage' },
    { id: 'company', label: 'By Company' },
  ];

  return (
    <div className="flex items-center gap-3">
      {/* View Mode Tabs */}
      <div className="flex items-center bg-[#eef2f7] rounded-lg p-1">
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => onViewModeChange(view.id)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              viewMode === view.id
                ? 'bg-white text-[#0b1220] shadow-sm'
                : 'text-[#667085] hover:text-[#0b1220]'
            )}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* Display Toggle */}
      <div className="flex items-center border border-[#e6eaf0] rounded-lg overflow-hidden">
        <button
          onClick={() => onDisplayModeChange('kanban')}
          className={cn(
            'px-3 py-2 transition-colors',
            displayMode === 'kanban'
              ? 'bg-[#0b1220] text-white'
              : 'bg-white text-[#667085] hover:text-[#0b1220]'
          )}
          title="Kanban View"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </button>
        <button
          onClick={() => onDisplayModeChange('list')}
          className={cn(
            'px-3 py-2 transition-colors',
            displayMode === 'list'
              ? 'bg-[#0b1220] text-white'
              : 'bg-white text-[#667085] hover:text-[#0b1220]'
          )}
          title="List View"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
