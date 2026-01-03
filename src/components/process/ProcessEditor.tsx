/**
 * @deprecated Use UnifiedProcessEditor instead.
 * This component is kept for backward compatibility during migration.
 *
 * Migration path:
 * - Import UnifiedProcessEditor from '@/components/process/UnifiedProcessEditor'
 * - Pass the appropriate initialProcessType ('sales', 'onboarding', 'support', 'engagement')
 *
 * @see UnifiedProcessEditor
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Plus,
  GripVertical,
  Trash2,
  Save,
  ArrowLeft,
  Package,
  ChevronRight,
  Clock,
  Target,
  Rocket,
  Ticket,
  HeartHandshake,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { ProcessCategory, PROCESS_CATEGORIES } from '@/lib/process';

interface ProcessStage {
  id: string;
  name: string;
  description: string;
  order: number;
  config: Record<string, unknown>;
  isNew?: boolean;
}

interface ProcessEditorProps {
  productSlug: string;
  productName: string;
  productColor: string | null;
  processType: ProcessCategory;
  initialStages: ProcessStage[];
}

const iconMap: Record<string, typeof Target> = {
  Target,
  Rocket,
  Ticket,
  HeartHandshake,
};

// Type-specific stage templates
const stageTemplates: Record<ProcessCategory, { stages: Omit<ProcessStage, 'id'>[] }> = {
  sales: { stages: [] }, // Sales uses ProvenProcessEditor
  onboarding: {
    stages: [
      { name: 'Kickoff', description: 'Initial meeting and goals alignment', order: 1, config: { target_days: 3, required: true } },
      { name: 'Setup', description: 'System configuration and integration', order: 2, config: { target_days: 7, required: true } },
      { name: 'Training', description: 'User training and documentation', order: 3, config: { target_days: 14, required: true } },
      { name: 'Go Live', description: 'Production deployment', order: 4, config: { target_days: 21, required: true } },
      { name: 'Handoff', description: 'Transition to Customer Success', order: 5, config: { target_days: 30, required: false } },
    ],
  },
  support: {
    stages: [
      { name: 'Critical (P1)', description: 'System down, business stopped', order: 1, config: { response_sla_hours: 1, resolution_sla_hours: 4 } },
      { name: 'High (P2)', description: 'Major feature broken, workaround exists', order: 2, config: { response_sla_hours: 4, resolution_sla_hours: 24 } },
      { name: 'Medium (P3)', description: 'Feature issue, low impact', order: 3, config: { response_sla_hours: 8, resolution_sla_hours: 72 } },
      { name: 'Low (P4)', description: 'Question or minor issue', order: 4, config: { response_sla_hours: 24, resolution_sla_hours: 168 } },
    ],
  },
  engagement: {
    stages: [
      { name: 'Champion', description: 'Health 90-100: Expansion ready', order: 1, config: { health_min: 90, health_max: 100, action: 'expansion_focus' } },
      { name: 'Healthy', description: 'Health 70-89: Maintain momentum', order: 2, config: { health_min: 70, health_max: 89, action: 'nurture' } },
      { name: 'Neutral', description: 'Health 50-69: Increase engagement', order: 3, config: { health_min: 50, health_max: 69, action: 'engage' } },
      { name: 'At Risk', description: 'Health 30-49: Intervention needed', order: 4, config: { health_min: 30, health_max: 49, action: 'intervene' } },
      { name: 'Critical', description: 'Health 0-29: Escalation required', order: 5, config: { health_min: 0, health_max: 29, action: 'escalate' } },
    ],
  },
};

// Type-specific field configurations
const fieldConfigs: Record<ProcessCategory, { fields: { key: string; label: string; type: 'number' | 'text' | 'select'; suffix?: string; options?: string[] }[] }> = {
  sales: { fields: [] },
  onboarding: {
    fields: [
      { key: 'target_days', label: 'Target Days', type: 'number', suffix: 'days' },
    ],
  },
  support: {
    fields: [
      { key: 'response_sla_hours', label: 'Response SLA', type: 'number', suffix: 'hours' },
      { key: 'resolution_sla_hours', label: 'Resolution SLA', type: 'number', suffix: 'hours' },
    ],
  },
  engagement: {
    fields: [
      { key: 'health_min', label: 'Health Min', type: 'number' },
      { key: 'health_max', label: 'Health Max', type: 'number' },
      { key: 'action', label: 'Action', type: 'select', options: ['expansion_focus', 'nurture', 'engage', 'intervene', 'escalate'] },
    ],
  },
};

export function ProcessEditor({
  productSlug,
  productName,
  productColor,
  processType,
  initialStages,
}: ProcessEditorProps) {
  const [stages, setStages] = useState<ProcessStage[]>(
    initialStages.length > 0 ? initialStages : []
  );
  const [selectedStage, setSelectedStage] = useState<ProcessStage | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const category = PROCESS_CATEGORIES.find((c) => c.id === processType);
  const Icon = category ? iconMap[category.icon] || Target : Target;
  const fields = fieldConfigs[processType]?.fields || [];
  const templates = stageTemplates[processType]?.stages || [];

  const generateId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleAddStage = () => {
    const newStage: ProcessStage = {
      id: generateId(),
      name: 'New Stage',
      description: '',
      order: stages.length + 1,
      config: {},
      isNew: true,
    };
    setStages([...stages, newStage]);
    setSelectedStage(newStage);
    setHasChanges(true);
  };

  const handleApplyTemplate = () => {
    const newStages = templates.map((template, index) => ({
      ...template,
      id: generateId(),
      isNew: true,
    }));
    setStages(newStages);
    setHasChanges(true);
  };

  const handleUpdateStage = (stageId: string, updates: Partial<ProcessStage>) => {
    setStages(stages.map((s) => (s.id === stageId ? { ...s, ...updates } : s)));
    if (selectedStage?.id === stageId) {
      setSelectedStage({ ...selectedStage, ...updates });
    }
    setHasChanges(true);
  };

  const handleDeleteStage = (stageId: string) => {
    setStages(stages.filter((s) => s.id !== stageId).map((s, i) => ({ ...s, order: i + 1 })));
    if (selectedStage?.id === stageId) {
      setSelectedStage(null);
    }
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/process/${productSlug}/${processType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages }),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      // Update IDs from response
      const { stages: savedStages } = await response.json();
      setStages(savedStages);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving process:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Left: Stage List */}
      <div className="w-80 border-r border-gray-200 bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <Link
            href={`/process/${productSlug}`}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: productColor || '#6B7280' }}
            >
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-medium text-gray-900">{category?.label}</h1>
              <p className="text-xs text-gray-500">{productName}</p>
            </div>
          </div>
        </div>

        {/* Stage List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {stages.length === 0 ? (
            <div className="text-center py-8">
              <Icon className={cn('h-8 w-8 mx-auto mb-2', category?.color || 'text-gray-400')} />
              <p className="text-sm text-gray-500 mb-4">No stages configured</p>
              {templates.length > 0 && (
                <button
                  onClick={handleApplyTemplate}
                  className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs rounded-lg hover:bg-blue-100"
                >
                  Apply Template
                </button>
              )}
            </div>
          ) : (
            stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setSelectedStage(stage)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                  selectedStage?.id === stage.id
                    ? 'bg-white border-2 border-blue-500 shadow-sm'
                    : 'bg-white border border-gray-200 hover:border-gray-300'
                )}
              >
                <GripVertical className="h-4 w-4 text-gray-300" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{stage.name}</p>
                  <p className="text-xs text-gray-500 truncate">{stage.description || 'No description'}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            ))
          )}
        </div>

        {/* Add Button */}
        <div className="p-3 border-t border-gray-200 bg-white">
          <button
            onClick={handleAddStage}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Add Stage
          </button>
        </div>
      </div>

      {/* Right: Stage Details */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedStage ? (
          <>
            {/* Detail Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-medium text-gray-900">Stage Details</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeleteStage(selectedStage.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSelectedStage(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Detail Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={selectedStage.name}
                  onChange={(e) => handleUpdateStage(selectedStage.id, { name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={selectedStage.description}
                  onChange={(e) => handleUpdateStage(selectedStage.id, { description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Type-specific fields */}
              {fields.length > 0 && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.label}
                        </label>
                        {field.type === 'select' ? (
                          <select
                            value={(selectedStage.config[field.key] as string) || ''}
                            onChange={(e) =>
                              handleUpdateStage(selectedStage.id, {
                                config: { ...selectedStage.config, [field.key]: e.target.value },
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select...</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="relative">
                            <input
                              type={field.type}
                              value={(selectedStage.config[field.key] as number | string) || ''}
                              onChange={(e) =>
                                handleUpdateStage(selectedStage.id, {
                                  config: {
                                    ...selectedStage.config,
                                    [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            {field.suffix && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                {field.suffix}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Icon className={cn('h-12 w-12 mx-auto mb-3', category?.color || 'text-gray-300')} />
              <p className="text-gray-500">Select a stage to edit</p>
              <p className="text-sm text-gray-400 mt-1">or add a new one</p>
            </div>
          </div>
        )}

        {/* Save Bar */}
        {hasChanges && (
          <div className="p-4 border-t border-gray-200 bg-amber-50 flex items-center justify-between">
            <p className="text-sm text-amber-700">You have unsaved changes</p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
