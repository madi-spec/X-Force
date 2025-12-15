'use client';

import { useState, useCallback } from 'react';
import { CheckSquare, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MeetingActionItem, MeetingCommitment, MeetingOurCommitment } from '@/types';

interface ActionItemsListProps {
  actionItems: MeetingActionItem[];
  theirCommitments: MeetingCommitment[];
  ourCommitments: MeetingOurCommitment[];
  transcriptionId: string;
}

export function ActionItemsList({
  actionItems,
  theirCommitments,
  ourCommitments,
  transcriptionId,
}: ActionItemsListProps) {
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Filter to only "us" action items (our tasks)
  const ourActionItems = actionItems.filter((item) => item.owner === 'us');

  const handleToggleItem = (index: number) => {
    setSelectedItems((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
    // Clear error when user makes a selection
    setError(null);
  };

  const handleSelectAll = () => {
    if (selectedItems.length === ourActionItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(ourActionItems.map((_, i) => i));
    }
    setError(null);
  };

  const handleCreateTasks = useCallback(async () => {
    if (selectedItems.length === 0) return;

    setCreating(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/meetings/transcriptions/${transcriptionId}/create-tasks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionItemIndexes: selectedItems }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create tasks');
      }

      const data = await response.json();
      setCreatedCount((prev) => prev + data.tasksCreated);
      setSelectedItems([]);
    } catch (err) {
      console.error('Error creating tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to create tasks');
    } finally {
      setCreating(false);
    }
  }, [transcriptionId, selectedItems]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Action Items</h3>
        </div>
        {ourActionItems.length > 0 && (
          <div className="flex items-center gap-2">
            {createdCount > 0 && (
              <span className="text-sm text-green-600">
                {createdCount} task{createdCount !== 1 ? 's' : ''} created
              </span>
            )}
            <button
              onClick={handleCreateTasks}
              disabled={selectedItems.length === 0 || creating}
              className={cn(
                'flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors',
                'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {creating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create ${selectedItems.length > 0 ? selectedItems.length : ''} Task${selectedItems.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Our Commitments (Action Items) */}
        {ourActionItems.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">
                Our Commitments ({ourActionItems.length})
              </h4>
              <button
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {selectedItems.length === ourActionItems.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>
            <ul className="space-y-2">
              {ourActionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(i)}
                    onChange={() => handleToggleItem(i)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-gray-900">{item.task}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {item.dueDate && (
                        <span className="text-xs text-gray-500">
                          Due: {item.dueDate}
                        </span>
                      )}
                      <span
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          item.priority === 'high' &&
                            'bg-red-100 text-red-700',
                          item.priority === 'medium' &&
                            'bg-amber-100 text-amber-700',
                          item.priority === 'low' && 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {item.priority}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Additional Our Commitments from Analysis */}
        {ourCommitments.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Additional Commitments We Made
            </h4>
            <ul className="space-y-2">
              {ourCommitments.map((commitment, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-blue-600">•</span>
                  <span className="text-gray-900">{commitment.commitment}</span>
                  {commitment.when && (
                    <span className="text-gray-500 text-xs">
                      ({commitment.when})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Their Commitments */}
        {theirCommitments.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Their Commitments
            </h4>
            <ul className="space-y-2">
              {theirCommitments.map((commitment, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-amber-600">•</span>
                  <span className="text-gray-900">
                    <span className="font-medium">{commitment.who}</span>:{' '}
                    {commitment.commitment}
                    {commitment.when && (
                      <span className="text-gray-500 text-xs ml-1">
                        ({commitment.when})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ourActionItems.length === 0 &&
          ourCommitments.length === 0 &&
          theirCommitments.length === 0 && (
            <p className="text-sm text-gray-500">No action items identified</p>
          )}
      </div>
    </div>
  );
}
