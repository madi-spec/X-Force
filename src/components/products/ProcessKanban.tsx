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
  onMarkWon?: (item: PipelineItem) => void;
  onMarkLost?: (item: PipelineItem) => void;
}

interface ColumnConfig {
  id: HealthStatus;
  title: string;
  emptyText: string;
}

const COLUMNS: ColumnConfig[] = [
  { id: 'attention', title: 'Needs Attention', emptyText: 'No items need attention' },
  { id: 'stalled', title: 'Stalled 30d+', emptyText: 'No stalled items' },
  { id: 'healthy', title: 'On Track', emptyText: 'No items on track' },
];

function KanbanColumn({
  config,
  items,
  onItemClick,
  onMarkWon,
  onMarkLost,
}: {
  config: ColumnConfig;
  items: PipelineItem[];
  onItemClick: (item: PipelineItem) => void;
  onMarkWon?: (item: PipelineItem) => void;
  onMarkLost?: (item: PipelineItem) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e6eaf0] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e6eaf0] bg-white">
        <div className="flex items-center gap-2">
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
            <ProcessCard
              key={item.id}
              item={item}
              onClick={() => onItemClick(item)}
              onMarkWon={onMarkWon}
              onMarkLost={onMarkLost}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StageColumn({
  stage,
  productName,
  items,
  onItemClick,
}: {
  stage: StageDefinition;
  productName: string;
  items: PipelineItem[];
  onItemClick: (item: PipelineItem) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e6eaf0] overflow-hidden flex flex-col min-w-[300px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e6eaf0] bg-white">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#0b1220]">
            {stage.name} <span className="text-[#667085] font-normal">({productName})</span>
          </span>
          <span className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full bg-[#eef2f7] text-[#667085]">
            {items.length}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 bg-[#f6f8fb] p-3 space-y-3 overflow-y-auto">
        {items.map((item) => (
          <ProcessCard key={item.id} item={item} onClick={() => onItemClick(item)} />
        ))}
      </div>
    </div>
  );
}

function CompanyGroup({
  companyName,
  items,
  onItemClick,
  onMarkWon,
  onMarkLost,
}: {
  companyName: string;
  items: PipelineItem[];
  onItemClick: (item: PipelineItem) => void;
  onMarkWon?: (item: PipelineItem) => void;
  onMarkLost?: (item: PipelineItem) => void;
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
          <ProcessCard
            key={item.id}
            item={item}
            onClick={() => onItemClick(item)}
            onMarkWon={onMarkWon}
            onMarkLost={onMarkLost}
          />
        ))}
      </div>
    </div>
  );
}

export function ProcessKanban({ items, stages, viewMode, onItemClick, onMarkWon, onMarkLost }: ProcessKanbanProps) {
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

  // Build product name lookup from items
  const productNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    items.forEach((item) => {
      if (item.product_id && item.product_name) {
        map[item.product_id] = item.product_name;
      }
    });
    return map;
  }, [items]);

  // Filter to only show stages with items
  const stagesWithItems = useMemo(() => {
    return stages.filter(
      (stage) => (groupedByStage[stage.id] || []).length > 0
    );
  }, [stages, groupedByStage]);

  if (viewMode === 'stage') {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2" style={{ maxHeight: 'calc(100vh - 400px)' }}>
        {stagesWithItems.map((stage) => (
          <div key={stage.id} className="flex-shrink-0 w-72 bg-white rounded-xl border border-[#e6eaf0] overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 420px)' }}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#e6eaf0] bg-white flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#0b1220]">
                  {stage.name} <span className="text-[#667085] font-normal">({productNameMap[stage.product_id || ''] || 'Unknown'})</span>
                </span>
                <span className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full bg-[#eef2f7] text-[#667085]">
                  {(groupedByStage[stage.id] || []).length}
                </span>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 bg-[#f6f8fb] p-3 space-y-3 overflow-y-auto">
              {(groupedByStage[stage.id] || []).map((item) => (
                <ProcessCard
                  key={item.id}
                  item={item}
                  onClick={() => onItemClick(item)}
                  onMarkWon={onMarkWon}
                  onMarkLost={onMarkLost}
                />
              ))}
            </div>
          </div>
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
            onMarkWon={onMarkWon}
            onMarkLost={onMarkLost}
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
          onMarkWon={onMarkWon}
          onMarkLost={onMarkLost}
        />
      ))}
    </div>
  );
}
