# PHASE 5: Kanban View Components

## Objective
Create the health-based Kanban board with columns for "Needs Attention", "Stalled", and "On Track", plus the individual pipeline cards.

## Pre-Phase Checklist
- [ ] Phase 4 complete (filters working)
- [ ] API returns items with health_status
- [ ] Review mockup card design (minimal, white backgrounds)

## Tasks

### 5.1 Create Process Kanban Component
Create file: `src/components/products/ProcessKanban.tsx`

```typescript
'use client';

import { PipelineItem } from '@/types/products';
import { ProcessCard } from './ProcessCard';

interface ProcessKanbanProps {
  items: PipelineItem[];
  loading: boolean;
  onItemClick: (item: PipelineItem) => void;
}

export function ProcessKanban({ items, loading, onItemClick }: ProcessKanbanProps) {
  // Group items by health status
  const groups = {
    attention: items.filter(i => i.health_status === 'attention'),
    stalled: items.filter(i => i.health_status === 'stalled'),
    healthy: items.filter(i => i.health_status === 'healthy'),
  };

  if (loading) {
    return <KanbanSkeleton />;
  }

  return (
    <div className="grid grid-cols-3 gap-4 h-full min-h-[500px]">
      <KanbanColumn
        icon="⚠️"
        title="Needs Attention"
        items={groups.attention}
        onItemClick={onItemClick}
      />
      <KanbanColumn
        icon="🔴"
        title="Stalled 30d+"
        items={groups.stalled}
        onItemClick={onItemClick}
      />
      <KanbanColumn
        icon="✓"
        title="On Track"
        items={groups.healthy}
        onItemClick={onItemClick}
      />
    </div>
  );
}

interface KanbanColumnProps {
  icon: string;
  title: string;
  items: PipelineItem[];
  onItemClick: (item: PipelineItem) => void;
}

function KanbanColumn({ icon, title, items, onItemClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col bg-white rounded-xl border border-[#e6eaf0] overflow-hidden">
      {/* Column Header */}
      <div className="px-4 py-3.5 border-b border-[#e6eaf0] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="text-sm font-semibold text-[#0b1220]">{title}</span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#f6f8fb] text-[#667085]">
          {items.length}
        </span>
      </div>

      {/* Column Body */}
      <div className="flex-1 overflow-y-auto p-3 bg-[#f6f8fb] space-y-2">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[200px] text-sm text-[#667085]">
            No items
          </div>
        ) : (
          items.map((item) => (
            <ProcessCard
              key={item.id}
              item={item}
              onClick={() => onItemClick(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4 h-full min-h-[500px]">
      {[1, 2, 3].map((col) => (
        <div key={col} className="flex flex-col bg-white rounded-xl border border-[#e6eaf0] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[#e6eaf0]">
            <div className="h-5 w-32 bg-[#eef2f7] rounded animate-pulse" />
          </div>
          <div className="flex-1 p-3 bg-[#f6f8fb] space-y-2">
            {[1, 2, 3].map((card) => (
              <div key={card} className="h-32 bg-white rounded-lg border border-[#e6eaf0] animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 5.2 Create Process Card Component
Create file: `src/components/products/ProcessCard.tsx`

```typescript
'use client';

import { PipelineItem } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessCardProps {
  item: PipelineItem;
  onClick: () => void;
}

