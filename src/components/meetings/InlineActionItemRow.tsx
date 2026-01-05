'use client';

import { useState, useTransition } from 'react';
import { X, Check, GripVertical, Sparkles } from 'lucide-react';
import { InlineEditableText } from './InlineEditableText';
import { TeamMemberDropdown } from './TeamMemberDropdown';
import { DueDateDropdown } from './DueDateDropdown';
import type { ActionItemWithAssignee, ActionItemStatus } from '@/types/meetings';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface InlineActionItemRowProps {
  action: ActionItemWithAssignee;
  teamMembers: TeamMember[];
  onUpdate: (actionId: string, updates: Partial<ActionItemWithAssignee>) => Promise<boolean>;
  onDelete: (actionId: string) => Promise<boolean>;
}

const statusStyles: Record<ActionItemStatus, string> = {
  pending: 'border-gray-300 bg-white',
  in_progress: 'border-blue-400 bg-blue-100',
  done: 'border-emerald-400 bg-emerald-400',
};

const statusOrder: ActionItemStatus[] = ['pending', 'in_progress', 'done'];

export function InlineActionItemRow({
  action,
  teamMembers,
  onUpdate,
  onDelete,
}: InlineActionItemRowProps) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [localAction, setLocalAction] = useState(action);

  // Update local state when prop changes
  if (action.id !== localAction.id || action.updated_at !== localAction.updated_at) {
    setLocalAction(action);
  }

  const cycleStatus = () => {
    const currentIndex = statusOrder.indexOf(localAction.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

    // Optimistic update
    setLocalAction({ ...localAction, status: nextStatus });

    startTransition(async () => {
      const success = await onUpdate(action.id, { status: nextStatus });
      if (!success) {
        // Revert on error
        setLocalAction({ ...localAction });
      }
    });
  };

  const handleTextSave = (newText: string) => {
    if (newText === localAction.text) return;

    setLocalAction({ ...localAction, text: newText });

    startTransition(async () => {
      const success = await onUpdate(action.id, { text: newText });
      if (!success) {
        setLocalAction({ ...localAction });
      }
    });
  };

  const handleAssigneeChange = (member: TeamMember) => {
    setLocalAction({
      ...localAction,
      assignee_id: member.id,
      assignee: {
        id: member.id,
        name: member.name,
        email: member.email,
        avatar_url: member.avatar_url,
      },
    });

    startTransition(async () => {
      const success = await onUpdate(action.id, { assignee_id: member.id });
      if (!success) {
        setLocalAction({ ...localAction });
      }
    });
  };

  const handleDateChange = (newDate: string | null) => {
    setLocalAction({ ...localAction, due_date: newDate });

    startTransition(async () => {
      const success = await onUpdate(action.id, { due_date: newDate });
      if (!success) {
        setLocalAction({ ...localAction });
      }
    });
  };

  const handleDelete = () => {
    setIsDeleting(true);

    startTransition(async () => {
      const success = await onDelete(action.id);
      if (!success) {
        setIsDeleting(false);
      }
    });
  };

  if (isDeleting) {
    return null;
  }

  return (
    <div
      className={`flex items-center justify-between p-2.5 rounded-lg bg-gray-50 group hover:bg-gray-100 transition-colors ${
        localAction.status === 'done' ? 'opacity-60' : ''
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
            statusStyles[localAction.status]
          } ${isPending ? 'cursor-wait' : 'cursor-pointer hover:border-blue-400'}`}
          title={`Status: ${localAction.status.replace('_', ' ')}`}
        >
          {localAction.status === 'done' && <Check className="w-3 h-3 text-white" />}
          {localAction.status === 'in_progress' && (
            <div className="w-2 h-2 bg-blue-400 rounded-full" />
          )}
        </button>

        {/* Editable text */}
        <div
          className={`text-sm text-gray-700 flex-1 min-w-0 ${
            localAction.status === 'done' ? 'line-through text-gray-400' : ''
          }`}
        >
          <InlineEditableText
            value={localAction.text}
            onSave={handleTextSave}
            disabled={isPending}
            className="w-full"
          />
        </div>

        {/* AI badge */}
        {localAction.source === 'ai_generated' && (
          <span className="flex-shrink-0 px-1.5 py-0.5 bg-purple-100 text-purple-600 text-[10px] rounded flex items-center gap-0.5">
            <Sparkles className="w-3 h-3" />
            AI
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {/* Assignee dropdown */}
        <TeamMemberDropdown
          assignee={localAction.assignee || null}
          teamMembers={teamMembers}
          onAssign={handleAssigneeChange}
          disabled={isPending}
        />

        <span className="text-gray-300">•</span>

        {/* Date dropdown */}
        <DueDateDropdown
          date={localAction.due_date}
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
