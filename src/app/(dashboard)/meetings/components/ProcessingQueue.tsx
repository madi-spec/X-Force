'use client';

import { useTransition } from 'react';
import { RefreshCw, UserPlus, Inbox } from 'lucide-react';
import { ProcessingQueueItem } from './ProcessingQueueItem';
import type { ProcessingTranscript } from '@/types/meetings';

interface ProcessingQueueProps {
  items: ProcessingTranscript[];
  onRefresh?: () => void;
}

export function ProcessingQueue({ items, onRefresh }: ProcessingQueueProps) {
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      onRefresh?.();
    });
  };

  const handleReprocess = (id: string) => {
    console.log('Reprocess:', id);
    // TODO: Implement reprocess action
  };

  const handleAssign = (id: string) => {
    console.log('Assign:', id);
    // TODO: Implement assign modal
  };

  const handleRemove = (id: string) => {
    console.log('Remove:', id);
    // TODO: Implement remove action
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <Inbox className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">No transcripts in queue</p>
        <p className="text-xs text-gray-400 mt-1">
          Upload a recording or connect a transcription service
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Queue header actions */}
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 px-3 py-1.5 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 px-3 py-1.5 hover:bg-white border border-transparent hover:border-gray-200 rounded-lg transition-colors">
          <UserPlus className="w-4 h-4" />
          Bulk Assign
        </button>
      </div>

      {/* Queue items */}
      <div className="space-y-2">
        {items.map((item) => (
          <ProcessingQueueItem
            key={item.id}
            item={item}
            onReprocess={handleReprocess}
            onAssign={handleAssign}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Queue stats */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
        <span>
          {items.filter((i) => i.status === 'processing').length} processing,{' '}
          {items.filter((i) => i.status === 'pending').length} queued
        </span>
        <span>
          Est. completion:{' '}
          {Math.ceil(
            items.reduce((acc, i) => acc + (100 - i.progress) / 10, 0)
          )}{' '}
          min
        </span>
      </div>
    </div>
  );
}
