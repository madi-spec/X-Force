'use client';

import { useState, useCallback } from 'react';
import { useWorkflow, PROCESS_TYPE_CONFIG, WorkflowNode } from '@/lib/workflow';
import { X, Play, StepForward, RotateCcw, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowTestModeProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TestEntity {
  name: string;
  leadScore?: number;
  companySize?: number;
  dealValue?: number;
  contractValue?: number;
  healthScore?: number;
  severity?: string;
  customerTier?: string;
}

interface TestStep {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  action: string;
  result?: string;
  timestamp: Date;
}

export function WorkflowTestMode({ isOpen, onClose }: WorkflowTestModeProps) {
  const { processType, nodes, connections } = useWorkflow();
  const config = PROCESS_TYPE_CONFIG[processType];

  const [testEntity, setTestEntity] = useState<TestEntity>({ name: '' });
  const [isRunning, setIsRunning] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [testSteps, setTestSteps] = useState<TestStep[]>([]);
  const [isAutoRun, setIsAutoRun] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const resetTest = useCallback(() => {
    setIsRunning(false);
    setCurrentNodeId(null);
    setTestSteps([]);
    setIsComplete(false);
    setIsAutoRun(false);
  }, []);

  const startTest = useCallback(() => {
    if (!testEntity.name) return;

    // Find the first trigger node
    const triggerNode = nodes.find((n) => n.type === 'trigger');
    if (!triggerNode) {
      alert('No trigger node found in the workflow');
      return;
    }

    setIsRunning(true);
    setCurrentNodeId(triggerNode.id);
    setTestSteps([
      {
        nodeId: triggerNode.id,
        nodeName: triggerNode.label,
        nodeType: 'trigger',
        action: `Test ${config.entityName} "${testEntity.name}" entered workflow`,
        timestamp: new Date(),
      },
    ]);
  }, [testEntity, nodes, config.entityName]);

  const stepForward = useCallback(() => {
    if (!currentNodeId) return;

    const currentNode = nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) return;

    // Find outgoing connection
    const outgoingConnections = connections.filter((c) => c.fromNodeId === currentNodeId);
    if (outgoingConnections.length === 0) {
      // End of workflow
      setIsComplete(true);
      setTestSteps((prev) => [
        ...prev,
        {
          nodeId: currentNodeId,
          nodeName: currentNode.label,
          nodeType: currentNode.type,
          action: 'Workflow completed',
          result: currentNode.type === 'exit' ? `Marked as ${currentNode.label}` : 'No outgoing connections',
          timestamp: new Date(),
        },
      ]);
      return;
    }

    // For conditions, pick first branch (in real implementation, evaluate rules)
    const nextConnection = outgoingConnections[0];
    const nextNode = nodes.find((n) => n.id === nextConnection.toNodeId);

    if (!nextNode) return;

    setCurrentNodeId(nextNode.id);
    setTestSteps((prev) => [
      ...prev,
      {
        nodeId: nextNode.id,
        nodeName: nextNode.label,
        nodeType: nextNode.type,
        action: getActionDescription(nextNode, currentNode),
        result: nextConnection.label || undefined,
        timestamp: new Date(),
      },
    ]);

    // Check if we've reached an exit
    if (nextNode.type === 'exit') {
      setIsComplete(true);
    }
  }, [currentNodeId, nodes, connections]);

  const getActionDescription = (node: WorkflowNode, fromNode: WorkflowNode): string => {
    switch (node.type) {
      case 'stage':
        return `Moved to stage "${node.label}"`;
      case 'condition':
        return `Evaluating condition "${node.label}"`;
      case 'aiAction':
        return `AI Action "${node.label}" would execute`;
      case 'humanAction':
        return `Task "${node.label}" would be created`;
      case 'exit':
        return `Reached exit "${node.label}"`;
      default:
        return `Entered ${node.label}`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-[360px] bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Test Mode</h3>
          <p className="text-xs text-gray-500">Simulate {config.entityName} flow</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!isRunning ? (
          <TestEntityForm
            processType={processType}
            entity={testEntity}
            onEntityChange={setTestEntity}
            onStart={startTest}
          />
        ) : (
          <TestProgress
            steps={testSteps}
            currentNodeId={currentNodeId}
            isComplete={isComplete}
            isAutoRun={isAutoRun}
          />
        )}
      </div>

      {/* Footer */}
      {isRunning && (
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={resetTest}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={isAutoRun}
                onChange={(e) => setIsAutoRun(e.target.checked)}
                className="w-3.5 h-3.5 rounded"
                disabled={isComplete}
              />
              Auto-run
            </label>
            <button
              onClick={stepForward}
              disabled={isComplete}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg',
                isComplete
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              )}
            >
              <StepForward className="w-4 h-4" />
              Step
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TestEntityForm({
  processType,
  entity,
  onEntityChange,
  onStart,
}: {
  processType: string;
  entity: TestEntity;
  onEntityChange: (entity: TestEntity) => void;
  onStart: () => void;
}) {
  const config = PROCESS_TYPE_CONFIG[processType as keyof typeof PROCESS_TYPE_CONFIG];

  return (
    <div className="p-4 space-y-4">
      <h4 className="text-sm font-medium text-gray-700">
        Create Test {config.entityName.charAt(0).toUpperCase() + config.entityName.slice(1)}
      </h4>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {config.entityName.charAt(0).toUpperCase() + config.entityName.slice(1)} Name
        </label>
        <input
          type="text"
          value={entity.name}
          onChange={(e) => onEntityChange({ ...entity, name: e.target.value })}
          placeholder={`e.g., Test ${config.entityName}`}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        />
      </div>

      {processType === 'sales' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Lead Score</label>
            <input
              type="range"
              min={0}
              max={100}
              value={entity.leadScore || 50}
              onChange={(e) => onEntityChange({ ...entity, leadScore: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="text-right text-xs text-gray-500">{entity.leadScore || 50}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Deal Value</label>
            <input
              type="number"
              value={entity.dealValue || ''}
              onChange={(e) => onEntityChange({ ...entity, dealValue: parseInt(e.target.value) || 0 })}
              placeholder="25000"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            />
          </div>
        </>
      )}

      {processType === 'onboarding' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Contract Value</label>
          <input
            type="number"
            value={entity.contractValue || ''}
            onChange={(e) => onEntityChange({ ...entity, contractValue: parseInt(e.target.value) || 0 })}
            placeholder="50000"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
          />
        </div>
      )}

      {processType === 'support' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Severity</label>
            <select
              value={entity.severity || 'P3'}
              onChange={(e) => onEntityChange({ ...entity, severity: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            >
              <option value="P1">P1 - Critical</option>
              <option value="P2">P2 - High</option>
              <option value="P3">P3 - Medium</option>
              <option value="P4">P4 - Low</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Customer Tier</label>
            <select
              value={entity.customerTier || 'Mid-Market'}
              onChange={(e) => onEntityChange({ ...entity, customerTier: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            >
              <option value="Enterprise">Enterprise</option>
              <option value="Mid-Market">Mid-Market</option>
              <option value="SMB">SMB</option>
            </select>
          </div>
        </>
      )}

      {processType === 'engagement' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Health Score</label>
          <input
            type="range"
            min={0}
            max={100}
            value={entity.healthScore || 75}
            onChange={(e) => onEntityChange({ ...entity, healthScore: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="text-right text-xs text-gray-500">{entity.healthScore || 75}</div>
        </div>
      )}

      <button
        onClick={onStart}
        disabled={!entity.name}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium',
          entity.name
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        )}
      >
        <Play className="w-4 h-4" />
        Start Test
      </button>
    </div>
  );
}

function TestProgress({
  steps,
  currentNodeId,
  isComplete,
}: {
  steps: TestStep[];
  currentNodeId: string | null;
  isComplete: boolean;
  isAutoRun: boolean;
}) {
  return (
    <div className="p-4">
      {/* Completion message */}
      {isComplete && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-700 font-medium">Test Complete</span>
        </div>
      )}

      {/* Steps log */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <div
            key={index}
            className={cn(
              'p-3 rounded-lg border',
              step.nodeId === currentNodeId && !isComplete
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-200 bg-gray-50'
            )}
          >
            <div className="flex items-start gap-2">
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-xs mt-0.5',
                  step.nodeId === currentNodeId && !isComplete
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                )}
              >
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{step.action}</p>
                {step.result && (
                  <p className="text-xs text-gray-500 mt-0.5">Result: {step.result}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {step.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Current node indicator */}
      {!isComplete && currentNodeId && (
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          Waiting at current node...
        </div>
      )}
    </div>
  );
}
