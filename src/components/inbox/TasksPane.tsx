'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Clock,
  Circle,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Calendar,
  FileText,
  X,
  Pencil,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Task } from '@/types';

interface TasksPaneProps {
  onClose: () => void;
}

const priorityColors: Record<string, string> = {
  high: 'text-red-600 bg-red-50',
  medium: 'text-yellow-600 bg-yellow-50',
  low: 'text-gray-600 bg-gray-50',
};

export function TasksPane({ onClose }: TasksPaneProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overdue', 'today'])
  );
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<{
    title: string;
    description: string;
    type: string;
    priority: string;
    due_at: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    type: 'custom' as const,
    priority: 'medium' as const,
    due_at: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleCompleteTask = async (taskId: string) => {
    // Optimistic update - remove task immediately
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed_at: new Date().toISOString() }),
      });
      if (!res.ok) {
        // Revert on error - refetch tasks
        console.error('Failed to complete task:', await res.text());
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to complete task:', err);
      // Revert on error - refetch tasks
      fetchTasks();
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTask,
          due_at: newTask.due_at || new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewTask({
          title: '',
          description: '',
          type: 'custom',
          priority: 'medium',
          due_at: '',
        });
        fetchTasks();
      } else {
        console.error('Failed to create task:', await res.text());
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (task: Task) => {
    // Convert ISO date to datetime-local format
    const dueDate = new Date(task.due_at);
    const localDateTime = dueDate.toISOString().slice(0, 16);

    setEditedTask({
      title: task.title,
      description: task.description || '',
      type: task.type,
      priority: task.priority,
      due_at: localDateTime,
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedTask(null);
  };

  const handleSaveEdit = async () => {
    if (!selectedTask || !editedTask || !editedTask.title.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editedTask.title,
          description: editedTask.description || null,
          type: editedTask.type,
          priority: editedTask.priority,
          due_at: new Date(editedTask.due_at).toISOString(),
        }),
      });

      if (res.ok) {
        setIsEditing(false);
        setEditedTask(null);
        setSelectedTask(null);
        fetchTasks();
      } else {
        console.error('Failed to update task:', await res.text());
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Group tasks
  const openTasks = tasks.filter((t) => !t.completed_at);
  const overdueTasks = openTasks.filter((t) => new Date(t.due_at) < new Date());
  const todayTasks = openTasks.filter((t) => {
    const dueDate = new Date(t.due_at);
    const today = new Date();
    return (
      dueDate >= today && dueDate.toDateString() === today.toDateString()
    );
  });
  const upcomingTasks = openTasks.filter((t) => {
    const dueDate = new Date(t.due_at);
    const today = new Date();
    return dueDate > today && dueDate.toDateString() !== today.toDateString();
  });

  const CompactTaskItem = ({ task }: { task: Task }) => {
    const isFirefliesReview = task.source === 'fireflies_ai' && task.type === 'review';

    return (
      <div
        onClick={() => setSelectedTask(task)}
        className={cn(
          'flex items-start gap-2 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer group',
          isFirefliesReview && 'bg-amber-50/50'
        )}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCompleteTask(task.id);
          }}
          className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors"
        >
          <Circle className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 truncate">
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatRelativeTime(task.due_at)}
            </span>
            {task.deal && (
              <span className="text-[10px] text-blue-500 truncate">
                {task.deal.name}
              </span>
            )}
            {isFirefliesReview && (
              <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                <FileText className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        </div>
        {task.priority && (
          <span
            className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0',
              priorityColors[task.priority]
            )}
          >
            {task.priority.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="w-72 flex-shrink-0 border-l border-gray-200 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-900">Tasks</span>
          <span className="text-xs text-gray-500">({openTasks.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchTasks}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Overdue */}
            {overdueTasks.length > 0 && (
              <div className="rounded-lg border border-red-200 overflow-hidden">
                <button
                  onClick={() => toggleSection('overdue')}
                  className="w-full flex items-center justify-between px-2 py-1.5 bg-red-50 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-xs font-medium text-red-700">
                      Overdue
                    </span>
                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                      {overdueTasks.length}
                    </span>
                  </div>
                  {expandedSections.has('overdue') ? (
                    <ChevronUp className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-red-400" />
                  )}
                </button>
                {expandedSections.has('overdue') && (
                  <div className="p-1 bg-white">
                    {overdueTasks.slice(0, 5).map((task) => (
                      <CompactTaskItem key={task.id} task={task} />
                    ))}
                    {overdueTasks.length > 5 && (
                      <Link
                        href="/tasks"
                        className="block text-center text-[10px] text-red-600 py-1 hover:underline"
                      >
                        +{overdueTasks.length - 5} more
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Today */}
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleSection('today')}
                className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-50 text-left"
              >
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-gray-500" />
                  <span className="text-xs font-medium text-gray-700">
                    Today
                  </span>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                    {todayTasks.length}
                  </span>
                </div>
                {expandedSections.has('today') ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                )}
              </button>
              {expandedSections.has('today') && (
                <div className="p-1 bg-white">
                  {todayTasks.length > 0 ? (
                    todayTasks.slice(0, 5).map((task) => (
                      <CompactTaskItem key={task.id} task={task} />
                    ))
                  ) : (
                    <p className="text-center text-[10px] text-gray-400 py-3">
                      No tasks due today
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Upcoming */}
            {upcomingTasks.length > 0 && (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleSection('upcoming')}
                  className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700">
                      Upcoming
                    </span>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                      {upcomingTasks.length}
                    </span>
                  </div>
                  {expandedSections.has('upcoming') ? (
                    <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </button>
                {expandedSections.has('upcoming') && (
                  <div className="p-1 bg-white">
                    {upcomingTasks.slice(0, 5).map((task) => (
                      <CompactTaskItem key={task.id} task={task} />
                    ))}
                    {upcomingTasks.length > 5 && (
                      <Link
                        href="/tasks"
                        className="block text-center text-[10px] text-blue-600 py-1 hover:underline"
                      >
                        +{upcomingTasks.length - 5} more
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick add */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Task
        </button>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setSelectedTask(null);
              cancelEditing();
            }}
          />
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-4 border-b border-gray-200">
              <div className="flex-1 min-w-0 pr-4">
                {isEditing && editedTask ? (
                  <input
                    type="text"
                    value={editedTask.title}
                    onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                    className="w-full text-sm font-semibold text-gray-900 px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {selectedTask.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedTask.priority && (
                        <span
                          className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                            priorityColors[selectedTask.priority]
                          )}
                        >
                          {selectedTask.priority.charAt(0).toUpperCase() + selectedTask.priority.slice(1)}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 capitalize">
                        {selectedTask.type.replace('_', ' ')}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!isEditing && (
                  <button
                    onClick={() => startEditing(selectedTask)}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit task"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    cancelEditing();
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              {isEditing && editedTask ? (
                <>
                  {/* Edit: Description */}
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </label>
                    <textarea
                      value={editedTask.description}
                      onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                      placeholder="Add details..."
                      rows={3}
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Edit: Due Date */}
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </label>
                    <input
                      type="datetime-local"
                      value={editedTask.due_at}
                      onChange={(e) => setEditedTask({ ...editedTask, due_at: e.target.value })}
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Edit: Type & Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </label>
                      <select
                        value={editedTask.type}
                        onChange={(e) => setEditedTask({ ...editedTask, type: e.target.value })}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="custom">Custom</option>
                        <option value="follow_up">Follow Up</option>
                        <option value="call">Call</option>
                        <option value="email">Email</option>
                        <option value="meeting">Meeting</option>
                        <option value="review">Review</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Priority
                      </label>
                      <select
                        value={editedTask.priority}
                        onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value })}
                        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* View: Due date */}
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Due
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {new Date(selectedTask.due_at).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className={cn(
                        'text-xs',
                        new Date(selectedTask.due_at) < new Date() ? 'text-red-600' : 'text-gray-500'
                      )}>
                        ({formatRelativeTime(selectedTask.due_at)})
                      </span>
                    </div>
                  </div>

                  {/* View: Description */}
                  {selectedTask.description && (
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </label>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                        {selectedTask.description}
                      </p>
                    </div>
                  )}

                  {/* View: Related deal */}
                  {selectedTask.deal && (
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Related Deal
                      </label>
                      <Link
                        href={`/deals/${selectedTask.deal_id}`}
                        className="flex items-center gap-2 mt-1 text-sm text-blue-600 hover:underline"
                      >
                        {selectedTask.deal.name}
                      </Link>
                    </div>
                  )}

                  {/* View: Related company */}
                  {selectedTask.company && (
                    <div>
                      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Related Company
                      </label>
                      <Link
                        href={`/companies/${selectedTask.company_id}`}
                        className="flex items-center gap-2 mt-1 text-sm text-blue-600 hover:underline"
                      >
                        {selectedTask.company.name}
                      </Link>
                    </div>
                  )}

                  {/* View: Source */}
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </label>
                    <p className="text-sm text-gray-700 mt-1 capitalize">
                      {selectedTask.source.replace(/_/g, ' ')}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 p-4 border-t border-gray-200 bg-gray-50">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editedTask?.title.trim() || isSaving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    {isSaving ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      handleCompleteTask(selectedTask.id);
                      setSelectedTask(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Complete
                  </button>
                  <button
                    onClick={() => startEditing(selectedTask)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCreateModal(false)}
          />
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">New Task</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* Title */}
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Title *
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Enter task title..."
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Add details..."
                  rows={3}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </label>
                <input
                  type="datetime-local"
                  value={newTask.due_at}
                  onChange={(e) => setNewTask({ ...newTask, due_at: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Type & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </label>
                  <select
                    value={newTask.type}
                    onChange={(e) => setNewTask({ ...newTask, type: e.target.value as typeof newTask.type })}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="custom">Custom</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="call">Call</option>
                    <option value="email">Email</option>
                    <option value="meeting">Meeting</option>
                    <option value="review">Review</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as typeof newTask.priority })}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleCreateTask}
                disabled={!newTask.title.trim() || isCreating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {isCreating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {isCreating ? 'Creating...' : 'Create Task'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
