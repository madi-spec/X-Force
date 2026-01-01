'use client';

import { useState } from 'react';
import { WorkflowNode } from '@/lib/workflow';
import { cn } from '@/lib/utils';
import { Sparkles, Clock, AlertTriangle, Flag } from 'lucide-react';
import { GenerateStageContent } from '../GenerateStageContent';
import { PitchPointsEditor, PitchPoint } from './PitchPointsEditor';
import { ObjectionHandlersEditor, ObjectionHandler } from './ObjectionHandlersEditor';
import { ResourcesEditor, Resource } from './ResourcesEditor';

interface StageConfigProps {
  node: WorkflowNode;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
}

interface StageConfigData {
  goal: string;
  exitCriteria: string;
  slaDays: number | null;
  slaWarningDays: number | null;
  isTerminal: boolean;
  terminalType: 'won' | 'lost' | 'completed' | 'churned' | 'cancelled' | null;
  aiAutomation: {
    enabled: boolean;
    followUpDays: number;
    autoAnalyzeCalls: boolean;
  };
  pitchPoints: PitchPoint[];
  objectionHandlers: ObjectionHandler[];
  resources: Resource[];
}

const defaultConfig: StageConfigData = {
  goal: '',
  exitCriteria: '',
  slaDays: null,
  slaWarningDays: null,
  isTerminal: false,
  terminalType: null,
  aiAutomation: {
    enabled: false,
    followUpDays: 3,
    autoAnalyzeCalls: true,
  },
  pitchPoints: [],
  objectionHandlers: [],
  resources: [],
};

const TERMINAL_TYPES = [
  { value: 'won', label: 'Won', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'completed', label: 'Completed', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'churned', label: 'Churned', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-700 border-gray-200' },
] as const;

export function StageConfig({ node, onUpdate }: StageConfigProps) {
  const config = { ...defaultConfig, ...(node.config as Partial<StageConfigData>) };
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'basics' | 'content' | 'automation'>('basics');

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
      pitchPoints: [
        ...config.pitchPoints,
        ...(content.pitchPoints?.map(pp => ({ ...pp, source: 'ai_generated' as const })) || []),
      ],
      objectionHandlers: [
        ...config.objectionHandlers,
        ...(content.objectionHandlers?.map(oh => ({ ...oh, source: 'ai_generated' as const })) || []),
      ],
      resources: [
        ...config.resources,
        ...(content.resources?.map(r => ({ ...r, type: r.type as Resource['type'] })) || []),
      ],
    });
  };

  return (
    <div className="space-y-4">
      {/* Section Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
        {[
          { id: 'basics', label: 'Basics' },
          { id: 'content', label: 'Content' },
          { id: 'automation', label: 'Automation' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as typeof activeSection)}
            className={cn(
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              activeSection === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Basics Section */}
      {activeSection === 'basics' && (
        <div className="space-y-4">
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

          {/* SLA Settings */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-900">SLA Settings</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Target Days
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={config.slaDays ?? ''}
                  onChange={(e) => updateConfig({ slaDays: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="e.g., 7"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Warning Days
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={config.slaWarningDays ?? ''}
                  onChange={(e) => updateConfig({ slaWarningDays: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="e.g., 5"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                />
              </div>
            </div>

            {config.slaDays && config.slaWarningDays && config.slaWarningDays >= config.slaDays && (
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />
                Warning days should be less than target days
              </div>
            )}
          </div>

          {/* Terminal Stage */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">Terminal Stage</span>
              </div>
              <button
                type="button"
                onClick={() => updateConfig({ isTerminal: !config.isTerminal, terminalType: config.isTerminal ? null : 'completed' })}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                  config.isTerminal ? 'bg-blue-600' : 'bg-gray-200'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                    config.isTerminal ? 'translate-x-4' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Mark this as an ending stage (e.g., Closed Won, Churned)
            </p>

            {config.isTerminal && (
              <div className="pt-2 border-t border-gray-200">
                <label className="block text-xs text-gray-500 mb-2">Outcome Type</label>
                <div className="flex flex-wrap gap-2">
                  {TERMINAL_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => updateConfig({ terminalType: type.value })}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                        config.terminalType === type.value
                          ? type.color
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Section */}
      {activeSection === 'content' && (
        <div className="space-y-6">
          {/* Generate from Transcripts */}
          <button
            onClick={() => setIsGenerateModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:from-purple-700 hover:to-indigo-700 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Generate from Transcripts
          </button>

          {/* Pitch Points */}
          <PitchPointsEditor
            pitchPoints={config.pitchPoints}
            onChange={(pitchPoints) => updateConfig({ pitchPoints })}
            onGenerateClick={() => setIsGenerateModalOpen(true)}
          />

          {/* Objection Handlers */}
          <ObjectionHandlersEditor
            objectionHandlers={config.objectionHandlers}
            onChange={(objectionHandlers) => updateConfig({ objectionHandlers })}
            onGenerateClick={() => setIsGenerateModalOpen(true)}
          />

          {/* Resources */}
          <ResourcesEditor
            resources={config.resources}
            onChange={(resources) => updateConfig({ resources })}
          />
        </div>
      )}

      {/* Automation Section */}
      {activeSection === 'automation' && (
        <div className="space-y-4">
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

          {/* Coming Soon: More Automation Options */}
          <div className="p-4 rounded-xl border border-dashed border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500 text-center">
              More automation options coming soon...
            </p>
          </div>
        </div>
      )}

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
