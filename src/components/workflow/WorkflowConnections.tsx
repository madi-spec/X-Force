'use client';

import { useMemo } from 'react';
import { useWorkflow, WorkflowConnection, WorkflowNode } from '@/lib/workflow';
import { cn } from '@/lib/utils';

interface ConnectionLineProps {
  connection: WorkflowConnection;
  fromNode: WorkflowNode;
  toNode: WorkflowNode;
  isSelected: boolean;
  isTestMode?: boolean;
  onSelect: () => void;
}

// Default condition outputs for port position calculation
const DEFAULT_CONDITION_OUTPUTS = [
  { id: 'yes', label: 'Yes', color: '#10b981' },
  { id: 'no', label: 'No', color: '#ef4444' },
];

function ConnectionLine({ connection, fromNode, toNode, isSelected, isTestMode, onSelect }: ConnectionLineProps) {
  // Calculate connection points
  // Node widths: stage=180, condition=200, others=160
  const nodeWidth = fromNode.type === 'stage' ? 180 : fromNode.type === 'condition' ? 200 : 160;
  const fromX = fromNode.position.x + nodeWidth; // Right side of node

  // Calculate Y position based on port for condition nodes
  let fromY: number;
  if (fromNode.type === 'condition') {
    const outputs = (fromNode.config?.outputs as Array<{ id: string }>) || DEFAULT_CONDITION_OUTPUTS;
    const portIndex = outputs.findIndex(p => p.id === connection.fromPort);
    const effectiveIndex = portIndex >= 0 ? portIndex : 0;
    // Condition nodes have ports spaced vertically
    const nodeHeight = 80 + (outputs.length * 24);
    const portSpacing = 24 + 12; // gap-3 = 12px + port height ~24px
    const startY = (nodeHeight - (outputs.length - 1) * portSpacing) / 2;
    fromY = fromNode.position.y + startY + (effectiveIndex * portSpacing);
  } else {
    fromY = fromNode.position.y + 40; // Middle height for regular nodes
  }

  const toX = toNode.position.x; // Left side of node
  const toY = toNode.position.y + 40; // Middle height

  // Calculate bezier path with proper horizontal exit/entry
  const dx = toX - fromX;
  const dy = Math.abs(toY - fromY);

  let path: string;

  if (dx >= 0) {
    // Normal left-to-right flow
    // Dynamic offset: minimum 50px, scales with distance, max 150px
    const controlOffset = Math.max(50, Math.min(150, Math.abs(dx) * 0.4));
    path = `M ${fromX} ${fromY} C ${fromX + controlOffset} ${fromY}, ${toX - controlOffset} ${toY}, ${toX} ${toY}`;
  } else {
    // Backwards connection (toX < fromX) - need to route around
    const loopOffset = Math.max(80, dy * 0.3);
    const verticalOffset = toY > fromY ? 50 : -50;

    // Use an S-curve that goes right first, then loops back
    path = `M ${fromX} ${fromY}
            C ${fromX + loopOffset} ${fromY},
              ${fromX + loopOffset} ${fromY + verticalOffset},
              ${(fromX + toX) / 2} ${(fromY + toY) / 2}
            S ${toX - loopOffset} ${toY},
              ${toX} ${toY}`;
  }

  // Midpoint for label
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;

  // Determine stroke color - use port color for conditions
  let strokeColor = connection.color || (isSelected ? '#3b82f6' : '#94a3b8');
  if (fromNode.type === 'condition' && !connection.color) {
    const outputs = (fromNode.config?.outputs as Array<{ id: string; color: string }>) || DEFAULT_CONDITION_OUTPUTS;
    const port = outputs.find(p => p.id === connection.fromPort);
    if (port) {
      strokeColor = isSelected ? '#3b82f6' : port.color;
    }
  }
  const strokeWidth = isSelected ? 3 : 2;

  return (
    <g className="cursor-pointer group" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Invisible wider path for easier clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
      />

      {/* Visible path */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={isTestMode ? '8 4' : (connection.style === 'dashed' ? '8 4' : undefined)}
        className={cn(
          'transition-all duration-150 group-hover:stroke-blue-400',
          isTestMode && 'animate-dash'
        )}
        style={isTestMode ? { animation: 'dash 0.5s linear infinite' } : undefined}
      />

      {/* Label */}
      {connection.label && (
        <g transform={`translate(${midX}, ${midY})`}>
          <rect
            x={-30}
            y={-10}
            width={60}
            height={20}
            rx={4}
            fill="white"
            stroke={strokeColor}
            strokeWidth={1}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs fill-gray-600"
          >
            {connection.label}
          </text>
        </g>
      )}
    </g>
  );
}

interface DraggingConnectionProps {
  fromNode: WorkflowNode;
  fromPort: string;
  mousePosition: { x: number; y: number };
}

export function DraggingConnection({ fromNode, fromPort, mousePosition }: DraggingConnectionProps) {
  // Node widths: stage=180, condition=200, others=160
  const nodeWidth = fromNode.type === 'stage' ? 180 : fromNode.type === 'condition' ? 200 : 160;
  const fromX = fromNode.position.x + nodeWidth;

  // Calculate Y position based on port for condition nodes
  let fromY: number;
  let strokeColor = '#94a3b8';

  if (fromNode.type === 'condition') {
    const outputs = (fromNode.config?.outputs as Array<{ id: string; color: string }>) || DEFAULT_CONDITION_OUTPUTS;
    const portIndex = outputs.findIndex(p => p.id === fromPort);
    const effectiveIndex = portIndex >= 0 ? portIndex : 0;
    const port = outputs[effectiveIndex];
    strokeColor = port?.color || strokeColor;

    const nodeHeight = 80 + (outputs.length * 24);
    const portSpacing = 24 + 12;
    const startY = (nodeHeight - (outputs.length - 1) * portSpacing) / 2;
    fromY = fromNode.position.y + startY + (effectiveIndex * portSpacing);
  } else {
    fromY = fromNode.position.y + 40;
  }

  const toX = mousePosition.x;
  const toY = mousePosition.y;

  // Calculate bezier path with proper horizontal exit
  const dx = toX - fromX;
  const dy = Math.abs(toY - fromY);

  let path: string;

  if (dx >= 0) {
    // Normal left-to-right flow
    const controlOffset = Math.max(50, Math.min(150, Math.abs(dx) * 0.4));
    path = `M ${fromX} ${fromY} C ${fromX + controlOffset} ${fromY}, ${toX - controlOffset} ${toY}, ${toX} ${toY}`;
  } else {
    // Backwards - route around
    const loopOffset = Math.max(80, dy * 0.3);
    const verticalOffset = toY > fromY ? 50 : -50;

    path = `M ${fromX} ${fromY}
            C ${fromX + loopOffset} ${fromY},
              ${fromX + loopOffset} ${fromY + verticalOffset},
              ${(fromX + toX) / 2} ${(fromY + toY) / 2}
            S ${toX - loopOffset} ${toY},
              ${toX} ${toY}`;
  }

  return (
    <path
      d={path}
      fill="none"
      stroke={strokeColor}
      strokeWidth={2}
      strokeDasharray="8 4"
      className="pointer-events-none"
    />
  );
}

interface WorkflowConnectionsProps {
  isTestMode?: boolean;
}

export function WorkflowConnections({ isTestMode }: WorkflowConnectionsProps) {
  const {
    nodes,
    connections,
    canvasState,
    selectConnection,
  } = useWorkflow();

  // Create a map of nodes for quick lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, WorkflowNode>();
    nodes.forEach(node => map.set(node.id, node));
    return map;
  }, [nodes]);

  // Filter valid connections (both nodes exist)
  const validConnections = useMemo(() => {
    return connections.filter(conn => {
      return nodeMap.has(conn.fromNodeId) && nodeMap.has(conn.toNodeId);
    });
  }, [connections, nodeMap]);

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Connection lines */}
      <g className="pointer-events-auto">
        {validConnections.map(conn => {
          const fromNode = nodeMap.get(conn.fromNodeId)!;
          const toNode = nodeMap.get(conn.toNodeId)!;
          const isSelected = canvasState.selectedConnectionId === conn.id;

          return (
            <ConnectionLine
              key={conn.id}
              connection={conn}
              fromNode={fromNode}
              toNode={toNode}
              isSelected={isSelected}
              isTestMode={isTestMode}
              onSelect={() => selectConnection(conn.id)}
            />
          );
        })}
      </g>
    </svg>
  );
}
