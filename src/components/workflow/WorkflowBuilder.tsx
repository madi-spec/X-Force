'use client';

import { useCallback, useState, useEffect } from 'react';
import { WorkflowProvider, useWorkflow, ProcessType, NodeType, NodeItem, NODE_CATEGORIES, WorkflowNode, WorkflowConnection } from '@/lib/workflow';
import { WorkflowHeader } from './WorkflowHeader';
import { WorkflowToolbox } from './WorkflowToolbox';
import { WorkflowCanvas } from './WorkflowCanvas';
import { WorkflowConfigPanel } from './WorkflowConfigPanel';
import { WorkflowNodeComponent } from './WorkflowNode';
import { WorkflowConnections, DraggingConnection } from './WorkflowConnections';
import { WorkflowMetricsBar } from './WorkflowMetricsBar';
import { WorkflowTestMode } from './WorkflowTestMode';

interface WorkflowBuilderProps {
  productId: string;
  productName: string;
  productSlug: string;
  processType: ProcessType;
  initialWorkflow?: {
    id: string;
    name: string;
    status: 'draft' | 'active' | 'archived';
    nodes: WorkflowNode[];
    connections: {
      id: string;
      fromNodeId: string;
      fromPort: string;
      toNodeId: string;
      toPort: string;
      label?: string;
      color?: string;
      style: 'solid' | 'dashed';
    }[];
  };
}

function WorkflowBuilderContent({ productName, productSlug }: { productName: string; productSlug: string }) {
  const { nodes, addNode, addConnection, canvasState, selectNode } = useWorkflow();

  // Connection creation state
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; port: string } | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Test mode state
  const [isTestMode, setIsTestMode] = useState(false);

  // Track mouse position when creating connections
  useEffect(() => {
    if (!connectingFrom) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Convert to canvas coordinates
      const canvas = document.querySelector('[data-workflow-canvas]');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - canvasState.pan.x) / canvasState.zoom;
      const y = (e.clientY - rect.top - canvasState.pan.y) / canvasState.zoom;
      setMousePosition({ x, y });
    };

    const handleMouseUp = () => {
      setConnectingFrom(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [connectingFrom, canvasState.pan, canvasState.zoom]);

  // Handle starting a connection from an output port
  const handleStartConnection = useCallback((nodeId: string, port: string) => {
    setConnectingFrom({ nodeId, port });
  }, []);

  // Handle ending a connection on an input port
  const handleEndConnection = useCallback((nodeId: string, port: string) => {
    if (!connectingFrom) return;

    // Can't connect to self
    if (connectingFrom.nodeId === nodeId) {
      setConnectingFrom(null);
      return;
    }

    // Get source and target nodes to validate connection
    const sourceNode = nodes.find(n => n.id === connectingFrom.nodeId);
    const targetNode = nodes.find(n => n.id === nodeId);

    if (!sourceNode || !targetNode) {
      setConnectingFrom(null);
      return;
    }

    // Can't connect from output to output or input to input
    // Output ports can only connect to input ports
    if (targetNode.type === 'trigger') {
      // Triggers don't have input ports
      setConnectingFrom(null);
      return;
    }

    // Create the connection
    const newConnection: WorkflowConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromNodeId: connectingFrom.nodeId,
      fromPort: connectingFrom.port,
      toNodeId: nodeId,
      toPort: port,
      style: 'solid',
    };

    addConnection(newConnection);
    setConnectingFrom(null);
  }, [connectingFrom, nodes, addConnection]);

  // Handle drop from toolbox
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    try {
      const { type, item } = JSON.parse(data) as { type: NodeType; item: NodeItem };
      const category = NODE_CATEGORIES[type];

      // Calculate position relative to canvas
      const canvasRect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - canvasRect.left - canvasState.pan.x) / canvasState.zoom;
      const y = (e.clientY - canvasRect.top - canvasState.pan.y) / canvasState.zoom;

      // Create new node
      const newNode: WorkflowNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        itemId: item.id,
        label: item.label,
        icon: item.icon,
        color: item.color || category.color,
        position: { x, y },
        config: {},
        entityCount: item.companyCount,
      };

      addNode(newNode);
      selectNode(newNode.id);
    } catch (error) {
      console.error('Failed to parse drop data:', error);
    }
  }, [addNode, selectNode, canvasState]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Get the node we're connecting from for the dragging line
  const connectingFromNode = connectingFrom
    ? nodes.find(n => n.id === connectingFrom.nodeId)
    : null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <WorkflowHeader
        productName={productName}
        productSlug={productSlug}
        isTestMode={isTestMode}
        onTestModeToggle={() => setIsTestMode(!isTestMode)}
      />

      <div className="flex-1 flex overflow-hidden">
        <WorkflowToolbox />

        <div
          className="flex-1 flex flex-col relative"
          data-workflow-canvas
        >
          <WorkflowCanvas
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {/* Connection lines layer */}
            <WorkflowConnections isTestMode={isTestMode} />

            {/* Dragging connection preview */}
            {connectingFromNode && connectingFrom && (
              <svg
                className="absolute inset-0 pointer-events-none overflow-visible"
                style={{ width: '100%', height: '100%' }}
              >
                <DraggingConnection
                  fromNode={connectingFromNode}
                  fromPort={connectingFrom.port}
                  mousePosition={mousePosition}
                />
              </svg>
            )}

            {/* Node layer */}
            {nodes.map((node) => (
              <WorkflowNodeComponent
                key={node.id}
                node={node}
                onStartConnection={handleStartConnection}
                onEndConnection={handleEndConnection}
                isConnecting={!!connectingFrom}
              />
            ))}
          </WorkflowCanvas>

          {/* Metrics bar at the bottom */}
          <WorkflowMetricsBar />
        </div>

        {/* Right panel: Config or Test Mode */}
        {isTestMode ? (
          <WorkflowTestMode
            isOpen={isTestMode}
            onClose={() => setIsTestMode(false)}
          />
        ) : (
          <WorkflowConfigPanel />
        )}
      </div>
    </div>
  );
}

export function WorkflowBuilder({ productId, productName, productSlug, processType, initialWorkflow }: WorkflowBuilderProps) {
  return (
    <WorkflowProvider
      processType={processType}
      productId={productId}
      productSlug={productSlug}
      initialWorkflow={initialWorkflow}
    >
      <WorkflowBuilderContent productName={productName} productSlug={productSlug} />
    </WorkflowProvider>
  );
}
