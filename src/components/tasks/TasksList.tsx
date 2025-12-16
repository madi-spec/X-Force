'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  AlertCircle,
  Mail,
  Phone,
  Play,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { TranscriptReviewTaskModal } from './TranscriptReviewTaskModal';
import { TaskActionModal } from './TaskActionModal';
import type { Task } from '@/types';

const priorityColors: Record<string, string> = {
  high: 'text-red-600 bg-red-50',
  medium: 'text-yellow-600 bg-yellow-50',
  low: 'text-gray-600 bg-gray-50',
};

const typeIcons: Record<string, string> = {
  follow_up: 'Follow Up',
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  review: 'Review',
  custom: 'Task',
};

interface TasksListProps {
  overdueTasks: Task[];
  todayTasks: Task[];
  upcomingTasks: Task[];
  completedTasks: Task[];
}

export function TasksList({
  overdueTasks,
  todayTasks,
  upcomingTasks,
  completedTasks,
}: TasksListProps) {
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);

  const handleTaskClick = (task: Task) => {
    // Check if this is a fireflies_ai task that needs the special modal
    if (task.source === 'fireflies_ai' && task.type === 'review' && !task.completed_at) {
      setSelectedTask(task);
      setShowReviewModal(true);
    }
  };

  const handleActionClick = (task: Task) => {
    setSelectedTask(task);
    setShowActionModal(true);
  };

  const handleResolved = () => {
    // Refresh the page to show updated tasks
    router.refresh();
    setShowReviewModal(false);
    setSelectedTask(null);
  };

  const handleActionCompleted = () => {
    router.refresh();
    setShowActionModal(false);
    setSelectedTask(null);
  };

  const getActionButton = (task: Task) => {
    if (task.completed_at) return null;

    // Don't show action button for fireflies review tasks (they have their own button)
    if (task.source === 'fireflies_ai' && task.type === 'review') return null;

    switch (task.type) {
      case 'email':
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleActionClick(task);
            }}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 text-sm font-medium rounded-lg hover:bg-blue-200 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Compose Email
          </button>
        );
      case 'call':
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleActionClick(task);
            }}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 text-sm font-medium rounded-lg hover:bg-green-200 transition-colors"
          >
            <Phone className="h-4 w-4" />
            Log Call
          </button>
        );
      case 'meeting':
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleActionClick(task);
            }}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-800 text-sm font-medium rounded-lg hover:bg-purple-200 transition-colors"
          >
            <Calendar className="h-4 w-4" />
            Complete Meeting
          </button>
        );
      case 'follow_up':
      case 'custom':
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleActionClick(task);
            }}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Play className="h-4 w-4" />
            Complete Task
          </button>
        );
      default:
        return null;
    }
  };

  const TaskItem = ({ task }: { task: Task }) => {
    const isFirefliesReview = task.source === 'fireflies_ai' && task.type === 'review';

    return (
      <div
        className={cn(
          'flex items-start gap-3 p-4 hover:bg-gray-50 border-b border-gray-100 last:border-0',
          isFirefliesReview && 'bg-amber-50/50 hover:bg-amber-50'
        )}
      >
        <button className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors">
          <Circle className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-gray-900">{task.title}</p>
              {task.description && !isFirefliesReview && (
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                  {task.description}
                </p>
              )}
              {isFirefliesReview && (
                <p className="text-sm text-amber-700 mt-0.5">
                  Review transcript and assign to company/deal
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                {task.deal && (
                  <Link
                    href={`/deals/${task.deal.id}`}
                    className="hover:text-blue-600"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {task.deal.name}
                  </Link>
                )}
                {task.company && !task.deal && (
                  <Link
                    href={`/companies/${task.company.id}`}
                    className="hover:text-blue-600"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {task.company.name}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  priorityColors[task.priority]
                )}
              >
                {task.priority}
              </span>
              <span className="text-xs text-gray-500">
                {typeIcons[task.type] || task.type}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatRelativeTime(task.due_at)}</span>
            {task.source === 'ai_recommendation' && (
              <span className="ml-2 text-blue-500">AI suggested</span>
            )}
            {task.source === 'fireflies_ai' && (
              <span className="ml-2 text-amber-600 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Transcript review
              </span>
            )}
          </div>

          {/* Special action button for fireflies tasks */}
          {isFirefliesReview && !task.completed_at && (
            <button
              onClick={() => handleTaskClick(task)}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 text-sm font-medium rounded-lg hover:bg-amber-200 transition-colors"
            >
              <AlertCircle className="h-4 w-4" />
              Review & Assign
            </button>
          )}

          {/* Action buttons for other task types */}
          {getActionButton(task)}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* Overdue */}
        {overdueTasks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
            <div className="px-4 py-3 bg-red-50 border-b border-red-200">
              <h2 className="font-medium text-red-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Overdue ({overdueTasks.length})
              </h2>
            </div>
            <div>
              {overdueTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Today */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Today ({todayTasks.length})
            </h2>
          </div>
          <div>
            {todayTasks.length > 0 ? (
              todayTasks.map((task) => <TaskItem key={task.id} task={task} />)
            ) : (
              <p className="px-4 py-8 text-center text-gray-500 text-sm">
                No tasks due today
              </p>
            )}
          </div>
        </div>

        {/* Upcoming */}
        {upcomingTasks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-medium text-gray-700">
                Upcoming ({upcomingTasks.length})
              </h2>
            </div>
            <div>
              {upcomingTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {completedTasks.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-medium text-gray-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Completed ({completedTasks.length})
              </h2>
            </div>
            <div>
              {completedTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-4 border-b border-gray-100 last:border-0 opacity-60"
                >
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <p className="text-gray-500 line-through">{task.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Transcript Review Modal */}
      {selectedTask && showReviewModal && (
        <TranscriptReviewTaskModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          onResolved={handleResolved}
        />
      )}

      {/* Task Action Modal */}
      {selectedTask && showActionModal && (
        <TaskActionModal
          isOpen={showActionModal}
          onClose={() => {
            setShowActionModal(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          onCompleted={handleActionCompleted}
        />
      )}
    </>
  );
}
