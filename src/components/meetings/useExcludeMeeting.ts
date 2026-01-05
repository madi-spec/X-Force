'use client';

import { useTransition, useCallback } from 'react';

interface UseExcludeMeetingOptions {
  onExclude?: (meetingId: string) => void;
  onRestore?: (meetingId: string) => void;
  onError?: (error: string) => void;
}

export function useExcludeMeeting(options: UseExcludeMeetingOptions = {}) {
  const [isPending, startTransition] = useTransition();

  const exclude = useCallback(
    (meetingId: string, reason?: string) => {
      // Optimistic callback
      options.onExclude?.(meetingId);

      startTransition(async () => {
        try {
          const response = await fetch(`/api/activities/${meetingId}/exclude`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to exclude meeting');
          }
        } catch (err) {
          options.onError?.(err instanceof Error ? err.message : 'Failed to exclude meeting');
        }
      });
    },
    [options]
  );

  const restore = useCallback(
    (meetingId: string) => {
      // Optimistic callback
      options.onRestore?.(meetingId);

      startTransition(async () => {
        try {
          const response = await fetch(`/api/activities/${meetingId}/exclude`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to restore meeting');
          }
        } catch (err) {
          options.onError?.(err instanceof Error ? err.message : 'Failed to restore meeting');
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
