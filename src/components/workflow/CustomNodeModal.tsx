'use client';

import { useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Zap, LayoutList, GitBranch, Sparkles, User, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NodeType, NODE_CATEGORIES } from '@/lib/workflow';

interface CustomNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNode: (template: CustomNodeTemplate) => void;
  processType: string;
}

export interface CustomNodeTemplate {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  icon: string;
  color?: string;
  config: Record<string, unknown>;
}

const NODE_TYPE_INFO: Record<NodeType, { icon: React.ReactNode; description: string }> = {
  trigger: {
    icon: <Zap className="w-5 h-5" />,
    description: 'Start a flow when something happens',
  },
  stage: {
    icon: <LayoutList className="w-5 h-5" />,
    description: 'A step where entities wait',
  },
  condition: {
    icon: <GitBranch className="w-5 h-5" />,
    description: 'Route entities based on rules',
  },
  aiAction: {
    icon: <Sparkles className="w-5 h-5" />,
    description: 'Automated AI operation',
  },
  humanAction: {
    icon: <User className="w-5 h-5" />,
    description: 'Task for your team',
  },
  exit: {
    icon: <Flag className="w-5 h-5" />,
    description: 'End state for entities',
  },
};

const EMOJI_OPTIONS = [
  '📋', '📊', '📈', '📉', '💬', '📧', '📞', '🎯',
  '⚡', '🔔', '✅', '❌', '⏰', '📅', '🔒', '🔓',
  '💡', '🎨', '🔧', '⚙️', '📁', '🏷️', '💎', '🚀',
  '🎉', '🏆', '⭐', '🌟', '💪', '🤝', '👋', '👤',
];

export function CustomNodeModal({ isOpen, onClose, onCreateNode, processType }: CustomNodeModalProps) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<NodeType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📋');
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);

  // Reset state when modal opens/closes
  const handleClose = useCallback(() => {
    setStep(1);
    setSelectedType(null);
    setName('');
    setDescription('');
    setSelectedIcon('📋');
    setSelectedColor(undefined);
    onClose();
  }, [onClose]);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleCreate = () => {
    if (!selectedType || !name) return;

    const template: CustomNodeTemplate = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: selectedType,
      name,
      description,
      icon: selectedIcon,
      color: selectedColor,
      config: {},
    };

    onCreateNode(template);
    handleClose();
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return selectedType !== null;
      case 2:
        return name.trim().length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create Custom Node</h2>
            <p className="text-xs text-gray-500">Step {step} of 3</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Choose Type */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                What type of node do you want to create?
              </p>
              {(Object.keys(NODE_TYPE_INFO) as NodeType[]).map((type) => {
                const info = NODE_TYPE_INFO[type];
                const category = NODE_CATEGORIES[type];

                return (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left',
                      selectedType === type
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <span
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: category.bgColor, color: category.color }}
                    >
                      {info.icon}
                    </span>
                    <div>
                      <span className="font-medium text-gray-900">{category.label.replace(/s$/, '')}</span>
                      <p className="text-sm text-gray-500">{info.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Basic Info */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Custom Follow-up"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this node do?"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedIcon(emoji)}
                      className={cn(
                        'w-10 h-10 flex items-center justify-center text-xl rounded-lg border-2 transition-all',
                        selectedIcon === emoji
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && selectedType && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Review your custom node before creating:
              </p>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="w-10 h-10 flex items-center justify-center text-xl rounded-lg"
                    style={{
                      backgroundColor: selectedColor || NODE_CATEGORIES[selectedType].bgColor,
                    }}
                  >
                    {selectedIcon}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{name}</p>
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: NODE_CATEGORIES[selectedType].bgColor,
                        color: NODE_CATEGORIES[selectedType].color,
                      }}
                    >
                      {NODE_CATEGORIES[selectedType].label.replace(/s$/, '')}
                    </span>
                  </div>
                </div>
                {description && (
                  <p className="text-sm text-gray-500">{description}</p>
                )}
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-700">
                  After creation, this node will appear in your toolbox under &quot;{NODE_CATEGORIES[selectedType].label}&quot; with a &quot;Custom&quot; badge.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={step === 1 ? handleClose : handleBack}
            className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={cn(
                'flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                canProceed()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Node
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
