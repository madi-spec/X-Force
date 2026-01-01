'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ProcessType, WorkflowNode, WorkflowConnection, CanvasState, PROCESS_TYPE_CONFIG, ProcessTypeConfig } from './types';

interface PublishResult {
  success: boolean;
  stageCount?: number;
  created?: number;
  updated?: number;
  message?: string;
  error?: string;
  stagesWithCompanies?: Array<{ name: string; count: number }>;
}

interface WorkflowContextType {
  // Process type info
  processType: ProcessType;
  processConfig: ProcessTypeConfig;
  productId: string;
  productSlug: string;

  // Workflow state
  workflowId: string | null;
  workflowName: string;
  workflowStatus: 'draft' | 'active' | 'archived';

  // Nodes and connections
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];

  // Canvas state
  canvasState: CanvasState;

  // Actions
  setWorkflowName: (name: string) => void;
  addNode: (node: WorkflowNode) => void;
  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  removeNode: (nodeId: string) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  addConnection: (connection: WorkflowConnection) => void;
  removeConnection: (connectionId: string) => void;
  selectNode: (nodeId: string | null) => void;
  selectConnection: (connectionId: string | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;

  // Persistence
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  saveWorkflow: () => Promise<void>;

  // Publishing
  isPublishing: boolean;
  lastPublished: Date | null;
  publishWorkflow: () => Promise<PublishResult>;
  canPublish: boolean;

  // Computed
  selectedNode: WorkflowNode | null;
  entityCount: number;
}

const WorkflowContext = createContext<WorkflowContextType | null>(null);

interface WorkflowProviderProps {
  children: ReactNode;
  processType: ProcessType;
  productId: string;
  productSlug: string;
  initialWorkflow?: {
    id: string;
    name: string;
    status: 'draft' | 'active' | 'archived';
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
  };
}

export function WorkflowProvider({ children, processType, productId, productSlug, initialWorkflow }: WorkflowProviderProps) {
  const processConfig = PROCESS_TYPE_CONFIG[processType];

  // Workflow state
  const [workflowId, setWorkflowId] = useState<string | null>(initialWorkflow?.id || null);
  const [workflowName, setWorkflowName] = useState(initialWorkflow?.name || `New ${processConfig.label}`);
  const [workflowStatus, setWorkflowStatus] = useState<'draft' | 'active' | 'archived'>(initialWorkflow?.status || 'draft');

  // Nodes and connections
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialWorkflow?.nodes || []);
  const [connections, setConnections] = useState<WorkflowConnection[]>(initialWorkflow?.connections || []);

  // Canvas state
  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 1,
    pan: { x: 0, y: 0 },
    selectedNodeId: null,
    selectedConnectionId: null,
  });

  // Persistence state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastPublished, setLastPublished] = useState<Date | null>(null);

  // Node actions
  const addNode = useCallback((node: WorkflowNode) => {
    setNodes(prev => [...prev, node]);
    setHasUnsavedChanges(true);
  }, []);

  const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setNodes(prev => prev.map(node =>
      node.id === nodeId ? { ...node, ...updates } : node
    ));
    setHasUnsavedChanges(true);
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(node => node.id !== nodeId));
    // Also remove any connections to/from this node
    setConnections(prev => prev.filter(conn =>
      conn.fromNodeId !== nodeId && conn.toNodeId !== nodeId
    ));
    // Deselect if this was selected
    setCanvasState(prev => ({
      ...prev,
      selectedNodeId: prev.selectedNodeId === nodeId ? null : prev.selectedNodeId,
    }));
    setHasUnsavedChanges(true);
  }, []);

  const updateNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setNodes(prev => prev.map(node =>
      node.id === nodeId ? { ...node, position } : node
    ));
    setHasUnsavedChanges(true);
  }, []);

  // Connection actions
  const addConnection = useCallback((connection: WorkflowConnection) => {
    setConnections(prev => [...prev, connection]);
    setHasUnsavedChanges(true);
  }, []);

  const removeConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
    setCanvasState(prev => ({
      ...prev,
      selectedConnectionId: prev.selectedConnectionId === connectionId ? null : prev.selectedConnectionId,
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Selection actions
  const selectNode = useCallback((nodeId: string | null) => {
    setCanvasState(prev => ({
      ...prev,
      selectedNodeId: nodeId,
      selectedConnectionId: null, // Deselect connection when selecting node
    }));
  }, []);

  const selectConnection = useCallback((connectionId: string | null) => {
    setCanvasState(prev => ({
      ...prev,
      selectedConnectionId: connectionId,
      selectedNodeId: null, // Deselect node when selecting connection
    }));
  }, []);

  // Canvas actions
  const setZoom = useCallback((zoom: number) => {
    setCanvasState(prev => ({ ...prev, zoom: Math.max(0.25, Math.min(3, zoom)) }));
  }, []);

  const setPan = useCallback((pan: { x: number; y: number }) => {
    setCanvasState(prev => ({ ...prev, pan }));
  }, []);

  // Persistence
  const saveWorkflow = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/process/${productSlug}/${processType}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: workflowId,
          name: workflowName,
          nodes,
          connections,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save workflow');
      }

      const data = await response.json();
      if (data.workflow?.id && !workflowId) {
        setWorkflowId(data.workflow.id);
      }

      setHasUnsavedChanges(false);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save workflow:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [productSlug, processType, workflowId, workflowName, nodes, connections]);

  // Publish workflow
  const publishWorkflow = useCallback(async (): Promise<PublishResult> => {
    // First save any unsaved changes
    if (hasUnsavedChanges) {
      await saveWorkflow();
    }

    setIsPublishing(true);
    try {
      const response = await fetch(`/api/process/${productSlug}/${processType}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error,
          stagesWithCompanies: data.stagesWithCompanies,
        };
      }

      setWorkflowStatus('active');
      setLastPublished(new Date());

      return {
        success: true,
        stageCount: data.stageCount,
        created: data.created,
        updated: data.updated,
        message: data.message,
      };
    } catch (error) {
      console.error('Failed to publish workflow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish workflow',
      };
    } finally {
      setIsPublishing(false);
    }
  }, [productSlug, processType, hasUnsavedChanges, saveWorkflow]);

  // Computed: can publish if we have stages and a saved workflow
  const stageCount = nodes.filter(n => n.type === 'stage').length;
  const canPublish = !hasUnsavedChanges && !isSaving && !isPublishing && stageCount > 0 && workflowId !== null;

  // Computed values
  const selectedNode = canvasState.selectedNodeId
    ? nodes.find(n => n.id === canvasState.selectedNodeId) || null
    : null;

  const entityCount = nodes
    .filter(n => n.type === 'stage')
    .reduce((sum, n) => sum + (n.entityCount || 0), 0);

  const value: WorkflowContextType = {
    processType,
    processConfig,
    productId,
    productSlug,
    workflowId,
    workflowName,
    workflowStatus,
    nodes,
    connections,
    canvasState,
    setWorkflowName,
    addNode,
    updateNode,
    removeNode,
    updateNodePosition,
    addConnection,
    removeConnection,
    selectNode,
    selectConnection,
    setZoom,
    setPan,
    hasUnsavedChanges,
    isSaving,
    lastSaved,
    saveWorkflow,
    isPublishing,
    lastPublished,
    publishWorkflow,
    canPublish,
    selectedNode,
    entityCount,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}
