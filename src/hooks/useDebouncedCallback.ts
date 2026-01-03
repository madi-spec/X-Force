import { useCallback, useRef, useEffect } from 'react';

/**
 * A hook that returns a debounced version of a callback.
 *
 * Features:
 * - Debounces the callback by the specified delay
 * - Provides flush() to execute immediately
 * - Provides cancel() to cancel pending execution
 * - Properly cleans up on unmount
 *
 * @param callback The function to debounce
 * @param delay The debounce delay in milliseconds
 * @returns A debounced function with flush() and cancel() methods
 *
 * @example
 * const saveToServer = useDebouncedCallback(async (data) => {
 *   await fetch('/api/save', { body: JSON.stringify(data) });
 * }, 1000);
 *
 * // Call whenever data changes
 * saveToServer(newData);
 *
 * // Force immediate execution
 * saveToServer.flush();
 *
 * // Cancel pending execution
 * saveToServer.cancel();
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T & { flush: () => void; cancel: () => void } {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const argsRef = useRef<unknown[]>([]);

  // Update callback ref on each render (so we always call the latest version)
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      // Store args for flush
      argsRef.current = args;

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        timeoutRef.current = null;
      }, delay);
    },
    [delay]
  ) as T & { flush: () => void; cancel: () => void };

  // Flush: execute immediately with last args
  debouncedFn.flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      callbackRef.current(...argsRef.current);
    }
  }, []);

  // Cancel: don't execute
  debouncedFn.cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return debouncedFn;
}

export default useDebouncedCallback;
