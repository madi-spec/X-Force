'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';
import type { Commitment } from '@/lib/intelligence/relationshipStore';

interface CommitmentsTrackerProps {
  ourCommitments: Commitment[];
  theirCommitments: Commitment[];
  onMarkComplete?: (commitment: Commitment, type: 'ours' | 'theirs') => void;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-green-600 bg-green-50';
    case 'overdue':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-blue-600 bg-blue-50';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return CheckCircle2;
    case 'overdue':
      return AlertCircle;
    default:
      return Circle;
  }
}

function isOverdue(commitment: Commitment): boolean {
  const dueDate = commitment.due_by || commitment.expected_by;
  if (!dueDate) return false;
  const parsedDate = new Date(dueDate);
  // Only consider overdue if it's a valid date
  if (isNaN(parsedDate.getTime())) return false;
  return parsedDate < new Date() && commitment.status !== 'completed';
}

function CommitmentCard({
  commitment,
  type,
  onMarkComplete,
}: {
  commitment: Commitment;
  type: 'ours' | 'theirs';
  onMarkComplete?: (commitment: Commitment, type: 'ours' | 'theirs') => void;
}) {
  const overdue = isOverdue(commitment);
  const status = overdue ? 'overdue' : commitment.status;
  const StatusIcon = getStatusIcon(status);
  const dueDate = commitment.due_by || commitment.expected_by;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        status === 'completed'
          ? 'bg-gray-50 border-gray-200'
          : status === 'overdue'
          ? 'bg-red-50 border-red-200'
          : 'bg-white border-gray-200 hover:border-blue-300'
      )}
    >
      <button
        onClick={() => onMarkComplete?.(commitment, type)}
        disabled={status === 'completed'}
        className={cn(
          'mt-0.5 p-0.5 rounded transition-colors',
          status === 'completed'
            ? 'cursor-default'
            : 'hover:bg-gray-200'
        )}
      >
        <StatusIcon
          className={cn(
            'w-5 h-5',
            status === 'completed'
              ? 'text-green-500'
              : status === 'overdue'
              ? 'text-red-500'
              : 'text-gray-400'
          )}
        />
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm',
            status === 'completed'
              ? 'text-gray-500 line-through'
              : 'text-gray-900'
          )}
        >
          {commitment.commitment}
        </p>

        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
          {dueDate && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {status === 'overdue' && !isNaN(new Date(dueDate).getTime()) ? (
                <span className="text-red-600 font-medium">
                  Overdue ({formatRelativeTime(dueDate)})
                </span>
              ) : !isNaN(new Date(dueDate).getTime()) ? (
                <span>Due {formatDate(dueDate)}</span>
              ) : (
                <span>Due: {dueDate}</span>
              )}
            </span>
          )}
          <span>From {commitment.source_type}</span>
        </div>
      </div>
    </div>
  );
}

export function CommitmentsTracker({
  ourCommitments,
  theirCommitments,
  onMarkComplete,
}: CommitmentsTrackerProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  // Separate pending and completed
  const ourPending = ourCommitments.filter((c) => c.status !== 'completed');
  const ourCompleted = ourCommitments.filter((c) => c.status === 'completed');
  const theirPending = theirCommitments.filter((c) => c.status !== 'completed');
  const theirCompleted = theirCommitments.filter((c) => c.status === 'completed');

  const totalPending = ourPending.length + theirPending.length;
  const totalCompleted = ourCompleted.length + theirCompleted.length;
  const totalOverdue = [...ourPending, ...theirPending].filter(isOverdue).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-blue-500" />
          <h3 className="font-medium text-gray-900">
            Commitments
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {totalOverdue > 0 && (
            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
              {totalOverdue} overdue
            </span>
          )}
          <span className="text-sm text-gray-500">
            {totalPending} pending • {totalCompleted} completed
          </span>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-6">
        {/* Our Commitments */}
        <div>
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
            <ArrowRight className="w-4 h-4 text-green-500" />
            <h4 className="text-sm font-medium text-gray-700">
              We Promised ({ourPending.length})
            </h4>
          </div>
          <div className="space-y-2">
            {ourPending.length > 0 ? (
              ourPending.map((commitment, index) => (
                <CommitmentCard
                  key={`our-${commitment.source_id}-${index}`}
                  commitment={commitment}
                  type="ours"
                  onMarkComplete={onMarkComplete}
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 italic py-2">
                No pending commitments from us.
              </p>
            )}
          </div>
        </div>

        {/* Their Commitments */}
        <div>
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
            <ArrowLeft className="w-4 h-4 text-blue-500" />
            <h4 className="text-sm font-medium text-gray-700">
              They Promised ({theirPending.length})
            </h4>
          </div>
          <div className="space-y-2">
            {theirPending.length > 0 ? (
              theirPending.map((commitment, index) => (
                <CommitmentCard
                  key={`their-${commitment.source_id}-${index}`}
                  commitment={commitment}
                  type="theirs"
                  onMarkComplete={onMarkComplete}
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 italic py-2">
                No pending commitments from them.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Show completed toggle */}
      {totalCompleted > 0 && (
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          {showCompleted ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide {totalCompleted} completed
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {totalCompleted} completed
            </>
          )}
        </button>
      )}

      {/* Completed commitments */}
      {showCompleted && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-6">
          <div className="space-y-2">
            {ourCompleted.map((commitment, index) => (
              <CommitmentCard
                key={`our-completed-${index}`}
                commitment={commitment}
                type="ours"
              />
            ))}
          </div>
          <div className="space-y-2">
            {theirCompleted.map((commitment, index) => (
              <CommitmentCard
                key={`their-completed-${index}`}
                commitment={commitment}
                type="theirs"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
