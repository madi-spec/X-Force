'use client';

import { useState } from 'react';
import { WorkflowNode } from '@/lib/workflow';
import { cn } from '@/lib/utils';
import { ChevronRight, Sparkles, MessageSquare, Shield, Paperclip } from 'lucide-react';
import { GenerateStageContent } from '../GenerateStageContent';

interface StageConfigProps {
  node: WorkflowNode;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
}

interface StageConfigData {
  goal: string;
  exitCriteria: string;
  aiAutomation: {
    enabled: boolean;
    followUpDays: number;
    autoAnalyzeCalls: boolean;
  };
  pitchPoints: Array<{ id: string; title: string; content: string }>;
  objectionHandlers: Array<{ id: string; objection: string; response: string }>;
  resources: Array<{ id: string; title: string; url: string; type: string }>;
}

const defaultConfig: StageConfigData = {
  goal: '',
  exitCriteria: '',
  aiAutomation: {
    enabled: false,
    followUpDays: 3,
    autoAnalyzeCalls: true,
  },
  pitchPoints: [],
  objectionHandlers: [],
  resources: [],
};

export function StageConfig({ node, onUpdate }: StageConfigProps) {
  const config = { ...defaultConfig, ...(node.config as Partial<StageConfigData>) };
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

  const updateConfig = (updates: Partial<StageConfigData>) => {
    onUpdate({
      config: { ...config, ...updates },
    });
  };

  const handleAddGeneratedContent = (content: {
    pitchPoints?: Array<{ id: string; title: string; content: string }>;
    objectionHandlers?: Array<{ id: string; objection: string; response: string }>;
    resources?: Array<{ id: string; title: string; url: string; type: string }>;
  }) => {
    updateConfig({
      pitchPoints: [...config.pitchPoints, ...(content.pitchPoints || [])],
      objectionHandlers: [...config.objectionHandlers, ...(content.objectionHandlers || [])],
      resources: [...config.resources, ...(content.resources || [])],
    });
  };

  return (
    <div className="space-y-6">
      {/* Goal */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Stage Goal
        </label>
        <input
          type="text"
          value={config.goal}
          onChange={(e) => updateConfig({ goal: e.target.value })}
          placeholder="e.g., Get their attention and schedule a demo"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Exit Criteria */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Exit Criteria
        </label>
        <input
          type="text"
          value={config.exitCriteria}
          onChange={(e) => updateConfig({ exitCriteria: e.target.value })}
          placeholder="e.g., Demo scheduled or disqualified"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* AI Automation */}
      <div
        className={cn(
          'p-4 rounded-xl border transition-all',
          config.aiAutomation.enabled
            ? 'border-purple-200 bg-purple-50'
            : 'border-gray-200 bg-gray-50'
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-900">AI Automation</span>
          </div>
          <button
            type="button"
            onClick={() =>
              updateConfig({
                aiAutomation: { ...config.aiAutomation, enabled: !config.aiAutomation.enabled },
              })
            }
            className={cn(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              config.aiAutomation.enabled ? 'bg-purple-600' : 'bg-gray-200'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                config.aiAutomation.enabled ? 'translate-x-4' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          AI will automatically send follow-ups and analyze calls for entities in this stage
        </p>

        {config.aiAutomation.enabled && (
          <div className="space-y-3 pt-3 border-t border-purple-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Days before AI follow-up</span>
              <input
                type="number"
                min={1}
                max={30}
                value={config.aiAutomation.followUpDays}
                onChange={(e) =>
                  updateConfig({
                    aiAutomation: {
                      ...config.aiAutomation,
                      followUpDays: parseInt(e.target.value) || 3,
                    },
                  })
                }
                className="w-16 px-2 py-1 text-sm border border-purple-200 rounded-lg text-center"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Auto-analyze calls</span>
              <input
                type="checkbox"
                checked={config.aiAutomation.autoAnalyzeCalls}
                onChange={(e) =>
                  updateConfig({
                    aiAutomation: {
                      ...config.aiAutomation,
                      autoAnalyzeCalls: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Stage Content */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          Stage Content
        </h4>
        <div className="space-y-2">
          <ContentRow
            icon={<MessageSquare className="w-4 h-4" />}
            label="Pitch Points"
            count={config.pitchPoints.length}
          />
          <ContentRow
            icon={<Shield className="w-4 h-4" />}
            label="Objection Handlers"
            count={config.objectionHandlers.length}
          />
          <ContentRow
            icon={<Paperclip className="w-4 h-4" />}
            label="Resources"
            count={config.resources.length}
          />
        </div>
      </div>

      {/* Generate from Transcripts */}
      <button
        onClick={() => setIsGenerateModalOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:from-purple-700 hover:to-indigo-700 transition-all"
      >
        <Sparkles className="w-4 h-4" />
        Generate from Transcripts
      </button>

      {/* Generate Stage Content Modal */}
      <GenerateStageContent
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        stageName={node.label}
        onAddContent={handleAddGeneratedContent}
      />
    </div>
  );
}

function ContentRow({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      onClick={() => {
        // TODO: Open content editor modal
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-gray-400">{icon}</span>
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {count > 0 && (
          <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded">
            {count}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </button>
  );
}
