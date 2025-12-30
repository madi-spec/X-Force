'use client';

import { WorkflowNode } from '@/lib/workflow';
import { cn } from '@/lib/utils';
import { Sparkles, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface AIActionConfigProps {
  node: WorkflowNode;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
}

interface AIActionConfigData {
  enabled: boolean;
  // Scheduler
  meetingType?: string;
  duration?: number;
  schedulingWindow?: string;
  preferredTimes?: string[];
  // Follow-up
  emailType?: string;
  tone?: string;
  includeOptions?: string[];
  delay?: string;
  // General
  advancedPrompt?: string;
}

const defaultConfig: AIActionConfigData = {
  enabled: true,
};

export function AIActionConfig({ node, onUpdate }: AIActionConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const config = { ...defaultConfig, ...(node.config as Partial<AIActionConfigData>) };
  const itemId = node.itemId;

  const updateConfig = (updates: Partial<AIActionConfigData>) => {
    onUpdate({
      config: { ...config, ...updates },
    });
  };

  return (
    <div className="space-y-6">
      {/* AI Enabled Toggle */}
      <div
        className={cn(
          'p-4 rounded-xl border transition-all',
          config.enabled
            ? 'border-purple-200 bg-purple-50'
            : 'border-gray-200 bg-gray-50'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-900">AI Enabled</span>
          </div>
          <button
            type="button"
            onClick={() => updateConfig({ enabled: !config.enabled })}
            className={cn(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              config.enabled ? 'bg-purple-600' : 'bg-gray-200'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                config.enabled ? 'translate-x-4' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {config.enabled
            ? 'This action runs automatically'
            : 'Creates a task for rep review'}
        </p>
      </div>

      {/* Type-specific fields */}
      {itemId === 'ai_scheduler' && <SchedulerFields config={config} updateConfig={updateConfig} />}
      {itemId === 'ai_followup' && <FollowUpFields config={config} updateConfig={updateConfig} />}
      {itemId === 'ai_analysis' && <AnalysisFields config={config} updateConfig={updateConfig} />}
      {itemId === 'ai_nurture' && <NurtureFields config={config} updateConfig={updateConfig} />}
      {itemId === 'ai_meeting_prep' && <MeetingPrepFields config={config} updateConfig={updateConfig} />}

      {/* Generic config for unknown AI actions */}
      {!['ai_scheduler', 'ai_followup', 'ai_analysis', 'ai_nurture', 'ai_meeting_prep'].includes(itemId) && (
        <GenericAIFields config={config} updateConfig={updateConfig} />
      )}

      {/* Advanced Settings */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform',
              showAdvanced && 'rotate-180'
            )}
          />
          Advanced Settings
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Custom Prompt Override
              </label>
              <textarea
                value={config.advancedPrompt || ''}
                onChange={(e) => updateConfig({ advancedPrompt: e.target.value })}
                placeholder="Override the default AI prompt..."
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SchedulerFields({
  config,
  updateConfig,
}: {
  config: AIActionConfigData;
  updateConfig: (updates: Partial<AIActionConfigData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Meeting Type
        </label>
        <select
          value={config.meetingType || 'discovery'}
          onChange={(e) => updateConfig({ meetingType: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        >
          <option value="discovery">Discovery Call</option>
          <option value="demo">Product Demo</option>
          <option value="followup">Follow-up</option>
          <option value="technical">Technical Discussion</option>
          <option value="executive">Executive Briefing</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Duration
        </label>
        <select
          value={config.duration || 30}
          onChange={(e) => updateConfig({ duration: parseInt(e.target.value) })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        >
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={45}>45 minutes</option>
          <option value={60}>60 minutes</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Scheduling Window
        </label>
        <select
          value={config.schedulingWindow || '14'}
          onChange={(e) => updateConfig({ schedulingWindow: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        >
          <option value="7">Next 7 days</option>
          <option value="14">Next 14 days</option>
          <option value="30">Next 30 days</option>
        </select>
      </div>
    </div>
  );
}

function FollowUpFields({
  config,
  updateConfig,
}: {
  config: AIActionConfigData;
  updateConfig: (updates: Partial<AIActionConfigData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Email Type
        </label>
        <select
          value={config.emailType || 'checkin'}
          onChange={(e) => updateConfig({ emailType: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        >
          <option value="checkin">Check-in</option>
          <option value="value">Value Reminder</option>
          <option value="urgency">Urgency</option>
          <option value="reengagement">Re-engagement</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Tone
        </label>
        <select
          value={config.tone || 'professional'}
          onChange={(e) => updateConfig({ tone: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        >
          <option value="professional">Professional</option>
          <option value="friendly">Friendly</option>
          <option value="direct">Direct</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Delay
        </label>
        <select
          value={config.delay || 'immediate'}
          onChange={(e) => updateConfig({ delay: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        >
          <option value="immediate">Send immediately</option>
          <option value="1day">Wait 1 day</option>
          <option value="3days">Wait 3 days</option>
        </select>
      </div>
    </div>
  );
}

function AnalysisFields({
  config,
  updateConfig,
}: {
  config: AIActionConfigData;
  updateConfig: (updates: Partial<AIActionConfigData>) => void;
}) {
  const analyzeOptions = [
    { id: 'objections', label: 'Objections' },
    { id: 'sentiment', label: 'Sentiment' },
    { id: 'next_steps', label: 'Next steps' },
    { id: 'competitors', label: 'Competitor mentions' },
    { id: 'buying_signals', label: 'Buying signals' },
  ];

  const includeOptions = (config.includeOptions || ['objections', 'sentiment']) as string[];

  const toggleOption = (optionId: string) => {
    if (includeOptions.includes(optionId)) {
      updateConfig({ includeOptions: includeOptions.filter((o) => o !== optionId) });
    } else {
      updateConfig({ includeOptions: [...includeOptions, optionId] });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Analyze For
        </label>
        <div className="space-y-2">
          {analyzeOptions.map((option) => (
            <label key={option.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeOptions.includes(option.id)}
                onChange={() => toggleOption(option.id)}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function NurtureFields({
  config,
  updateConfig,
}: {
  config: AIActionConfigData;
  updateConfig: (updates: Partial<AIActionConfigData>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Sequence Length
        </label>
        <select
          value={config.duration || 4}
          onChange={(e) => updateConfig({ duration: parseInt(e.target.value) })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        >
          <option value={4}>4 emails</option>
          <option value={8}>8 emails</option>
          <option value={12}>12 emails</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Frequency
        </label>
        <select
          value={config.schedulingWindow || 'weekly'}
          onChange={(e) => updateConfig({ schedulingWindow: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Bi-weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
    </div>
  );
}

function MeetingPrepFields({
  config,
  updateConfig,
}: {
  config: AIActionConfigData;
  updateConfig: (updates: Partial<AIActionConfigData>) => void;
}) {
  const includeOptions = [
    { id: 'research', label: 'Company research' },
    { id: 'history', label: 'Contact history' },
    { id: 'talking_points', label: 'Suggested talking points' },
    { id: 'objection_prep', label: 'Objection prep' },
  ];

  const selected = (config.includeOptions || ['research', 'history']) as string[];

  const toggleOption = (optionId: string) => {
    if (selected.includes(optionId)) {
      updateConfig({ includeOptions: selected.filter((o) => o !== optionId) });
    } else {
      updateConfig({ includeOptions: [...selected, optionId] });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Include
        </label>
        <div className="space-y-2">
          {includeOptions.map((option) => (
            <label key={option.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() => toggleOption(option.id)}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function GenericAIFields({
  config,
  updateConfig,
}: {
  config: AIActionConfigData;
  updateConfig: (updates: Partial<AIActionConfigData>) => void;
}) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
      <p className="text-sm text-gray-500 text-center">
        Configure this AI action using the Advanced Settings below.
      </p>
    </div>
  );
}
