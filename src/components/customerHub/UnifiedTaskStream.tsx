'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useLens, useWidgetVisibility } from '@/lib/lens';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Ticket,
  MessageSquare,
  ChevronRight,
  Plus,
  Filter,
} from 'lucide-react';
import { UnifiedTask } from './types';

interface UnifiedTaskStreamProps {
  tasks: UnifiedTask[];
  companyId: string;
  className?: string;
}

type TaskFilter = 'all' | 'case_followup' | 'overdue_promise' | 'next_step' | 'manual';

const taskTypeConfig: Record<string, { label: string; icon: typeof Ticket; color: string; bgColor: string }> = {
  case_followup: {
    label: 'Case Follow-up',
    icon: Ticket,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  overdue_promise: {
    label: 'Overdue Promise',
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  next_step: {
    label: 'Next Step',
    icon: ChevronRight,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  manual: {
    label: 'Manual Task',
    icon: CheckCircle2,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
  },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-600 bg-red-50' },
  high: { label: 'High', color: 'text-orange-600 bg-orange-50' },
  medium: { label: 'Medium', color: 'text-yellow-600 bg-yellow-50' },
  low: { label: 'Low', color: 'text-gray-500 bg-gray-50' },
};

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays}d`;
}

function TaskItem({ task, onComplete }: { task: UnifiedTask; onComplete?: (id: string) => void }) {
  const config = taskTypeConfig[task.type] || taskTypeConfig.manual;
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const Icon = config.icon;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        task.status === 'completed'
          ? 'bg-gray-50 border-gray-200 opacity-60'
          : isOverdue
            ? 'bg-red-50 border-red-200'
            : 'bg-white border-gray-200 hover:border-gray-300'
      )}
    >
      <button
        onClick={() => onComplete?.(task.id)}
        className={cn(
          'mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
          task.status === 'completed'
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        {task.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                'text-sm font-medium',
                task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'
              )}
            >
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('px-1.5 py-0.5 rounded text-xs', priority.color)}>
              {priority.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <div className={cn('flex items-center gap-1 text-xs', config.color)}>
            <Icon className="h-3 w-3" />
            <span>{config.label}</span>
          </div>
          {task.due_date && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                isOverdue ? 'text-red-600' : 'text-gray-500'
              )}
            >
              <Clock className="h-3 w-3" />
              <span>{formatDueDate(task.due_date)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function UnifiedTaskStream({ tasks, companyId, className }: UnifiedTaskStreamProps) {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const isVisible = useWidgetVisibility('unified_task_stream');

  // Don't render if not visible for current lens
  if (!isVisible) return null;

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'all') return true;
    return task.type === filter;
  });

  const pendingTasks = filteredTasks.filter((t) => t.status !== 'completed');
  const completedTasks = filteredTasks.filter((t) => t.status === 'completed');

  const handleComplete = async (taskId: string) => {
    // TODO: Implement task completion API call
    console.log('Complete task:', taskId);
  };

  const handleAddTask = () => {
    // TODO: Implement add task modal
    console.log('Add task for company:', companyId);
  };

  const filters: { key: TaskFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: tasks.filter((t) => t.status !== 'completed').length },
    { key: 'case_followup', label: 'Cases', count: tasks.filter((t) => t.type === 'case_followup' && t.status !== 'completed').length },
    { key: 'overdue_promise', label: 'Overdue', count: tasks.filter((t) => t.type === 'overdue_promise' && t.status !== 'completed').length },
    { key: 'next_step', label: 'Next Steps', count: tasks.filter((t) => t.type === 'next_step' && t.status !== 'completed').length },
    { key: 'manual', label: 'Manual', count: tasks.filter((t) => t.type === 'manual' && t.status !== 'completed').length },
  ];

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">Unified Task Stream</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {pendingTasks.length} pending tasks
            </p>
          </div>
          <button
            onClick={handleAddTask}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1 mt-3 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors',
                filter === f.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {f.label}
              {f.count > 0 && (
                <span className="ml-1 opacity-75">({f.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="p-4 space-y-2">
        {pendingTasks.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">All caught up!</p>
            <p className="text-xs text-gray-400 mt-1">No pending tasks</p>
          </div>
        ) : (
          pendingTasks.map((task) => (
            <TaskItem key={task.id} task={task} onComplete={handleComplete} />
          ))
        )}

        {/* Completed tasks (collapsed by default) */}
        {completedTasks.length > 0 && (
          <details className="mt-4">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              {completedTasks.length} completed tasks
            </summary>
            <div className="mt-2 space-y-2">
              {completedTasks.slice(0, 5).map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
