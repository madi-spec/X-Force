'use client';

import { useRef, useState, useCallback, useEffect, MouseEvent, WheelEvent } from 'react';
import { useWorkflow } from '@/lib/workflow';
import { cn } from '@/lib/utils';

interface WorkflowCanvasProps {
  children?: React.ReactNode;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
}

export function WorkflowCanvas({ children, onDrop, onDragOver }: WorkflowCanvasProps) {
  const { canvasState, setZoom, setPan, selectNode, removeNode, removeConnection } = useWorkflow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Handle zoom with scroll wheel
  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Use proportional zoom based on scroll amount for smoother zooming
    // Clamp deltaY to prevent huge jumps from trackpad momentum
    const clampedDelta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 50);
    // Smaller multiplier for gentler zoom (0.002 = ~10% zoom per 50px scroll)
    const zoomDelta = -clampedDelta * 0.002 * canvasState.zoom;
    const newZoom = Math.max(0.25, Math.min(3, canvasState.zoom + zoomDelta));
    setZoom(newZoom);
  }, [canvasState.zoom, setZoom]);

  // Handle pan start
  const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    // Only pan if clicking on canvas background (not a node)
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-background')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasState.pan.x, y: e.clientY - canvasState.pan.y });
      // Deselect any selected node
      selectNode(null);
    }
  }, [canvasState.pan, selectNode]);

  // Handle pan move
  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  }, [isPanning, panStart, setPan]);

  // Handle pan end
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        selectNode(null);
      }

      // Delete/Backspace to remove selected node or connection
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (canvasState.selectedNodeId) {
          e.preventDefault();
          removeNode(canvasState.selectedNodeId);
        } else if (canvasState.selectedConnectionId) {
          e.preventDefault();
          removeConnection(canvasState.selectedConnectionId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectNode, removeNode, removeConnection, canvasState.selectedNodeId, canvasState.selectedConnectionId]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex-1 min-h-0 overflow-hidden bg-[#f8fafc]',
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
    >
      {/* Dot grid background */}
      <div
        className="canvas-background absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #cbd5e1 1px, transparent 1px)`,
          backgroundSize: `${24 * canvasState.zoom}px ${24 * canvasState.zoom}px`,
          backgroundPosition: `${canvasState.pan.x % (24 * canvasState.zoom)}px ${canvasState.pan.y % (24 * canvasState.zoom)}px`,
        }}
      />

      {/* Canvas content layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${canvasState.pan.x}px, ${canvasState.pan.y}px) scale(${canvasState.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Nodes and connections will be rendered here */}
        <div className="pointer-events-auto">
          {children}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white rounded-lg shadow-md border border-gray-200 p-1">
        <button
          onClick={() => setZoom(Math.max(0.25, canvasState.zoom - 0.1))}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-gray-600 font-medium disabled:opacity-50"
          disabled={canvasState.zoom <= 0.25}
        >
          −
        </button>
        <span className="w-12 text-center text-sm text-gray-600">
          {Math.round(canvasState.zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(Math.min(3, canvasState.zoom + 0.1))}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-gray-600 font-medium disabled:opacity-50"
          disabled={canvasState.zoom >= 3}
        >
          +
        </button>
        <div className="w-px h-6 bg-gray-200" />
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="px-2 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-sm text-gray-600"
        >
          Fit
        </button>
      </div>

      {/* Empty state hint */}
      {!children && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <p className="text-lg mb-2">Drag nodes from the toolbox to get started</p>
            <p className="text-sm">Or use the AI Pipeline Assistant to auto-generate</p>
          </div>
        </div>
      )}
    </div>
  );
}
