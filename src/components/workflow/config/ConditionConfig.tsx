'use client';

import { WorkflowNode } from '@/lib/workflow';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';

interface ConditionConfigProps {
  node: WorkflowNode;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
}

interface Rule {
  id: string;
  field: string;
  operator: string;
  value: string | number | boolean;
}

interface OutputBranch {
  id: string;
  label: string;
  color: string;
}

interface ConditionConfigData {
  logic: 'AND' | 'OR';
  rules: Rule[];
  outputs: OutputBranch[];
}

const defaultConfig: ConditionConfigData = {
  logic: 'AND',
  rules: [],
  outputs: [
    { id: 'yes', label: 'Yes', color: '#10b981' },
    { id: 'no', label: 'No', color: '#ef4444' },
  ],
};

const conditionFields = [
  { id: 'lead_score', label: 'Lead Score', type: 'number' as const },
  { id: 'company_size', label: 'Company Size (employees)', type: 'number' as const },
  { id: 'deal_value', label: 'Deal Value', type: 'currency' as const },
  { id: 'days_in_stage', label: 'Days in Current Stage', type: 'number' as const },
  { id: 'days_since_contact', label: 'Days Since Last Contact', type: 'number' as const },
  { id: 'response_time', label: 'Response Time (hours)', type: 'number' as const },
  { id: 'health_score', label: 'Health Score', type: 'number' as const },
  { id: 'decision_maker', label: 'Is Decision Maker', type: 'boolean' as const },
  { id: 'budget_confirmed', label: 'Budget Confirmed', type: 'boolean' as const },
  { id: 'has_competitor', label: 'Competitor Mentioned', type: 'boolean' as const },
  { id: 'severity', label: 'Ticket Severity', type: 'select' as const, options: ['P1', 'P2', 'P3', 'P4'] },
  { id: 'customer_tier', label: 'Customer Tier', type: 'select' as const, options: ['Enterprise', 'Mid-Market', 'SMB'] },
];

const operatorsByType: Record<string, Array<{ id: string; label: string }>> = {
  number: [
    { id: 'eq', label: '=' },
    { id: 'neq', label: '≠' },
    { id: 'gt', label: '>' },
    { id: 'gte', label: '≥' },
    { id: 'lt', label: '<' },
    { id: 'lte', label: '≤' },
  ],
  currency: [
    { id: 'eq', label: '=' },
    { id: 'neq', label: '≠' },
    { id: 'gt', label: '>' },
    { id: 'gte', label: '≥' },
    { id: 'lt', label: '<' },
    { id: 'lte', label: '≤' },
  ],
  boolean: [
    { id: 'is_true', label: 'is true' },
    { id: 'is_false', label: 'is false' },
  ],
  select: [
    { id: 'is', label: 'is' },
    { id: 'is_not', label: 'is not' },
  ],
};

const colorOptions = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4'];

export function ConditionConfig({ node, onUpdate }: ConditionConfigProps) {
  const config = { ...defaultConfig, ...(node.config as Partial<ConditionConfigData>) };

  const updateConfig = (updates: Partial<ConditionConfigData>) => {
    onUpdate({
      config: { ...config, ...updates },
    });
  };

  const addRule = () => {
    const newRule: Rule = {
      id: `rule_${Date.now()}`,
      field: conditionFields[0].id,
      operator: 'eq',
      value: '',
    };
    updateConfig({ rules: [...config.rules, newRule] });
  };

  const updateRule = (ruleId: string, updates: Partial<Rule>) => {
    updateConfig({
      rules: config.rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)),
    });
  };

  const removeRule = (ruleId: string) => {
    updateConfig({ rules: config.rules.filter((r) => r.id !== ruleId) });
  };

  const addOutput = () => {
    const newOutput: OutputBranch = {
      id: `branch_${Date.now()}`,
      label: `Branch ${config.outputs.length + 1}`,
      color: colorOptions[config.outputs.length % colorOptions.length],
    };
    updateConfig({ outputs: [...config.outputs, newOutput] });
  };

  const updateOutput = (outputId: string, updates: Partial<OutputBranch>) => {
    updateConfig({
      outputs: config.outputs.map((o) => (o.id === outputId ? { ...o, ...updates } : o)),
    });
  };

  const removeOutput = (outputId: string) => {
    if (config.outputs.length <= 2) return; // Minimum 2 outputs
    updateConfig({ outputs: config.outputs.filter((o) => o.id !== outputId) });
  };

  return (
    <div className="space-y-6">
      {/* Logic Toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Match Logic
        </label>
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
          <button
            onClick={() => updateConfig({ logic: 'AND' })}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              config.logic === 'AND'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            AND
          </button>
          <button
            onClick={() => updateConfig({ logic: 'OR' })}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              config.logic === 'OR'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            OR
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {config.logic === 'AND' ? 'All rules must match' : 'Any rule can match'}
        </p>
      </div>

      {/* Rules */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          Rules
        </h4>
        <div className="space-y-2">
          {config.rules.map((rule, index) => {
            const field = conditionFields.find((f) => f.id === rule.field);
            const operators = operatorsByType[field?.type || 'number'] || operatorsByType.number;

            return (
              <div key={rule.id} className="flex items-center gap-2">
                {index > 0 && (
                  <span className="text-xs text-gray-400 w-8 text-center">
                    {config.logic}
                  </span>
                )}
                <select
                  value={rule.field}
                  onChange={(e) => updateRule(rule.id, { field: e.target.value })}
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                >
                  {conditionFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(rule.id, { operator: e.target.value })}
                  className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                >
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.label}
                    </option>
                  ))}
                </select>
                {field?.type === 'boolean' ? null : field?.type === 'select' ? (
                  <select
                    value={rule.value as string}
                    onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    className="w-24 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  >
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    value={rule.value as number}
                    onChange={(e) => updateRule(rule.id, { value: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  />
                )}
                <button
                  onClick={() => removeRule(rule.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={addRule}
          className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Output Branches */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          Output Branches
        </h4>
        <div className="space-y-2">
          {config.outputs.map((output) => (
            <div key={output.id} className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="color"
                  value={output.color}
                  onChange={(e) => updateOutput(output.id, { color: e.target.value })}
                  className="sr-only"
                  id={`color-${output.id}`}
                />
                <label
                  htmlFor={`color-${output.id}`}
                  className="w-6 h-6 rounded-full cursor-pointer border-2 border-white shadow"
                  style={{ backgroundColor: output.color }}
                />
              </div>
              <input
                type="text"
                value={output.label}
                onChange={(e) => updateOutput(output.id, { label: e.target.value })}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                placeholder="Branch label"
              />
              {config.outputs.length > 2 && (
                <button
                  onClick={() => removeOutput(output.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addOutput}
          className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Branch
        </button>
      </div>
    </div>
  );
}
