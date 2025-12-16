'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { createClient } from '@/lib/supabase/client';
import { type Deal, type DealStage, PIPELINE_STAGES } from '@/types';
import { PipelineColumn } from './PipelineColumn';
import { DealCard } from './DealCard';

interface KanbanBoardProps {
  initialDeals: Deal[];
}

export function KanbanBoard({ initialDeals }: KanbanBoardProps) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [isMounted, setIsMounted] = useState(false);

  // Sync deals state when initialDeals prop changes (e.g., from filtering)
  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  // Only render DnD context on client to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const getDealsByStage = useCallback(
    (stage: DealStage) => deals.filter((deal) => deal.stage === stage),
    [deals]
  );

  // Find which stage a deal belongs to
  const findStageForDeal = useCallback(
    (dealId: string): DealStage | null => {
      const deal = deals.find((d) => d.id === dealId);
      return deal?.stage || null;
    },
    [deals]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    if (deal) {
      setActiveDeal(deal);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the active deal
    const activeDealData = deals.find((d) => d.id === activeId);
    if (!activeDealData) return;

    // Check if we're over a stage column directly
    const isOverStage = PIPELINE_STAGES.some((s) => s.id === overId);

    let targetStage: DealStage | null = null;

    if (isOverStage) {
      // Dropping directly on a column
      targetStage = overId as DealStage;
    } else {
      // Dropping on another deal - find which column that deal is in
      targetStage = findStageForDeal(overId);
    }

    // If we found a target stage and it's different from current, update
    if (targetStage && activeDealData.stage !== targetStage) {
      setDeals((prevDeals) =>
        prevDeals.map((deal) =>
          deal.id === activeId ? { ...deal, stage: targetStage } : deal
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active } = event;
    setActiveDeal(null);

    const activeId = active.id as string;
    const deal = deals.find((d) => d.id === activeId);

    if (!deal) return;

    // Update in database
    try {
      const supabase = createClient();

      // Check if we're authenticated
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current auth user:', user?.id, user?.email);

      const { data, error, count } = await supabase
        .from('deals')
        .update({ stage: deal.stage })
        .eq('id', deal.id)
        .select();

      console.log('Update result:', { data, error, count, dealId: deal.id, newStage: deal.stage });

      if (error) {
        console.error('Failed to update deal stage:', error.message, error.code, error.details);
        setDeals(initialDeals);
      } else if (!data || data.length === 0) {
        console.error('Update returned no rows - likely RLS issue');
        setDeals(initialDeals);
      } else {
        console.log('Deal updated successfully:', data);
      }
    } catch (err) {
      console.error('Failed to update deal:', err);
      setDeals(initialDeals);
    }
  };

  // Filter out closed stages for main view
  const activeStages = PIPELINE_STAGES.filter(
    (s) => s.id !== 'closed_won' && s.id !== 'closed_lost'
  );

  // Show loading skeleton until client-side hydration is complete
  if (!isMounted) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {activeStages.map((stage) => (
          <div key={stage.id} className="flex flex-col w-72 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 mb-2">
              <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
              <h3 className="font-medium text-gray-900 text-sm">{stage.name}</h3>
            </div>
            <div className="flex-1 rounded-xl p-2 min-h-[200px] bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {activeStages.map((stage) => (
          <PipelineColumn
            key={stage.id}
            stage={stage}
            deals={getDealsByStage(stage.id)}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
