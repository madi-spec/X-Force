'use client';

import { useMemo } from 'react';
import { PipelineItem, StageDefinition, ViewMode, HealthStatus } from '@/types/products';
import { ProcessCard } from './ProcessCard';
import { cn } from '@/lib/utils';

interface ProcessKanbanProps {
  items: PipelineItem[];
  stages: StageDefinition[];
  viewMode: ViewMode;
  onItemClick: (item: PipelineItem) => void;
}

interface ColumnConfig {
  id: HealthStatus;
  title: string;
  icon: string;
  emptyText: string;
}

const COLUMNS: ColumnConfig[] = [
  { id: 'attention', title: 'Needs Attention', icon: '⚠️', emptyText: 'No items need attention' },
  { id: 'stalled', title: 'Stalled 30d+', icon: '🔴', emptyText: 'No stalled items' },
  { id: 'healthy', title: 'On Track', icon: '✓', emptyText: 'No items on track' },
];

function KanbanColumn({
  config,
  items,
  onItemClick,
}: {
  config: ColumnConfig;
  items: PipelineItem[];
  onItemClick: (item: PipelineItem) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e6eaf0] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e6eaf0] bg-white">
        <div className="flex items-center gap-2">
          <span className="text-base">{config.icon}</span>
          <span className="text-sm font-medium text-[#0b1220]">{config.title}</span>
          <span className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full bg-[#eef2f7] text-[#667085]">
            {items.length}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 bg-[#f6f8fb] p-3 space-y-3 overflow-y-auto min-h-[400px] max-h-[calc(100vh-320px)]">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-[#9ca3af]">
            {config.emptyText}
          </div>
        ) : (
          items.map((item) => (
            <ProcessCard key={item.id} item={item} onClick={() => onItemClick(item)} />
          ))
        )}
      </div>
    </div>
  );
}

function StageColumn({
  stage,
  items,
  onItemClick,
}: {
  stage: StageDefinition;
  items: PipelineItem[];
  onItemClick: (item: PipelineItem) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e6eaf0] overflow-hidden flex flex-col min-w-[300px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e6eaf0] bg-white">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#0b1220]">{stage.name}</span>
          <span className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full bg-[#eef2f7] text-[#667085]">
            {items.length}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 bg-[#f6f8fb] p-3 space-y-3 overflow-y-auto min-h-[400px] max-h-[calc(100vh-320px)]">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-[#9ca3af]">
            No items in this stage
          </div>
        ) : (
          items.map((item) => (
            <ProcessCard key={item.id} item={item} onClick={() => onItemClick(item)} />
          ))
        )}
      </div>
    </div>
  );
}

function CompanyGroup({
  companyName,
  items,
  onItemClick,
}: {
  companyName: string;
  items: PipelineItem[];
  onItemClick: (item: PipelineItem) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e6eaf0] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e6eaf0] bg-white">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#0b1220]">{companyName}</span>
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#eef2f7] text-[#667085]">
            {items.length} product{items.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="bg-[#f6f8fb] p-3 space-y-3">
        {items.map((item) => (
          <ProcessCard key={item.id} item={item} onClick={() => onItemClick(item)} />
        ))}
      </div>
    </div>
  );
}

export function ProcessKanban({ items, stages, viewMode, onItemClick }: ProcessKanbanProps) {
  const groupedByHealth = useMemo(() => {
    return {
      attention: items.filter((i) => i.health_status === 'attention'),
      stalled: items.filter((i) => i.health_status === 'stalled'),
      healthy: items.filter((i) => i.health_status === 'healthy'),
    };
  }, [items]);

  const groupedByStage = useMemo(() => {
    const map: Record<string, PipelineItem[]> = {};
    stages.forEach((stage) => {
      map[stage.id] = items.filter((i) => i.current_stage_id === stage.id);
    });
    // Items without a stage
    const unstaged = items.filter((i) => !i.current_stage_id);
    if (unstaged.length > 0) {
      map['_unstaged'] = unstaged;
    }
    return map;
  }, [items, stages]);

  const groupedByCompany = useMemo(() => {
    const map: Record<string, PipelineItem[]> = {};
    items.forEach((item) => {
      const key = item.company_id;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [items]);

  if (viewMode === 'stage') {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            items={groupedByStage[stage.id] || []}
            onItemClick={onItemClick}
          />
        ))}
      </div>
    );
  }

  if (viewMode === 'company') {
    const companies = Object.entries(groupedByCompany)
      .map(([companyId, companyItems]) => ({
        companyId,
        companyName: companyItems[0]?.company_name || 'Unknown',
        items: companyItems,
      }))
      .sort((a, b) => a.companyName.localeCompare(b.companyName));

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map(({ companyId, companyName, items: companyItems }) => (
          <CompanyGroup
            key={companyId}
            companyName={companyName}
            items={companyItems}
            onItemClick={onItemClick}
          />
        ))}
      </div>
    );
  }

  // Default: Health-based columns
  return (
    <div className="grid grid-cols-3 gap-4">
      {COLUMNS.map((column) => (
        <KanbanColumn
          key={column.id}
          config={column}
          items={groupedByHealth[column.id]}
          onItemClick={onItemClick}
        />
      ))}
    </div>
  );
}
