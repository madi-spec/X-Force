# Phase 5: Action Items with Inline Editing

## Objective
Create the ActionItemRow and ActionItemsList components with full inline editing capabilities.

## Prerequisites
- Phases 1-4 complete
- Server actions for action items available

---

## Step 5.1: Create ActionItemRow Component

Create file: `app/(dashboard)/meetings/components/ActionItemRow.tsx`

```typescript
'use client';

import { useState, useTransition } from 'react';
import { X, Check, GripVertical } from 'lucide-react';
import { EditableText } from './EditableText';
import { AssigneeDropdown } from './AssigneeDropdown';
import { DateDropdown } from './DateDropdown';
import { updateActionItemAction, deleteActionItemAction } from '../actions';
import type { ActionItemWithAssignee, ActionItemStatus } from '@/types/meetings';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface ActionItemRowProps {
  action: ActionItemWithAssignee;
  teamMembers: TeamMember[];
  onOptimisticUpdate?: (actionId: string, updates: Partial<ActionItemWithAssignee>) => void;
  onOptimisticDelete?: (actionId: string) => void;
}

const statusStyles: Record<ActionItemStatus, string> = {
  pending: 'border-slate-300 bg-white',
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
        // Would need to restore the item - handle via parent component
        console.error('Failed to delete:', result.error);
      }
    });
  };

  if (isDeleting) {
    return null;
  }

  return (
    <div
      className={`flex items-center justify-between p-2.5 rounded-lg bg-slate-50 group hover:bg-slate-100 transition-colors ${
        action.status === 'done' ? 'opacity-60' : ''
      } ${isPending ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Drag handle (visual only for now) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
          <GripVertical className="w-4 h-4 text-slate-400" />
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
          className={`text-sm text-slate-700 flex-1 min-w-0 ${
            action.status === 'done' ? 'line-through text-slate-400' : ''
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

        <span className="text-slate-300">•</span>

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
          className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
          title="Delete action item"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
```

---

## Step 5.2: Create ActionItemsList Component

Create file: `app/(dashboard)/meetings/components/ActionItemsList.tsx`

```typescript
'use client';

import { useState, useTransition, useOptimistic } from 'react';
import { Plus } from 'lucide-react';
import { ActionItemRow } from './ActionItemRow';
import { createActionItemAction } from '../actions';
import type { ActionItemWithAssignee } from '@/types/meetings';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface ActionItemsListProps {
  actionItems: ActionItemWithAssignee[];
  meetingId: string;
  teamMembers: TeamMember[];
}

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
    (state, action: { type: string; payload: any }) => {
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
      organization_id: '', // Will be set by server
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
        <p className="text-sm text-slate-500 italic py-2">No action items yet.</p>
      )}

      {/* Add new action item */}
      <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-slate-200 mt-3 focus-within:border-blue-300 focus-within:bg-blue-50/50 transition-colors">
        <Plus className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          type="text"
          value={newActionText}
          onChange={(e) => setNewActionText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add new action item..."
          disabled={isPending}
          className="flex-1 text-sm bg-transparent focus:outline-none text-slate-600 placeholder-slate-400 disabled:opacity-50"
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
```

---

## Step 5.3: Update Component Index

Update file: `app/(dashboard)/meetings/components/index.ts`

```typescript
export { EditableText } from './EditableText';
export { SentimentBadge } from './SentimentBadge';
export { DateDropdown } from './DateDropdown';
export { AssigneeDropdown } from './AssigneeDropdown';
export { StatsBar } from './StatsBar';
export { MeetingPrepCard } from './MeetingPrepCard';
export { PastMeetingCard } from './PastMeetingCard';
export { ActionItemRow } from './ActionItemRow';
export { ActionItemsList } from './ActionItemsList';
```

---

## Verification Checklist

### 1. TypeScript compilation
```bash
npx tsc app/\(dashboard\)/meetings/components/ActionItemRow.tsx --noEmit
npx tsc app/\(dashboard\)/meetings/components/ActionItemsList.tsx --noEmit
```
Expected: No errors

### 2. Test inline editing functionality
Create a test scenario:
1. Click on action item text - should become editable
2. Edit text and press Enter - should save
3. Press Escape - should cancel edit
4. Click checkbox - should cycle through statuses
5. Click assignee - should show dropdown
6. Click date - should show date picker
7. Type in "Add new action item" - should enable Add button
8. Press Enter or click Add - should create new item

### 3. Verify optimistic updates work
Check that:
- UI updates immediately on action
- Server action runs in background
- Error handling reverts changes

### 4. Check accessibility
- All interactive elements have keyboard support
- Focus states are visible
- Screen reader labels present

---

## Phase 5 Complete

Once all verification checks pass, proceed to `phase-6-customer.md`.
