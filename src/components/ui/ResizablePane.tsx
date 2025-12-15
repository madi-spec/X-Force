'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ResizablePaneProps {
  children: React.ReactNode;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  side: 'left' | 'right';
  className?: string;
  onResize?: (width: number) => void;
}

export function ResizablePane({
  children,
  defaultWidth,
  minWidth,
  maxWidth,
  side,
  className,
  onResize,
}: ResizablePaneProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !paneRef.current) return;

      const paneRect = paneRef.current.getBoundingClientRect();
      let newWidth: number;

      if (side === 'left') {
        newWidth = e.clientX - paneRect.left;
      } else {
        newWidth = paneRect.right - e.clientX;
      }

      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(newWidth);
      onResize?.(newWidth);
    },
    [isResizing, minWidth, maxWidth, side, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={paneRef}
      className={cn('relative flex-shrink-0', className)}
      style={{ width }}
    >
      {children}

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'absolute top-0 bottom-0 w-1 cursor-col-resize group z-10',
          'hover:bg-blue-500/50 transition-colors',
          isResizing && 'bg-blue-500',
          side === 'left' ? 'right-0' : 'left-0'
        )}
      >
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 w-4 h-8 -ml-1.5 flex items-center justify-center',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            isResizing && 'opacity-100'
          )}
        >
          <div className="flex gap-0.5">
            <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
            <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
