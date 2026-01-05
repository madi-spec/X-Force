'use client';

import { useState, useTransition } from 'react';
import { X, Check, GripVertical } from 'lucide-react';
import { EditableText } from './EditableText';
import { AssigneeDropdown } from './AssigneeDropdown';
import { DateDropdown } from './DateDropdown';
import { updateActionItemAction, deleteActionItemAction } from '../actions';
import type { ActionItemStatus, MeetingActionItem } from '@/types/meetings';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface ActionItemWithAssignee extends MeetingActionItem {
  assignee?: TeamMember | null;
}

interface ActionItemRowProps {
  action: ActionItemWithAssignee;
  teamMembers: TeamMember[];
  onOptimisticUpdate?: (actionId: string, updates: Partial<ActionItemWithAssignee>) => void;
  onOptimisticDelete?: (actionId: string) => void;
}

const statusStyles: Record<ActionItemStatus, string> = {
  pending: 'border-gray-300 bg-white',
  in_progress: 'border-blue-400 bg-blue-100',
  done: 'border-emerald-400 bg-emerald-400',
};

const statusOrder: ActionItemStatus[] = ['pending', 'in_progress', 'done'];

export function ActionItemRow({
  action,
  teamMembers,
  onOptimisticUpdate,
  onOptimisticDelete,
}: ActionItemRowProps) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const cycleStatus = () => {
    const currentIndex = statusOrder.indexOf(action.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

    // Optimistic update
    onOptimisticUpdate?.(action.id, { status: nextStatus });

    startTransition(async () => {
      const result = await updateActionItemAction(action.id, { status: nextStatus });
      if (!result.success) {
        // Revert on error
        onOptimisticUpdate?.(action.id, { status: action.status });
        console.error('Failed to update status:', result.error);
      }
    });
  };

  const handleTextSave = (newText: string) => {
    if (newText === action.text) return;

    onOptimisticUpdate?.(action.id, { text: newText });

    startTransition(async () => {
      const result = await updateActionItemAction(action.id, { text: newText });
      if (!result.success) {
        onOptimisticUpdate?.(action.id, { text: action.text });
        console.error('Failed to update text:', result.error);
      }
    });
  };

  const handleAssigneeChange = (member: TeamMember) => {
    onOptimisticUpdate?.(action.id, {
      assignee_id: member.id,
      assignee: {
        id: member.id,
        name: member.name,
        email: member.email,
        avatar_url: member.avatar_url,
      },
    });

    startTransition(async () => {
      const result = await updateActionItemAction(action.id, { assignee_id: member.id });
      if (!result.success) {
        onOptimisticUpdate?.(action.id, {
          assignee_id: action.assignee_id,
          assignee: action.assignee,
        });
        console.error('Failed to update assignee:', result.error);
      }
    });
  };

  const handleDateChange = (newDate: string) => {
    onOptimisticUpdate?.(action.id, { due_date: newDate });

    startTransition(async () => {
      const result = await updateActionItemAction(action.id, { due_date: newDate });
      if (!result.success) {
        onOptimisticUpdate?.(action.id, { due_date: action.due_date });
        console.error('Failed to update date:', result.error);
      }
    });
  };

  const handleDelete = () => {
    setIsDeleting(true);
    onOptimisticDelete?.(action.id);

    startTransition(async () => {
      const result = await deleteActionItemAction(action.id);
      if (!result.success) {
        setIsDeleting(false);
        console.error('Failed to delete:', result.error);
      }
    });
  };

  if (isDeleting) {
    return null;
  }

  return (
    <div
      className={`flex items-center justify-between p-2.5 rounded-lg bg-gray-50 group hover:bg-gray-100 transition-colors ${
        action.status === 'done' ? 'opacity-60' : ''
      } ${isPending ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Drag handle (visual only for now) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>

        {/* Status checkbox */}
        <button
          onClick={cycleStatus}
          disabled={isPending}
          className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            statusStyles[action.status]
          } ${isPending ? 'cursor-wait' : 'cursor-pointer hover:border-blue-400'}`}
          title={`Status: ${action.status.replace('_', ' ')}`}
        >
          {action.status === 'done' && <Check className="w-3 h-3 text-white" />}
          {action.status === 'in_progress' && (
            <div className="w-2 h-2 bg-blue-400 rounded-full" />
          )}
        </button>

        {/* Editable text */}
        <span
          className={`text-sm text-gray-700 flex-1 min-w-0 ${
            action.status === 'done' ? 'line-through text-gray-400' : ''
          }`}
        >
          <EditableText
            value={action.text}
            onSave={handleTextSave}
            disabled={isPending}
            className="w-full"
          />
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Assignee dropdown */}
        <AssigneeDropdown
          assignee={action.assignee || null}
          teamMembers={teamMembers}
          onAssign={handleAssigneeChange}
          disabled={isPending}
        />

        <span className="text-gray-300">•</span>

        {/* Date dropdown */}
        <DateDropdown
          date={action.due_date}
          onDateChange={handleDateChange}
          disabled={isPending}
        />

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
          title="Delete action item"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
