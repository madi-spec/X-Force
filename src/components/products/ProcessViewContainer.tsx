'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ProcessTabs } from './ProcessTabs';
import { ProcessHeader } from './ProcessHeader';
import { ProcessFilters } from './ProcessFilters';
import { ProcessViewControls } from './ProcessViewControls';
import { ProcessKanban } from './ProcessKanban';
import { ProcessList } from './ProcessList';
import { ProcessSidePanel } from './ProcessSidePanel';
import { StageMoveModal } from './StageMoveModal';
import { ProcessEmptyState } from './ProcessEmptyState';
import { ProcessViewSkeleton } from './ProcessViewSkeleton';
import {
  ProcessType,
  PipelineItem,
  ProcessStats,
  StageDefinition,
  ViewMode,
  DisplayMode,
  HealthStatus,
  PROCESSES
} from '@/types/products';

interface ProcessStatsEntry {
  process: ProcessType;
  total: number;
  needsAttention: number;
}

export function ProcessViewContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL State - use primitive strings to avoid infinite loops
  const activeProcess = (searchParams.get('process') || 'sales') as ProcessType;
  const productsParam = searchParams.get('products') || '';
  const usersParam = searchParams.get('users') || '';
  const healthFilter = (searchParams.get('health') || 'all') as HealthStatus | 'all';
  const searchQuery = searchParams.get('search') || '';
  const viewMode = (searchParams.get('view') || 'all') as ViewMode;
  const displayMode = (searchParams.get('display') || 'kanban') as DisplayMode;

  // Memoize arrays to prevent infinite re-renders
  const selectedProducts = useMemo(
    () => productsParam.split(',').filter(Boolean),
    [productsParam]
  );
  const selectedUsers = useMemo(
    () => usersParam.split(',').filter(Boolean),
    [usersParam]
  );

  // Data State
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [stats, setStats] = useState<ProcessStats | null>(null);
  const [stages, setStages] = useState<StageDefinition[]>([]);
  const [processStats, setProcessStats] = useState<ProcessStatsEntry[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; initials: string }[]>([]);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [stageMoveTarget, setStageMoveTarget] = useState<{ item: PipelineItem; toStage: StageDefinition } | null>(null);

  // Update URL params
  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`/products/process?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Fetch process stats for tabs
  const fetchProcessStats = useCallback(async () => {
    try {
      const res = await fetch('/api/products/process/stats');
      if (res.ok) {
        const data = await res.json();
        setProcessStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch process stats:', error);
    }
  }, []);

  // Fetch main data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('process', activeProcess);
      if (selectedProducts.length > 0) params.set('products', selectedProducts.join(','));
      if (selectedUsers.length > 0) params.set('users', selectedUsers.join(','));
      if (healthFilter !== 'all') params.set('health', healthFilter);
      if (searchQuery) params.set('search', searchQuery);

      const url = `/api/products/process?${params.toString()}`;
      const res = await fetch(url);

      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setStats(data.stats || null);
        setStages(data.stages || []);
      }
    } catch (error) {
      console.error('Failed to fetch process data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeProcess, productsParam, usersParam, healthFilter, searchQuery]);

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const [productsRes, usersRes] = await Promise.all([
        fetch('/api/products/list'),
        fetch('/api/products/users')
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.map((u: { id: string; name: string }) => ({
          id: u.id,
          name: u.name,
          initials: u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        })));
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  }, []);

  // Track if mounted (for SSR safety)
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initial load - only after mounting
  useEffect(() => {
    if (!isMounted) return;
    fetchProcessStats();
    fetchFilterOptions();
  }, [isMounted, fetchProcessStats, fetchFilterOptions]);

  // Fetch data when filters change
  useEffect(() => {
    if (!isMounted) return;
    fetchData();
  }, [isMounted, fetchData]);

  // Process change handler
  const handleProcessChange = useCallback((process: ProcessType) => {
    updateParams({ process, products: null, users: null, health: null, search: null });
    setSelectedItem(null);
  }, [updateParams]);

  // Handle stage move
  const handleStageMoveRequest = useCallback((item: PipelineItem, toStage: StageDefinition) => {
    setStageMoveTarget({ item, toStage });
  }, []);

  const handleStageMoveComplete = useCallback(async (note: string) => {
    if (!stageMoveTarget) return;

    try {
      const res = await fetch('/api/products/process/move-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: stageMoveTarget.item.id,
          to_stage_id: stageMoveTarget.toStage.id,
          note
        })
      });

      if (res.ok) {
        setStageMoveTarget(null);
        setSelectedItem(null);
        await fetchData();
        await fetchProcessStats();
      }
    } catch (error) {
      console.error('Failed to move stage:', error);
    }
  }, [stageMoveTarget, fetchData, fetchProcessStats]);

  // Handle marking deal as won
  const handleMarkWon = useCallback(async (item: PipelineItem) => {
    if (!confirm(`Mark ${item.company_name} - ${item.product_name} as WON?`)) return;

    try {
      const res = await fetch('/api/products/process/update-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.id,
          outcome: 'won'
        })
      });

      if (res.ok) {
        setSelectedItem(null);
        await fetchData();
        await fetchProcessStats();
      }
    } catch (error) {
      console.error('Failed to mark as won:', error);
    }
  }, [fetchData, fetchProcessStats]);

  // Handle marking deal as lost
  const handleMarkLost = useCallback(async (item: PipelineItem) => {
    const reason = prompt(`Mark ${item.company_name} - ${item.product_name} as LOST?\n\nEnter reason (optional):`);
    if (reason === null) return; // User cancelled

    try {
      const res = await fetch('/api/products/process/update-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.id,
          outcome: 'lost',
          reason: reason || undefined
        })
      });

      if (res.ok) {
        setSelectedItem(null);
        await fetchData();
        await fetchProcessStats();
      }
    } catch (error) {
      console.error('Failed to mark as lost:', error);
    }
  }, [fetchData, fetchProcessStats]);

  const currentProcess = PROCESSES[activeProcess];

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      {/* Tabs */}
      <ProcessTabs
        activeProcess={activeProcess}
        processStats={processStats}
        onProcessChange={handleProcessChange}
      />

      {/* Main Content */}
      <div className="px-6 py-6">
        {/* Header */}
        <ProcessHeader
          process={currentProcess}
          stats={stats}
          isLoading={isLoading}
        />

        {/* Filters & Controls */}
        <div className="flex items-center justify-between mt-6 mb-4">
          <ProcessFilters
            products={products}
            users={users}
            selectedProducts={selectedProducts}
            selectedUsers={selectedUsers}
            healthFilter={healthFilter}
            searchQuery={searchQuery}
            onUpdateParams={updateParams}
          />

          <ProcessViewControls
            viewMode={viewMode}
            displayMode={displayMode}
            onViewModeChange={(mode) => updateParams({ view: mode })}
            onDisplayModeChange={(mode) => updateParams({ display: mode })}
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <ProcessViewSkeleton />
        ) : items.length === 0 ? (
          <ProcessEmptyState process={currentProcess} />
        ) : displayMode === 'list' ? (
          <ProcessList
            items={items}
            onItemClick={setSelectedItem}
            onMarkWon={handleMarkWon}
            onMarkLost={handleMarkLost}
          />
        ) : (
          <ProcessKanban
            items={items}
            stages={stages}
            viewMode={viewMode}
            onItemClick={setSelectedItem}
            onMarkWon={handleMarkWon}
            onMarkLost={handleMarkLost}
          />
        )}
      </div>

      {/* Side Panel */}
      {selectedItem && (
        <ProcessSidePanel
          item={selectedItem}
          stages={stages}
          onClose={() => setSelectedItem(null)}
          onStageMove={handleStageMoveRequest}
        />
      )}

      {/* Stage Move Modal */}
      {stageMoveTarget && (
        <StageMoveModal
          item={stageMoveTarget.item}
          fromStage={stages.find(s => s.id === stageMoveTarget.item.current_stage_id) || null}
          toStage={stageMoveTarget.toStage}
          onConfirm={handleStageMoveComplete}
          onCancel={() => setStageMoveTarget(null)}
        />
      )}
    </div>
  );
}
