'use client';

import { useTransition, useCallback } from 'react';
import { excludeMeetingAction, restoreMeetingAction } from '../actions';

interface UseExcludeMeetingOptions {
  onExclude?: (meetingId: string) => void;
  onRestore?: (meetingId: string) => void;
  onError?: (error: string) => void;
}

export function useExcludeMeeting(options: UseExcludeMeetingOptions = {}) {
  const [isPending, startTransition] = useTransition();

  const exclude = useCallback(
    (meetingId: string) => {
      options.onExclude?.(meetingId);

      startTransition(async () => {
        const result = await excludeMeetingAction(meetingId);
        if (!result.success) {
          options.onError?.(result.error || 'Failed to exclude meeting');
        }
      });
    },
    [options]
  );

  const restore = useCallback(
    (meetingId: string) => {
      options.onRestore?.(meetingId);

      startTransition(async () => {
        const result = await restoreMeetingAction(meetingId);
        if (!result.success) {
          options.onError?.(result.error || 'Failed to restore meeting');
        }
      });
    },
    [options]
  );

  return {
    exclude,
    restore,
    isPending,
  };
}
