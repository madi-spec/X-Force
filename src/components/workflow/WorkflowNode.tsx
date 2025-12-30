'use client';

import { useRef, useState, useCallback, useEffect, MouseEvent } from 'react';
import { useWorkflow, WorkflowNode, NODE_CATEGORIES } from '@/lib/workflow';
import { cn } from '@/lib/utils';

// Default output ports for condition nodes
const DEFAULT_CONDITION_OUTPUTS = [
  { id: 'yes', label: 'Yes', color: '#10b981' },
  { id: 'no', label: 'No', color: '#ef4444' },
];

interface OutputPort {
  id: string;
  label: string;
  color: string;
}

interface WorkflowNodeComponentProps {
  node: WorkflowNode;
  onStartConnection?: (nodeId: string, port: string) => void;
  onEndConnection?: (nodeId: string, port: string) => void;
  isConnecting?: boolean;
}

export function WorkflowNodeComponent({
  node,
  onStartConnection,
  onEndConnection,
  isConnecting,
}: WorkflowNodeComponentProps) {
  const { canvasState, selectNode, updateNodePosition, processConfig } = useWorkflow();
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const isSelected = canvasState.selectedNodeId === node.id;
  const category = NODE_CATEGORIES[node.type];

  // Handle node click
  const handleClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id);
  }, [node.id, selectNode]);

  // Handle drag start
  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Don't start drag if clicking on a port
    if ((e.target as HTMLElement).closest('.connection-port')) return;

    e.stopPropagation();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX / canvasState.zoom - node.position.x,
      y: e.clientY / canvasState.zoom - node.position.y,
    });
    selectNode(node.id);
  }, [node.position, canvasState.zoom, selectNode, node.id]);

  // Handle drag move and end with useEffect
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const newX = e.clientX / canvasState.zoom - dragOffset.x;
      const newY = e.clientY / canvasState.zoom - dragOffset.y;

      // Snap to grid (24px)
      const snappedX = Math.round(newX / 24) * 24;
      const snappedY = Math.round(newY / 24) * 24;

      updateNodePosition(node.id, { x: snappedX, y: snappedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, canvasState.zoom, node.id, updateNodePosition]);

  // Handle port interactions
  const handleOutputPortMouseDown = useCallback((e: MouseEvent, portId: string) => {
    e.stopPropagation();
    onStartConnection?.(node.id, portId);
  }, [node.id, onStartConnection]);

  const handleInputPortMouseUp = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    onEndConnection?.(node.id, 'input');
  }, [node.id, onEndConnection]);

  // Get output ports based on node type
  const getOutputPorts = (): OutputPort[] => {
    if (node.type === 'condition') {
      // Use custom outputs from config, or default Yes/No
      const configOutputs = node.config?.outputs as OutputPort[] | undefined;
      return configOutputs && configOutputs.length > 0 ? configOutputs : DEFAULT_CONDITION_OUTPUTS;
    }
    // Non-condition nodes have a single default output
    return [{ id: 'default', label: '', color: category.color }];
  };

  const outputPorts = getOutputPorts();
  const isCondition = node.type === 'condition';

  // Determine node dimensions based on type
  // Conditions wider to fit longer labels like "Free Trial Form Signed"
  const nodeWidth = node.type === 'stage' ? 180 : isCondition ? 200 : 160;
  // Conditions need more height for multiple ports
  const minHeight = isCondition ? 80 + (outputPorts.length * 24) : undefined;

  return (
    <div
      ref={nodeRef}
      className={cn(
        'absolute bg-white rounded-xl border-2 cursor-move group',
        'transition-all duration-200 ease-out',
        isSelected
          ? 'shadow-xl ring-2 ring-blue-400 ring-offset-2 scale-[1.02]'
          : 'shadow-sm hover:shadow-lg hover:-translate-y-0.5',
        isDragging && 'opacity-90 shadow-2xl scale-[1.03]'
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: nodeWidth,
        minHeight,
        borderColor: isSelected ? category.color : '#e2e8f0',
        zIndex: isSelected || isDragging ? 20 : 10,
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {/* Header bar */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ backgroundColor: category.bgColor }}
      >
        <span className="text-base">{node.icon}</span>
        <span
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: category.color }}
        >
          {category.label.replace(/s$/, '')}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p
          className="text-sm font-medium text-gray-900 truncate"
          title={node.label}
        >
          {node.label}
        </p>

        {/* Stage-specific: show entity count */}
        {node.type === 'stage' && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-2xl font-light text-gray-900">
              {node.entityCount || 0}
            </span>
            <span className="text-xs text-gray-500">
              {processConfig.entityNamePlural}
            </span>
          </div>
        )}
      </div>

      {/* Input port (left side) - not for triggers */}
      {node.type !== 'trigger' && (
        <div
          className={cn(
            'connection-port absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-4 h-4 rounded-full bg-white border-2 cursor-pointer',
            'transition-all duration-150 ease-out',
            'opacity-0 group-hover:opacity-100 hover:scale-150',
            (isConnecting || isSelected) && 'opacity-100 scale-125',
            isConnecting && 'ring-2 ring-blue-400 ring-offset-1 animate-pulse'
          )}
          style={{ borderColor: category.color }}
          onMouseUp={handleInputPortMouseUp}
        />
      )}

      {/* Output ports (right side) - not for exits */}
      {node.type !== 'exit' && (
        <>
          {isCondition ? (
            // Multiple ports for condition nodes - always visible for conditions
            <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center gap-3 translate-x-1/2">
              {outputPorts.map((port) => (
                <div
                  key={port.id}
                  title={port.label}
                  className={cn(
                    'connection-port w-4 h-4 rounded-full bg-white border-2 cursor-pointer',
                    'transition-all duration-150 ease-out hover:scale-150',
                    isConnecting && 'opacity-50'
                  )}
                  style={{ borderColor: port.color }}
                  onMouseDown={(e) => handleOutputPortMouseDown(e, port.id)}
                />
              ))}
            </div>
          ) : (
            // Single port for other node types - appears on hover
            <div
              className={cn(
                'connection-port absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
                'w-4 h-4 rounded-full bg-white border-2 cursor-pointer',
                'transition-all duration-150 ease-out',
                'opacity-0 group-hover:opacity-100 hover:scale-150',
                (isConnecting || isSelected) && 'opacity-100',
                isConnecting && 'opacity-50'
              )}
              style={{ borderColor: category.color }}
              onMouseDown={(e) => handleOutputPortMouseDown(e, 'default')}
            />
          )}
        </>
      )}
    </div>
  );
}
