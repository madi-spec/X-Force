'use client';

import { WorkflowNode } from '@/lib/workflow';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';

interface ExitConfigProps {
  node: WorkflowNode;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
}

interface ExitConfigData {
  exitType: string;
  // Won
  celebrationNotification?: boolean;
  autoCreateOnboarding?: boolean;
  crmStatus?: string;
  // Lost
  requireLossReason?: boolean;
  lossReasons?: string[];
  winBackAfter?: string;
  // Disqualified
  requireDisqualifyReason?: boolean;
  disqualifyReasons?: string[];
  allowRequalification?: boolean;
  // Nurture
  nurtureSequence?: string;
  reEntryPoint?: string;
  reEntryTrigger?: string;
  // Custom
  customColor?: string;
}

const defaultConfig: ExitConfigData = {
  exitType: 'won',
  celebrationNotification: true,
  autoCreateOnboarding: true,
  requireLossReason: true,
  lossReasons: ['Price', 'Timing', 'Competitor', 'No Decision', 'Not a Fit', 'Other'],
  winBackAfter: 'never',
  requireDisqualifyReason: true,
  disqualifyReasons: ['No Budget', 'Wrong Industry', 'No Authority', 'Already Customer', 'Spam'],
  allowRequalification: true,
  reEntryTrigger: 'reply',
};

export function ExitConfig({ node, onUpdate }: ExitConfigProps) {
  const itemId = node.itemId;
  const config = { ...defaultConfig, ...(node.config as Partial<ExitConfigData>) };

  // Determine exit type from itemId
  const exitType = itemId.includes('won') ? 'won'
    : itemId.includes('lost') ? 'lost'
    : itemId.includes('disqualified') ? 'disqualified'
    : itemId.includes('nurture') ? 'nurture'
    : itemId.includes('churned') ? 'churned'
    : 'custom';

  const updateConfig = (updates: Partial<ExitConfigData>) => {
    onUpdate({
      config: { ...config, ...updates },
    });
  };

  return (
    <div className="space-y-6">
      {/* Won Configuration */}
      {exitType === 'won' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Celebration Notification</span>
              <p className="text-xs text-gray-500">Notify team when a deal is won</p>
            </div>
            <Toggle
              checked={config.celebrationNotification || false}
              onChange={(checked) => updateConfig({ celebrationNotification: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Auto-create Onboarding</span>
              <p className="text-xs text-gray-500">Start onboarding process automatically</p>
            </div>
            <Toggle
              checked={config.autoCreateOnboarding || false}
              onChange={(checked) => updateConfig({ autoCreateOnboarding: checked })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Update CRM Status To
            </label>
            <select
              value={config.crmStatus || 'closed_won'}
              onChange={(e) => updateConfig({ crmStatus: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            >
              <option value="closed_won">Closed Won</option>
              <option value="customer">Customer</option>
              <option value="active">Active</option>
            </select>
          </div>
        </>
      )}

      {/* Lost Configuration */}
      {exitType === 'lost' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Require Loss Reason</span>
              <p className="text-xs text-gray-500">Rep must select why deal was lost</p>
            </div>
            <Toggle
              checked={config.requireLossReason || false}
              onChange={(checked) => updateConfig({ requireLossReason: checked })}
            />
          </div>

          {config.requireLossReason && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Loss Reasons
              </label>
              <div className="space-y-2">
                {(config.lossReasons || []).map((reason, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => {
                        const newReasons = [...(config.lossReasons || [])];
                        newReasons[index] = e.target.value;
                        updateConfig({ lossReasons: newReasons });
                      }}
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                    />
                    <button
                      onClick={() => {
                        updateConfig({
                          lossReasons: config.lossReasons?.filter((_, i) => i !== index),
                        });
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    updateConfig({ lossReasons: [...(config.lossReasons || []), ''] })
                  }
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Reason
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Send to Win-Back Campaign After
            </label>
            <select
              value={config.winBackAfter || 'never'}
              onChange={(e) => updateConfig({ winBackAfter: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            >
              <option value="never">Never</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
        </>
      )}

      {/* Disqualified Configuration */}
      {exitType === 'disqualified' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Require Reason</span>
              <p className="text-xs text-gray-500">Rep must select disqualification reason</p>
            </div>
            <Toggle
              checked={config.requireDisqualifyReason || false}
              onChange={(checked) => updateConfig({ requireDisqualifyReason: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Allow Re-qualification</span>
              <p className="text-xs text-gray-500">Disqualified leads can be re-opened</p>
            </div>
            <Toggle
              checked={config.allowRequalification || false}
              onChange={(checked) => updateConfig({ allowRequalification: checked })}
            />
          </div>
        </>
      )}

      {/* Nurture Configuration */}
      {exitType === 'nurture' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Nurture Sequence
            </label>
            <select
              value={config.nurtureSequence || 'default'}
              onChange={(e) => updateConfig({ nurtureSequence: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            >
              <option value="default">Default Nurture</option>
              <option value="educational">Educational Series</option>
              <option value="product_updates">Product Updates</option>
              <option value="custom">Custom Sequence</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Re-entry Trigger
            </label>
            <select
              value={config.reEntryTrigger || 'reply'}
              onChange={(e) => updateConfig({ reEntryTrigger: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            >
              <option value="reply">Reply received</option>
              <option value="meeting">Meeting scheduled</option>
              <option value="score">Score increase</option>
            </select>
          </div>
        </>
      )}

      {/* Churned Configuration */}
      {exitType === 'churned' && (
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-700">
            Entities that reach this exit are marked as churned. Consider adding win-back campaigns.
          </p>
        </div>
      )}

      {/* Custom Exit */}
      {exitType === 'custom' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
            Exit Color
          </label>
          <div className="flex gap-2">
            {['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4'].map((color) => (
              <button
                key={color}
                onClick={() => updateConfig({ customColor: color })}
                className={cn(
                  'w-8 h-8 rounded-full border-2 transition-transform',
                  config.customColor === color
                    ? 'border-gray-800 scale-110'
                    : 'border-transparent hover:scale-105'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
        checked ? 'bg-blue-600' : 'bg-gray-200'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
          checked ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}
