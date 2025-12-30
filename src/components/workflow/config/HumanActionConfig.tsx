'use client';

import { WorkflowNode } from '@/lib/workflow';
import { cn } from '@/lib/utils';

interface HumanActionConfigProps {
  node: WorkflowNode;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
}

interface HumanActionConfigData {
  taskType: string;
  assignTo: string;
  specificUser?: string;
  dueInValue: number;
  dueInUnit: string;
  priority: string;
  description: string;
  notifyVia: string[];
  escalateIn?: number;
}

const defaultConfig: HumanActionConfigData = {
  taskType: 'call',
  assignTo: 'deal_owner',
  dueInValue: 2,
  dueInUnit: 'days',
  priority: 'medium',
  description: '',
  notifyVia: ['email', 'inapp'],
};

export function HumanActionConfig({ node, onUpdate }: HumanActionConfigProps) {
  const config = { ...defaultConfig, ...(node.config as Partial<HumanActionConfigData>) };

  const updateConfig = (updates: Partial<HumanActionConfigData>) => {
    onUpdate({
      config: { ...config, ...updates },
    });
  };

  const toggleNotification = (via: string) => {
    if (config.notifyVia.includes(via)) {
      updateConfig({ notifyVia: config.notifyVia.filter((n) => n !== via) });
    } else {
      updateConfig({ notifyVia: [...config.notifyVia, via] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Task Type */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Task Type
        </label>
        <select
          value={config.taskType}
          onChange={(e) => updateConfig({ taskType: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        >
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
          <option value="review">Review</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Assignment */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Assign To
        </label>
        <select
          value={config.assignTo}
          onChange={(e) => updateConfig({ assignTo: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
        >
          <option value="deal_owner">Deal Owner</option>
          <option value="specific_user">Specific User</option>
          <option value="role_sales">Sales Rep</option>
          <option value="role_manager">Manager</option>
          <option value="role_se">Solutions Engineer</option>
          <option value="round_robin">Round Robin</option>
        </select>
      </div>

      {/* Due In */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Due In
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={config.dueInValue}
            onChange={(e) => updateConfig({ dueInValue: parseInt(e.target.value) || 1 })}
            className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
          />
          <select
            value={config.dueInUnit}
            onChange={(e) => updateConfig({ dueInUnit: e.target.value })}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
          >
            <option value="hours">hours</option>
            <option value="days">days</option>
            <option value="weeks">weeks</option>
          </select>
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Priority
        </label>
        <div className="flex gap-2">
          {['low', 'medium', 'high', 'urgent'].map((priority) => (
            <button
              key={priority}
              onClick={() => updateConfig({ priority })}
              className={cn(
                'flex-1 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors capitalize',
                config.priority === priority
                  ? priority === 'urgent'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : priority === 'high'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : priority === 'medium'
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                    : 'border-gray-400 bg-gray-50 text-gray-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              )}
            >
              {priority}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Description Template
        </label>
        <textarea
          value={config.description}
          onChange={(e) => updateConfig({ description: e.target.value })}
          placeholder="Use variables like {{contact.name}}, {{deal.name}}..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
        />
      </div>

      {/* Notifications */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Notify Via
        </label>
        <div className="flex gap-4">
          {[
            { id: 'email', label: 'Email' },
            { id: 'inapp', label: 'In-app' },
            { id: 'slack', label: 'Slack' },
          ].map((option) => (
            <label key={option.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.notifyVia.includes(option.id)}
                onChange={() => toggleNotification(option.id)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Escalation */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Escalate if not completed in
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={config.escalateIn || ''}
            onChange={(e) =>
              updateConfig({ escalateIn: e.target.value ? parseInt(e.target.value) : undefined })
            }
            placeholder="Never"
            className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
          />
          <span className="flex items-center text-sm text-gray-500">days (leave empty for never)</span>
        </div>
      </div>
    </div>
  );
}
