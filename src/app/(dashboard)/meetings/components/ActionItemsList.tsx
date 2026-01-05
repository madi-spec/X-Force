'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { Plus } from 'lucide-react';
import { ActionItemRow } from './ActionItemRow';
import { createActionItemAction } from '../actions';
import type { MeetingActionItem } from '@/types/meetings';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface ActionItemWithAssignee extends MeetingActionItem {
  assignee?: TeamMember | null;
}

interface ActionItemsListProps {
  actionItems: ActionItemWithAssignee[];
  meetingId: string;
  teamMembers: TeamMember[];
}

type OptimisticAction =
  | { type: 'add'; payload: ActionItemWithAssignee }
  | { type: 'update'; payload: { id: string; updates: Partial<ActionItemWithAssignee> } }
  | { type: 'delete'; payload: { id: string } };

export function ActionItemsList({
  actionItems: initialActionItems,
  meetingId,
  teamMembers,
}: ActionItemsListProps) {
  const [isPending, startTransition] = useTransition();
  const [newActionText, setNewActionText] = useState('');

  // Optimistic state for action items
  const [optimisticItems, setOptimisticItems] = useOptimistic(
    initialActionItems,
    (state: ActionItemWithAssignee[], action: OptimisticAction) => {
      switch (action.type) {
        case 'add':
          return [...state, action.payload];
        case 'update':
          return state.map((item) =>
            item.id === action.payload.id ? { ...item, ...action.payload.updates } : item
          );
        case 'delete':
          return state.filter((item) => item.id !== action.payload.id);
        default:
          return state;
      }
    }
  );

  const handleOptimisticUpdate = (actionId: string, updates: Partial<ActionItemWithAssignee>) => {
    startTransition(() => {
      setOptimisticItems({ type: 'update', payload: { id: actionId, updates } });
    });
  };

  const handleOptimisticDelete = (actionId: string) => {
    startTransition(() => {
      setOptimisticItems({ type: 'delete', payload: { id: actionId } });
    });
  };

  const handleAddAction = () => {
    const text = newActionText.trim();
    if (!text) return;

    // Create optimistic item
    const tempId = `temp-${Date.now()}`;
    const defaultAssignee = teamMembers[0];
    const defaultDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const optimisticItem: ActionItemWithAssignee = {
      id: tempId,
      organization_id: '',
      meeting_id: meetingId,
      transcript_id: null,
      text,
      assignee_id: defaultAssignee?.id || null,
      assignee: defaultAssignee || null,
      due_date: defaultDueDate,
      status: 'pending',
      completed_at: null,
      completed_by: null,
      source: 'manual',
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setNewActionText('');

    startTransition(async () => {
      setOptimisticItems({ type: 'add', payload: optimisticItem });

      const result = await createActionItemAction({
        text,
        meeting_id: meetingId,
        assignee_id: defaultAssignee?.id,
        due_date: defaultDueDate,
      });

      if (!result.success) {
        // Remove optimistic item on error
        setOptimisticItems({ type: 'delete', payload: { id: tempId } });
        console.error('Failed to create action item:', result.error);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddAction();
    }
  };

  return (
    <div className="space-y-2">
      {/* Existing action items */}
      {optimisticItems.map((action) => (
        <ActionItemRow
          key={action.id}
          action={action}
          teamMembers={teamMembers}
          onOptimisticUpdate={handleOptimisticUpdate}
          onOptimisticDelete={handleOptimisticDelete}
        />
      ))}

      {/* Empty state */}
      {optimisticItems.length === 0 && (
        <p className="text-sm text-gray-500 italic py-2">No action items yet.</p>
      )}

      {/* Add new action item */}
      <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-gray-200 mt-3 focus-within:border-blue-300 focus-within:bg-blue-50/50 transition-colors">
        <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={newActionText}
          onChange={(e) => setNewActionText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add new action item..."
          disabled={isPending}
          className="flex-1 text-sm bg-transparent focus:outline-none text-gray-600 placeholder-gray-400 disabled:opacity-50"
        />
        {newActionText.trim() && (
          <button
            onClick={handleAddAction}
            disabled={isPending}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Adding...' : 'Add'}
          </button>
        )}
      </div>
    </div>
  );
}