export function ProcessCard({ item, onClick }: ProcessCardProps) {
  const getDaysClass = (days: number) => {
    if (days >= 30) return 'text-[#ef4444]';
    if (days >= 14) return 'text-[#f59e0b]';
    return 'text-[#667085]';
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-[#e6eaf0] p-3.5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h4 className="text-sm font-semibold text-[#0b1220] leading-tight line-clamp-2">
          {item.company_name}
        </h4>
        <span className="flex-shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#e6eaf0] text-[#667085]">
          {item.product_name?.split(' ')[0] || 'Unknown'}
        </span>
      </div>

      {/* Stage */}
      <div className="text-[13px] text-[#667085] mb-2">
        {item.stage_name || 'No stage'}
      </div>

      {/* Health Reason */}
      {item.health_reason && (
        <div className="flex items-center gap-1.5 text-xs text-[#667085] mb-2">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              item.health_status === 'stalled' ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'
            )}
          />
          {item.health_reason}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-[#eef2f7]">
        <span className={cn('text-xs font-medium', getDaysClass(item.days_in_stage))}>
          {item.days_in_stage}d
        </span>
        
        {item.mrr && item.mrr > 0 && (
          <span className="text-[13px] text-[#667085]">
            ${item.mrr.toLocaleString()}/mo
          </span>
        )}
        
        <div
          className="w-6 h-6 rounded-full bg-[#e6eaf0] flex items-center justify-center text-[10px] font-semibold text-[#667085]"
          title={item.owner_name || 'Unassigned'}
        >
          {item.owner_initials || '?'}
        </div>
      </div>
    </div>
  );
}
```

### 5.3 Create Empty State Component
Create file: `src/components/products/ProcessEmptyState.tsx`

```typescript
'use client';

import { Package } from 'lucide-react';

interface ProcessEmptyStateProps {
  process: string;
  hasFilters: boolean;
}

export function ProcessEmptyState({ process, hasFilters }: ProcessEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
      <div className="w-16 h-16 rounded-full bg-[#f6f8fb] flex items-center justify-center mb-4">
        <Package className="w-8 h-8 text-[#667085]" />
      </div>
      <h3 className="text-lg font-semibold text-[#0b1220] mb-2">
        {hasFilters ? 'No matching items' : `No ${process} items`}
      </h3>
      <p className="text-sm text-[#667085] max-w-md">
        {hasFilters
          ? 'Try adjusting your filters to see more results.'
          : `There are no items in the ${process} process yet. Items will appear here as they progress through your pipeline.`}
      </p>
    </div>
  );
}
```

### 5.4 Update Exports
Update file: `src/components/products/index.ts`

```typescript
export * from './ProcessViewContainer';
export * from './ProcessTabs';
export * from './ProcessHeader';
export * from './ProcessFilters';
export * from './ProcessViewControls';
export * from './ProcessKanban';
export * from './ProcessCard';
export * from './ProcessEmptyState';
export * from './ProcessViewSkeleton';
```

### 5.5 Update Container to Use Kanban
Verify `ProcessViewContainer.tsx` imports and uses `ProcessKanban`:

```typescript
// In the return statement, ensure:
<div className="flex-1 overflow-auto p-6">
  {items.length === 0 && !loading ? (
    <ProcessEmptyState
      process={currentProcess.name}
      hasFilters={selectedUsers.length > 0 || health !== 'all' || search !== ''}
    />
  ) : (
    <ProcessKanban
      items={items}
      loading={loading}
      onItemClick={handleItemClick}
    />
  )}
</div>
```

## Testing Criteria

### Test 1: Visual Verification
Use Playwright MCP:

```typescript
// Navigate and wait for kanban
await page.goto('http://localhost:3000/products/process');
await page.waitForSelector('.grid-cols-3');

// Take full page screenshot
await page.screenshot({ path: 'kanban-view.png', fullPage: true });

// Verify 3 columns exist
const columns = await page.locator('.rounded-xl.border').count();
console.log('Column count:', columns); // Should be 3
```

### Test 2: Card Rendering
```typescript
// Check cards are rendered
const cards = await page.locator('.bg-white.rounded-lg.border.cursor-pointer').count();
console.log('Card count:', cards);

// Verify card content
const firstCard = page.locator('.bg-white.rounded-lg.border.cursor-pointer').first();
const companyName = await firstCard.locator('.font-semibold').first().textContent();
console.log('First card company:', companyName);
```

### Test 3: Card Click Opens Panel
```typescript
// Click first card
await page.click('.bg-white.rounded-lg.border.cursor-pointer');

// Verify side panel opens (will implement in Phase 6)
// For now, just verify click handler fires
```

### Test 4: Health Grouping
```typescript
// Get items in each column
const attentionColumn = page.locator('.rounded-xl.border').first();
const attentionCount = await attentionColumn.locator('.rounded-lg.cursor-pointer').count();

const stalledColumn = page.locator('.rounded-xl.border').nth(1);
const stalledCount = await stalledColumn.locator('.rounded-lg.cursor-pointer').count();

const healthyColumn = page.locator('.rounded-xl.border').nth(2);
const healthyCount = await healthyColumn.locator('.rounded-lg.cursor-pointer').count();

console.log('Attention:', attentionCount, 'Stalled:', stalledCount, 'Healthy:', healthyCount);
```

### Test 5: Filter Affects Cards
```typescript
// Apply attention filter
await page.click('text=Needs Attention');
await page.waitForTimeout(500);

// Verify only attention cards shown
const attentionCards = await page.locator('.bg-white.rounded-lg.cursor-pointer').count();

// The healthy column should be empty
const healthyColumn = page.locator('.rounded-xl.border').nth(2);
const healthyCards = await healthyColumn.locator('.rounded-lg.cursor-pointer').count();
console.log('Healthy cards after filter:', healthyCards); // Should be 0
```

### Test 6: Empty State
```typescript
// Search for non-existent company
await page.fill('input[placeholder="Search companies..."]', 'ZZZZNONEXISTENT');
await page.waitForTimeout(400);

// Verify empty state shows
const emptyState = await page.locator('text=No matching items').isVisible();
console.log('Empty state visible:', emptyState);
```

## Debugging Steps

### If columns don't render:
1. Check items array is populated
2. Verify ProcessKanban receives items prop
3. Check for CSS issues (grid-cols-3)

### If cards look wrong:
1. Compare with mockup
2. Check Tailwind classes are applied
3. Verify data is correct (company_name, product_name, etc.)

### If grouping is wrong:
1. Verify health_status values from API
2. Check filter logic in ProcessKanban
3. Test with console.log on groups object

### If hover effects don't work:
1. Check cursor-pointer is applied
2. Verify hover: classes are correct
3. Test transition classes

## Completion Checklist
- [ ] Kanban renders 3 columns
- [ ] Column headers show icon, title, and count
- [ ] Cards render with correct data
- [ ] Cards show company name, product badge, stage
- [ ] Health reason shows with colored dot
- [ ] Days show with appropriate color (red/amber/gray)
- [ ] MRR displays when present
- [ ] Owner avatar shows initials
- [ ] Hover effect works on cards
- [ ] Click handler fires on cards
- [ ] Empty state shows when no items
- [ ] Loading skeleton displays correctly
- [ ] Filters affect displayed cards

## Git Commit
```bash
git add -A
git commit -m "feat(products): add kanban view components

- Add ProcessKanban with health-based columns
- Add ProcessCard with minimal design
- Add ProcessEmptyState for no results
- Add loading skeleton for kanban
- Cards grouped by health status (attention/stalled/healthy)"
```

## Next Phase
Say "PHASE 5 COMPLETE - PHASE 6 STARTING" and proceed to Phase 6.
