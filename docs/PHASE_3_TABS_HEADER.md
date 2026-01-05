# PHASE 3: Process Tabs & Header Components

## Objective
Create the main page layout, process tabs navigation, and header with stats cards.

## Pre-Phase Checklist
- [ ] Phase 2 complete (API routes working)
- [ ] Test `/api/products/process/stats` returns data
- [ ] Review mockup: `/mnt/user-data/outputs/products-pipeline-redesign/mockup-v5-minimal.html`
- [ ] Review existing page patterns in `src/app/(dashboard)/`

## Tasks

### 3.1 Create Products Process Page
Create file: `src/app/(dashboard)/products/process/page.tsx`

```typescript
import { Suspense } from 'react';
import { ProcessViewContainer } from '@/components/products/ProcessViewContainer';
import { ProcessViewSkeleton } from '@/components/products/ProcessViewSkeleton';

export const metadata = {
  title: 'Products Process | X-FORCE',
};

export default function ProductsProcessPage() {
  return (
    <Suspense fallback={<ProcessViewSkeleton />}>
      <ProcessViewContainer />
    </Suspense>
  );
}
```

### 3.2 Create Process View Container
Create file: `src/components/products/ProcessViewContainer.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ProcessTabs } from './ProcessTabs';
import { ProcessHeader } from './ProcessHeader';
import { ProcessFilters } from './ProcessFilters';
import { ProcessViewControls } from './ProcessViewControls';
import { ProcessKanban } from './ProcessKanban';
import { ProcessSidePanel } from './ProcessSidePanel';
import { StageMoveModal } from './StageMoveModal';
import { 
  ProcessType, 
  ViewMode, 
  HealthStatus, 
  PipelineItem,
  ProcessStats,
  StageDefinition,
  PROCESSES 
} from '@/types/products';

interface ProcessStatsData {
  process: ProcessType;
  total: number;
  needsAttention: number;
}

export function ProcessViewContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State from URL
  const process = (searchParams.get('process') || 'sales') as ProcessType;
  const view = (searchParams.get('view') || 'all') as ViewMode;
  const health = (searchParams.get('health') || 'all') as HealthStatus | 'all';
  const search = searchParams.get('search') || '';
  const selectedProducts = searchParams.get('products')?.split(',').filter(Boolean) || [];
  const selectedUsers = searchParams.get('users')?.split(',').filter(Boolean) || [];

  // Local state
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [stats, setStats] = useState<ProcessStats | null>(null);
  const [stages, setStages] = useState<StageDefinition[]>([]);
  const [processStats, setProcessStats] = useState<ProcessStatsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidePanelItem, setSidePanelItem] = useState<PipelineItem | null>(null);
  const [stageMoveData, setStageMoveData] = useState<{
    item: PipelineItem;
    toStage: StageDefinition;
  } | null>(null);

  // Update URL params
  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/products/process?${params.toString()}`, { scroll: false });
  };

  // Fetch process stats for tabs
  useEffect(() => {
    async function fetchProcessStats() {
      try {
        const res = await fetch('/api/products/process/stats');
        if (res.ok) {
          const data = await res.json();
          setProcessStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch process stats:', error);
      }
    }
    fetchProcessStats();
  }, []);

  // Fetch pipeline data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('process', process);
        if (selectedProducts.length > 0) params.set('products', selectedProducts.join(','));
        if (selectedUsers.length > 0) params.set('users', selectedUsers.join(','));
        if (health !== 'all') params.set('health', health);
        if (search) params.set('search', search);

        const res = await fetch(`/api/products/process?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items);
          setStats(data.stats);
          setStages(data.stages);
        }
      } catch (error) {
        console.error('Failed to fetch process data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [process, selectedProducts.join(','), selectedUsers.join(','), health, search]);

  // Handlers
  const handleProcessChange = (newProcess: ProcessType) => {
    updateParams({ process: newProcess });
    setSidePanelItem(null);
  };

  const handleViewChange = (newView: ViewMode) => {
    updateParams({ view: newView });
  };

  const handleHealthChange = (newHealth: HealthStatus | 'all') => {
    updateParams({ health: newHealth === 'all' ? null : newHealth });
  };

  const handleSearchChange = (newSearch: string) => {
    updateParams({ search: newSearch || null });
  };

  const handleProductsChange = (products: string[]) => {
    updateParams({ products: products.length > 0 ? products.join(',') : null });
  };

  const handleUsersChange = (users: string[]) => {
    updateParams({ users: users.length > 0 ? users.join(',') : null });
  };

  const handleItemClick = (item: PipelineItem) => {
    setSidePanelItem(item);
  };

  const handleStageMove = (item: PipelineItem, toStage: StageDefinition) => {
    setStageMoveData({ item, toStage });
  };

  const handleStageMoveConfirm = async (note: string) => {
    if (!stageMoveData) return;
    
    try {
      const res = await fetch('/api/products/process/move-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: stageMoveData.item.id,
          to_stage_id: stageMoveData.toStage.id,
          note,
        }),
      });

      if (res.ok) {
        // Refresh data
        const params = new URLSearchParams();
        params.set('process', process);
        if (selectedProducts.length > 0) params.set('products', selectedProducts.join(','));
        if (selectedUsers.length > 0) params.set('users', selectedUsers.join(','));
        if (health !== 'all') params.set('health', health);
        if (search) params.set('search', search);

        const refreshRes = await fetch(`/api/products/process?${params.toString()}`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setItems(data.items);
          setStats(data.stats);
        }
        
        setStageMoveData(null);
        setSidePanelItem(null);
      }
    } catch (error) {
      console.error('Failed to move stage:', error);
    }
  };

  const currentProcess = PROCESSES[process];

  return (
    <div className="flex flex-col h-full bg-[#f6f8fb]">
      <ProcessTabs
        activeProcess={process}
        processStats={processStats}
        onProcessChange={handleProcessChange}
      />
      
      <ProcessHeader
        process={currentProcess}
        stats={stats}
        loading={loading}
      />
      
      <ProcessFilters
        selectedProducts={selectedProducts}
        selectedUsers={selectedUsers}
        health={health}
        search={search}
        onProductsChange={handleProductsChange}
        onUsersChange={handleUsersChange}
        onHealthChange={handleHealthChange}
        onSearchChange={handleSearchChange}
      />
      
      <ProcessViewControls
        view={view}
        onViewChange={handleViewChange}
      />
      
      <div className="flex-1 overflow-auto p-6">
        <ProcessKanban
          items={items}
          loading={loading}
          onItemClick={handleItemClick}
        />
      </div>

      {sidePanelItem && (
        <ProcessSidePanel
          item={sidePanelItem}
          stages={stages}
          onClose={() => setSidePanelItem(null)}
          onStageMove={handleStageMove}
        />
      )}

      {stageMoveData && (
        <StageMoveModal
          item={stageMoveData.item}
          fromStage={stageMoveData.item.stage_name || 'Unknown'}
          toStage={stageMoveData.toStage.name}
          onConfirm={handleStageMoveConfirm}
          onCancel={() => setStageMoveData(null)}
        />
      )}
    </div>
  );
}
```

### 3.3 Create Process Tabs Component
Create file: `src/components/products/ProcessTabs.tsx`

```typescript
'use client';

import { ProcessType, PROCESSES } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessStatsData {
  process: ProcessType;
  total: number;
  needsAttention: number;
}

interface ProcessTabsProps {
  activeProcess: ProcessType;
  processStats: ProcessStatsData[];
  onProcessChange: (process: ProcessType) => void;
}

export function ProcessTabs({ activeProcess, processStats, onProcessChange }: ProcessTabsProps) {
  const processes = Object.values(PROCESSES);

  const getStats = (processId: ProcessType) => {
    return processStats.find(s => s.process === processId) || { total: 0, needsAttention: 0 };
  };

  return (
    <div className="bg-white border-b border-[#e6eaf0] px-6">
      <div className="flex gap-1">
        {processes.map((process) => {
          const stats = getStats(process.id);
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
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-semibold',
                  isActive
                    ? 'bg-[#0b1220] text-white'
                    : 'bg-[#eef2f7] text-[#667085]'
                )}
              >
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
```

### 3.4 Create Process Header Component
Create file: `src/components/products/ProcessHeader.tsx`

```typescript
'use client';

import { Settings } from 'lucide-react';
import { ProcessDefinition, ProcessStats } from '@/types/products';
import { cn } from '@/lib/utils';

interface ProcessHeaderProps {
  process: ProcessDefinition;
  stats: ProcessStats | null;
  loading: boolean;
}

export function ProcessHeader({ process, stats, loading }: ProcessHeaderProps) {
  return (
    <div className="bg-white border-b border-[#e6eaf0] px-6 py-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{process.icon}</span>
            <h1 className="text-xl font-semibold text-[#0b1220]">
              {process.name} Process
            </h1>
          </div>
          <p className="text-sm text-[#667085] mt-1">
            {process.description}
          </p>
        </div>
        
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e6eaf0] rounded-lg text-sm font-medium text-[#0b1220] hover:bg-[#f6f8fb] transition-colors">
          <Settings className="w-4 h-4" />
          Process Editor
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          value={stats?.total || 0}
          label="Total Items"
          loading={loading}
        />
        <StatCard
          value={stats?.needsAttention || 0}
          label="Need Attention"
          loading={loading}
          valueClassName={stats?.needsAttention ? 'text-[#f59e0b]' : undefined}
        />
        <StatCard
          value={`$${(stats?.totalMrr || 0).toLocaleString()}`}
          label={process.id === 'sales' ? 'Pipeline MRR' : 'MRR'}
          loading={loading}
          valueClassName="text-[#22c55e]"
        />
        <StatCard
          value={stats?.productCount || 0}
          label="Products"
          loading={loading}
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  value: number | string;
  label: string;
  loading: boolean;
  valueClassName?: string;
}

function StatCard({ value, label, loading, valueClassName }: StatCardProps) {
  return (
    <div className="bg-white border border-[#e6eaf0] rounded-xl p-4">
      {loading ? (
        <div className="h-8 w-16 bg-[#eef2f7] rounded animate-pulse" />
      ) : (
        <div className={cn('text-2xl font-bold text-[#0b1220]', valueClassName)}>
          {value}
        </div>
      )}
      <div className="text-xs text-[#667085] mt-0.5">{label}</div>
    </div>
  );
}
```

### 3.5 Create Skeleton Component
Create file: `src/components/products/ProcessViewSkeleton.tsx`

```typescript
export function ProcessViewSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[#f6f8fb]">
      {/* Tabs skeleton */}
      <div className="bg-white border-b border-[#e6eaf0] px-6 py-3">
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-24 bg-[#eef2f7] rounded animate-pulse" />
          ))}
        </div>
      </div>

      {/* Header skeleton */}
      <div className="bg-white border-b border-[#e6eaf0] px-6 py-5">
        <div className="h-7 w-48 bg-[#eef2f7] rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-[#eef2f7] rounded animate-pulse mb-5" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-[#e6eaf0] rounded-xl p-4">
              <div className="h-8 w-16 bg-[#eef2f7] rounded animate-pulse mb-1" />
              <div className="h-3 w-20 bg-[#eef2f7] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter skeleton */}
      <div className="bg-white border-b border-[#e6eaf0] px-6 py-3">
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-32 bg-[#eef2f7] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-3 gap-4 h-full">
          {[1, 2, 3].map((col) => (
            <div key={col} className="bg-white rounded-xl border border-[#e6eaf0]">
              <div className="p-4 border-b border-[#e6eaf0]">
                <div className="h-5 w-32 bg-[#eef2f7] rounded animate-pulse" />
              </div>
              <div className="p-3 space-y-3">
                {[1, 2, 3].map((card) => (
                  <div key={card} className="h-28 bg-[#eef2f7] rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 3.6 Create Index Export
Create file: `src/components/products/index.ts`

```typescript
export * from './ProcessViewContainer';
export * from './ProcessTabs';
export * from './ProcessHeader';
export * from './ProcessViewSkeleton';
```

## Testing Criteria

### Test 1: Visual Verification with Playwright
Use Playwright MCP to take screenshots:

```typescript
// Navigate to the page
await page.goto('http://localhost:3000/products/process');

// Wait for content to load
await page.waitForSelector('[data-testid="process-tabs"]');

// Take screenshot
await page.screenshot({ path: 'process-view-initial.png', fullPage: true });

// Verify tabs are visible
const salesTab = await page.locator('text=Sales').isVisible();
console.log('Sales tab visible:', salesTab);
```

### Test 2: Tab Navigation
```typescript
// Click each tab and verify URL changes
await page.click('text=Onboarding');
await page.waitForURL('**/products/process?process=onboarding');

await page.click('text=Customer Service');
await page.waitForURL('**/products/process?process=customer_service');

// Take screenshot of different process
await page.screenshot({ path: 'process-view-onboarding.png' });
```

### Test 3: Stats Display
```typescript
// Verify stats cards are rendered
const statsCards = await page.locator('.stat-card').count();
console.log('Stats cards count:', statsCards); // Should be 4

// Verify values are numbers (not loading state)
const totalItems = await page.locator('text=Total Items').locator('..').locator('.text-2xl').textContent();
console.log('Total items:', totalItems);
```

## Debugging Steps

### If page doesn't load:
1. Check for TypeScript errors: `npx tsc --noEmit`
2. Check browser console for errors
3. Verify API routes are working
4. Check imports are correct

### If tabs don't switch:
1. Verify `onProcessChange` is being called
2. Check URL is updating
3. Verify `useSearchParams` is working

### If stats show 0:
1. Verify API returns data
2. Check `processStats` state is being populated
3. Verify stats calculation in API

## Completion Checklist
- [ ] Page renders without errors
- [ ] Process tabs display with correct counts
- [ ] Clicking tabs changes process and URL
- [ ] Header shows process name and description
- [ ] Stats cards display data (or loading state)
- [ ] Skeleton shows while loading
- [ ] No TypeScript errors
- [ ] Visual matches mockup design

## Git Commit
```bash
git add -A
git commit -m "feat(products): add process tabs and header components

- Add /products/process page with suspense
- Add ProcessViewContainer with URL state management
- Add ProcessTabs with counts and attention indicators
- Add ProcessHeader with stats cards
- Add ProcessViewSkeleton for loading state"
```

## Next Phase
Say "PHASE 3 COMPLETE - PHASE 4 STARTING" and proceed to Phase 4.
