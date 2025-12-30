'use client';

import { WorkflowNode } from '@/lib/workflow';
import { Zap } from 'lucide-react';

interface TriggerConfigProps {
  node: WorkflowNode;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
}

interface TriggerConfigData {
  filterEnabled: boolean;
  filterField?: string;
  filterOperator?: string;
  filterValue?: string;
}

const defaultConfig: TriggerConfigData = {
  filterEnabled: false,
};

export function TriggerConfig({ node, onUpdate }: TriggerConfigProps) {
  const config = { ...defaultConfig, ...(node.config as Partial<TriggerConfigData>) };

  const updateConfig = (updates: Partial<TriggerConfigData>) => {
    onUpdate({
      config: { ...config, ...updates },
    });
  };

  return (
    <div className="space-y-6">
      {/* Trigger Info */}
      <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-medium text-orange-800">Trigger Event</span>
        </div>
        <p className="text-sm text-orange-700">
          This trigger activates when: <strong>{getTriggerDescription(node.itemId)}</strong>
        </p>
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-700">Filter Entities</span>
          <p className="text-xs text-gray-500">Only trigger for entities matching criteria</p>
        </div>
        <button
          type="button"
          onClick={() => updateConfig({ filterEnabled: !config.filterEnabled })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            config.filterEnabled ? 'bg-orange-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
              config.filterEnabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Filter Fields */}
      {config.filterEnabled && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Field</label>
            <select
              value={config.filterField || ''}
              onChange={(e) => updateConfig({ filterField: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            >
              <option value="">Select field...</option>
              <option value="lead_score">Lead Score</option>
              <option value="company_size">Company Size</option>
              <option value="deal_value">Deal Value</option>
              <option value="industry">Industry</option>
              <option value="source">Lead Source</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Operator</label>
            <select
              value={config.filterOperator || ''}
              onChange={(e) => updateConfig({ filterOperator: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            >
              <option value="">Select operator...</option>
              <option value="eq">equals</option>
              <option value="neq">not equals</option>
              <option value="gt">greater than</option>
              <option value="gte">greater than or equal</option>
              <option value="lt">less than</option>
              <option value="lte">less than or equal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Value</label>
            <input
              type="text"
              value={config.filterValue || ''}
              onChange={(e) => updateConfig({ filterValue: e.target.value })}
              placeholder="Enter value..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">
          Triggers start a workflow when a specific event occurs. Use filters to only activate
          for entities that match your criteria.
        </p>
      </div>
    </div>
  );
}

function getTriggerDescription(itemId: string): string {
  const descriptions: Record<string, string> = {
    // Sales triggers
    new_lead: 'A new lead is created',
    form_submit: 'A form is submitted',
    call_complete: 'A call is completed',
    email_replied: 'An email is replied to',
    meeting_complete: 'A meeting is completed',
    trial_started: 'A trial is started',
    // Onboarding triggers
    contract_signed: 'A contract is signed',
    account_created: 'An account is created',
    first_login: 'First login occurs',
    integration_connected: 'An integration is connected',
    milestone_completed: 'A milestone is completed',
    // Support triggers
    ticket_created: 'A ticket is created',
    severity_changed: 'Ticket severity changes',
    sla_warning: 'SLA warning threshold reached',
    sla_breach: 'SLA is breached',
    customer_replied: 'Customer replies',
    escalation_requested: 'Escalation is requested',
    // Engagement triggers
    health_changed: 'Health score changes',
    usage_dropped: 'Usage drops significantly',
    nps_received: 'NPS response received',
    renewal_approaching: 'Renewal date approaching',
    tickets_spike: 'Support tickets spike',
    champion_left: 'Champion leaves company',
    expansion_opportunity: 'Expansion opportunity identified',
  };

  return descriptions[itemId] || 'This event occurs';
}
