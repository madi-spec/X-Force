'use client';

import { useWorkflow, NODE_CATEGORIES, WorkflowNode } from '@/lib/workflow';
import { X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  StageConfig,
  ConditionConfig,
  AIActionConfig,
  HumanActionConfig,
  ExitConfig,
  TriggerConfig,
} from './config';

export function WorkflowConfigPanel() {
  const { selectedNode, selectNode, removeNode, updateNode } = useWorkflow();

  if (!selectedNode) return null;

  const category = NODE_CATEGORIES[selectedNode.type];

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this node?')) {
      removeNode(selectedNode.id);
    }
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNode(selectedNode.id, { label: e.target.value });
  };

  const handleNodeUpdate = (updates: Partial<WorkflowNode>) => {
    updateNode(selectedNode.id, updates);
  };

  const renderTypeConfig = () => {
    switch (selectedNode.type) {
      case 'trigger':
        return <TriggerConfig node={selectedNode} onUpdate={handleNodeUpdate} />;
      case 'stage':
        return <StageConfig node={selectedNode} onUpdate={handleNodeUpdate} />;
      case 'condition':
        return <ConditionConfig node={selectedNode} onUpdate={handleNodeUpdate} />;
      case 'aiAction':
        return <AIActionConfig node={selectedNode} onUpdate={handleNodeUpdate} />;
      case 'humanAction':
        return <HumanActionConfig node={selectedNode} onUpdate={handleNodeUpdate} />;
      case 'exit':
        return <ExitConfig node={selectedNode} onUpdate={handleNodeUpdate} />;
      default:
        return (
          <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              No configuration available for this node type.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="w-[320px] bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            style={{ backgroundColor: category.bgColor }}
          >
            {selectedNode.icon}
          </span>
          <div>
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: category.bgColor,
                color: category.color,
              }}
            >
              {category.label.replace(/s$/, '')}
            </span>
          </div>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Node name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={selectedNode.label}
            onChange={handleLabelChange}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Type-specific configuration */}
        {renderTypeConfig()}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
        <button
          onClick={() => selectNode(null)}
          className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
