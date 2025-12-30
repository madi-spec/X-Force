'use client';

import { useState } from 'react';
import { useWorkflow, NODE_CATEGORIES, getNodesForProcessType, NodeType, NodeItem } from '@/lib/workflow';
import { ChevronDown, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomNodeModal, CustomNodeTemplate } from './CustomNodeModal';
import { AIPipelineAssistant } from './AIPipelineAssistant';

interface ToolboxCategoryProps {
  type: NodeType;
  items: NodeItem[];
  isExpanded: boolean;
  onToggle: () => void;
}

function ToolboxCategory({ type, items, isExpanded, onToggle }: ToolboxCategoryProps) {
  const category = NODE_CATEGORIES[type];

  const handleDragStart = (e: React.DragEvent, item: NodeItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type,
      item,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="border-b border-gray-100 last:border-0">
      {/* Category header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
      >
        <span
          className="w-6 h-6 rounded flex items-center justify-center text-sm"
          style={{ backgroundColor: category.bgColor }}
        >
          {category.icon}
        </span>
        <span className="flex-1 text-left text-sm font-medium text-gray-700">
          {category.label}
        </span>
        <span className="text-xs text-gray-400 mr-1">{items.length}</span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Items */}
      {isExpanded && (
        <div className="px-2 pb-2 space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item)}
              className="flex items-center gap-2 px-2 py-1.5 bg-white border border-gray-200 rounded-lg cursor-grab hover:border-gray-300 hover:shadow-sm transition-all active:cursor-grabbing"
            >
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0"
                style={{
                  backgroundColor: item.color ? `${item.color}20` : category.bgColor,
                  color: item.color || category.color,
                }}
              >
                {item.icon}
              </span>
              <span className="flex-1 text-sm text-gray-700 truncate">{item.label}</span>
              {item.isCustom && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-600 rounded flex-shrink-0">
                  Custom
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkflowToolbox() {
  const { processType } = useWorkflow();
  const nodes = getNodesForProcessType(processType);

  // Track expanded categories (all expanded by default)
  const [expanded, setExpanded] = useState<Record<NodeType, boolean>>({
    trigger: true,
    stage: true,
    condition: false,
    aiAction: false,
    humanAction: false,
    exit: false,
  });

  // Custom nodes state
  const [customNodes, setCustomNodes] = useState<CustomNodeTemplate[]>([]);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

  const toggleCategory = (type: NodeType) => {
    setExpanded(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleCreateCustomNode = (template: CustomNodeTemplate) => {
    setCustomNodes(prev => [...prev, template]);
  };

  // Get custom nodes by type
  const getCustomNodesForType = (type: NodeType): NodeItem[] => {
    return customNodes
      .filter(n => n.type === type)
      .map(n => ({
        id: n.id,
        label: n.name,
        icon: n.icon,
        color: n.color,
        isCustom: true,
      }));
  };

  return (
    <div className="w-[260px] bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Workflow Builder</h2>
        <p className="text-xs text-gray-500 mt-0.5">Drag nodes to canvas</p>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        <ToolboxCategory
          type="trigger"
          items={[...nodes.triggers, ...getCustomNodesForType('trigger')]}
          isExpanded={expanded.trigger}
          onToggle={() => toggleCategory('trigger')}
        />
        <ToolboxCategory
          type="stage"
          items={[...nodes.stages, ...getCustomNodesForType('stage')]}
          isExpanded={expanded.stage}
          onToggle={() => toggleCategory('stage')}
        />
        <ToolboxCategory
          type="condition"
          items={[...nodes.conditions, ...getCustomNodesForType('condition')]}
          isExpanded={expanded.condition}
          onToggle={() => toggleCategory('condition')}
        />
        <ToolboxCategory
          type="aiAction"
          items={[...nodes.aiActions, ...getCustomNodesForType('aiAction')]}
          isExpanded={expanded.aiAction}
          onToggle={() => toggleCategory('aiAction')}
        />
        <ToolboxCategory
          type="humanAction"
          items={[...nodes.humanActions, ...getCustomNodesForType('humanAction')]}
          isExpanded={expanded.humanAction}
          onToggle={() => toggleCategory('humanAction')}
        />
        <ToolboxCategory
          type="exit"
          items={[...nodes.exits, ...getCustomNodesForType('exit')]}
          isExpanded={expanded.exit}
          onToggle={() => toggleCategory('exit')}
        />
      </div>

      {/* Bottom section */}
      <div className="border-t border-gray-200 p-3 space-y-3">
        {/* Create Custom button */}
        <button
          onClick={() => setIsCustomModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Custom
        </button>

        {/* AI Pipeline Assistant */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">AI Pipeline Assistant</span>
          </div>
          <p className="text-xs text-purple-100 mb-2">
            Analyze your transcripts to auto-generate optimal pipeline paths.
          </p>
          <button
            onClick={() => setIsAIAssistantOpen(true)}
            className="w-full py-1.5 text-xs font-medium bg-white/20 rounded text-white hover:bg-white/30 transition-colors"
          >
            Analyze & Suggest
          </button>
        </div>
      </div>

      {/* Custom Node Modal */}
      <CustomNodeModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onCreateNode={handleCreateCustomNode}
        processType={processType}
      />

      {/* AI Pipeline Assistant Modal */}
      <AIPipelineAssistant
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
      />
    </div>
  );
}
