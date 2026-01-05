'use client';

import { useState } from 'react';
import { Clock, MoreHorizontal, RefreshCw, UserPlus, Trash2 } from 'lucide-react';
import type { ProcessingTranscript } from '@/types/meetings';

interface ProcessingQueueItemProps {
  item: ProcessingTranscript;
  onReprocess?: (id: string) => void;
  onAssign?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export function ProcessingQueueItem({
  item,
  onReprocess,
  onAssign,
  onRemove,
}: ProcessingQueueItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  const isAnalyzing = item.status === 'processing';

  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Status indicator */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isAnalyzing ? 'bg-blue-100' : 'bg-gray-100'
          }`}
        >
          {isAnalyzing ? (
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          ) : (
            <Clock className="w-4 h-4 text-gray-400" />
          )}
        </div>

        {/* Title and metadata */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate">
            {item.title}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {item.word_count.toLocaleString()} words
            {item.source && (
              <span className="ml-2 capitalize">• {item.source.replace('_', ' ')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Progress bar for analyzing items */}
        {isAnalyzing && (
          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}

        {/* Status badge */}
        <span
          className={`text-xs font-medium px-2 py-1 rounded ${
            isAnalyzing
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {isAnalyzing ? `${item.progress}%` : 'Queued'}
        </span>

        {/* More options menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </button>

          {showMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />

              {/* Menu */}
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                <button
                  onClick={() => {
                    onReprocess?.(item.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reprocess
                </button>
                <button
                  onClick={() => {
                    onAssign?.(item.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign
                </button>
                <button
                  onClick={() => {
                    onRemove?.(item.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
