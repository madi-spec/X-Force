'use client';

import { useState, useCallback } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { InlineActionItemRow } from './InlineActionItemRow';
import type { ActionItemWithAssignee } from '@/types/meetings';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface InlineActionItemsListProps {
  actionItems: ActionItemWithAssignee[];
  activityId: string;
  teamMembers: TeamMember[];
  onRefresh?: () => void;
}

export function InlineActionItemsList({
  actionItems: initialActionItems,
  activityId,
  teamMembers,
  onRefresh,
}: InlineActionItemsListProps) {
  const [actionItems, setActionItems] = useState(initialActionItems);
  const [newActionText, setNewActionText] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Update when props change
  if (initialActionItems !== actionItems && initialActionItems.length !== actionItems.length) {
    setActionItems(initialActionItems);
  }

  const handleUpdate = useCallback(
    async (actionId: string, updates: Partial<ActionItemWithAssignee>): Promise<boolean> => {
      try {
        const response = await fetch(`/api/action-items/${actionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error('Failed to update');
        }

        const updatedItem = await response.json();

        // Update local state
        setActionItems((prev) =>
          prev.map((item) => (item.id === actionId ? { ...item, ...updatedItem } : item))
        );

        return true;
      } catch (err) {
        console.error('Failed to update action item:', err);
        return false;
      }
    },
    []
  );

  const handleDelete = useCallback(async (actionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/action-items/${actionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      // Remove from local state
      setActionItems((prev) => prev.filter((item) => item.id !== actionId));

      return true;
    } catch (err) {
      console.error('Failed to delete action item:', err);
      return false;
    }
  }, []);

  const handleAddAction = async () => {
    const text = newActionText.trim();
    if (!text) return;

    setIsAdding(true);

    try {
      const response = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          activity_id: activityId,
          assignee_id: teamMembers[0]?.id || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create');
      }

      const newItem = await response.json();

      // Add to local state
      setActionItems((prev) => [...prev, newItem]);
      setNewActionText('');

      onRefresh?.();
    } catch (err) {
      console.error('Failed to create action item:', err);
    } finally {
      setIsAdding(false);
    }
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
      {actionItems.map((action) => (
        <InlineActionItemRow
          key={action.id}
          action={action}
          teamMembers={teamMembers}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      ))}

      {/* Empty state */}
      {actionItems.length === 0 && (
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
          disabled={isAdding}
          className="flex-1 text-sm bg-transparent focus:outline-none text-gray-600 placeholder-gray-400 disabled:opacity-50"
        />
        {newActionText.trim() && (
          <button
            onClick={handleAddAction}
            disabled={isAdding}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isAdding ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Adding...
              </>
            ) : (
              'Add'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
