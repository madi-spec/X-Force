'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Target,
  Rocket,
  LifeBuoy,
  HeartHandshake,
  Plus,
  GripVertical,
  Trash2,
  Save,
  ChevronRight,
  Sparkles,
  Workflow,
  FileText,
  MessageSquare,
  Link2,
  AlertCircle,
} from 'lucide-react';

type ProcessType = 'sales' | 'onboarding' | 'support' | 'engagement';

interface Stage {
  id: string;
  name: string;
  slug: string;
  stage_order: number;
  goal: string | null;
  description: string | null;
  exit_criteria: string | null;
  sla_days: number | null;
  sla_warning_days: number | null;
  is_terminal: boolean;
  terminal_type: string | null;
  // Sales-specific
  pitch_points: Array<{ id: string; text: string; source?: string; effectiveness_score?: number }>;
  objection_handlers: Array<{ id: string; objection: string; response: string; source?: string }>;
  resources: Array<{ id: string; title: string; url: string; type: string }>;
  ai_suggested_pitch_points: unknown[];
  ai_suggested_objections: unknown[];
  ai_insights: Record<string, unknown>;
  avg_days_in_stage: number | null;
  conversion_rate: number | null;
  // Onboarding-specific
  target_days?: number | null;
  // Support-specific
  response_sla_hours?: number | null;
  resolution_sla_hours?: number | null;
  // Engagement-specific
  health_min?: number | null;
  health_max?: number | null;
  action?: string | null;
}

interface UnifiedProcessEditorProps {
  product: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    icon?: string | null;
  };
  initialProcessType?: ProcessType;
}

const PROCESS_TABS: { id: ProcessType; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'sales', label: 'Sales', icon: <Target className="w-4 h-4" />, description: 'Lead to close pipeline' },
  { id: 'onboarding', label: 'Onboarding', icon: <Rocket className="w-4 h-4" />, description: 'Activation milestones' },
  { id: 'support', label: 'Support', icon: <LifeBuoy className="w-4 h-4" />, description: 'SLA tiers' },
  { id: 'engagement', label: 'Engagement', icon: <HeartHandshake className="w-4 h-4" />, description: 'Health bands' },
];

const STAGE_TEMPLATES: Record<ProcessType, Partial<Stage>[]> = {
  sales: [
    { name: 'New Lead', slug: 'new-lead', goal: 'Initial qualification' },
    { name: 'Discovery', slug: 'discovery', goal: 'Understand needs and pain points' },
    { name: 'Demo', slug: 'demo', goal: 'Demonstrate product value' },
    { name: 'Proposal', slug: 'proposal', goal: 'Present pricing and terms' },
    { name: 'Negotiation', slug: 'negotiation', goal: 'Handle objections and close' },
  ],
  onboarding: [
    { name: 'Kickoff', slug: 'kickoff', goal: 'Welcome and set expectations' },
    { name: 'Setup', slug: 'setup', goal: 'Technical configuration' },
    { name: 'Training', slug: 'training', goal: 'User enablement' },
    { name: 'Go Live', slug: 'go-live', goal: 'Production deployment' },
    { name: 'Handoff', slug: 'handoff', goal: 'Transition to success' },
  ],
  support: [
    { name: 'Critical (P1)', slug: 'p1-critical', goal: 'System down', response_sla_hours: 1, resolution_sla_hours: 4 },
    { name: 'High (P2)', slug: 'p2-high', goal: 'Major impact', response_sla_hours: 4, resolution_sla_hours: 24 },
    { name: 'Medium (P3)', slug: 'p3-medium', goal: 'Moderate impact', response_sla_hours: 8, resolution_sla_hours: 72 },
    { name: 'Low (P4)', slug: 'p4-low', goal: 'Minor issue', response_sla_hours: 24, resolution_sla_hours: 168 },
  ],
  engagement: [
    { name: 'Champion', slug: 'champion', health_min: 85, health_max: 100, action: 'expansion_focus' },
    { name: 'Healthy', slug: 'healthy', health_min: 70, health_max: 84, action: 'nurture' },
    { name: 'Neutral', slug: 'neutral', health_min: 50, health_max: 69, action: 'engage' },
    { name: 'At Risk', slug: 'at-risk', health_min: 30, health_max: 49, action: 'intervene' },
    { name: 'Critical', slug: 'critical', health_min: 0, health_max: 29, action: 'escalate' },
  ],
};

function generateId() {
  return crypto.randomUUID();
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function UnifiedProcessEditor({ product, initialProcessType = 'sales' }: UnifiedProcessEditorProps) {
  const [processType, setProcessType] = useState<ProcessType>(initialProcessType);
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedMode, setShowAdvancedMode] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'details' | 'pitch' | 'objections' | 'resources'>('details');

  const selectedStage = stages.find(s => s.id === selectedStageId);

  // Fetch stages for current process type
  const fetchStages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/process/${product.slug}/${processType}`);
      if (!response.ok) throw new Error('Failed to fetch process');
      const data = await response.json();
      setStages(data.stages || []);
      if (data.stages?.length > 0 && !selectedStageId) {
        setSelectedStageId(data.stages[0].id);
      }
    } catch (err) {
      console.error('Error fetching stages:', err);
      setError('Failed to load process stages');
    } finally {
      setLoading(false);
    }
  }, [product.slug, processType, selectedStageId]);

  useEffect(() => {
    fetchStages();
    setSelectedStageId(null);
    setActiveDetailTab('details');
  }, [processType, product.slug]);

  // Save stages
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/process/${product.slug}/${processType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages }),
      });
      if (!response.ok) throw new Error('Failed to save');
      setHasChanges(false);
      await fetchStages();
    } catch (err) {
      console.error('Error saving stages:', err);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Add new stage
  const handleAddStage = () => {
    const newStage: Stage = {
      id: generateId(),
      name: `New Stage ${stages.length + 1}`,
      slug: generateSlug(`New Stage ${stages.length + 1}`),
      stage_order: stages.length + 1,
      goal: null,
      description: null,
      exit_criteria: null,
      sla_days: null,
      sla_warning_days: null,
      is_terminal: false,
      terminal_type: null,
      pitch_points: [],
      objection_handlers: [],
      resources: [],
      ai_suggested_pitch_points: [],
      ai_suggested_objections: [],
      ai_insights: {},
      avg_days_in_stage: null,
      conversion_rate: null,
    };
    setStages([...stages, newStage]);
    setSelectedStageId(newStage.id);
    setHasChanges(true);
  };

  // Initialize with templates
  const handleInitializeTemplates = () => {
    const templates = STAGE_TEMPLATES[processType];
    const newStages = templates.map((t, i) => ({
      id: generateId(),
      name: t.name || '',
      slug: t.slug || '',
      stage_order: i + 1,
      goal: t.goal || null,
      description: null,
      exit_criteria: null,
      sla_days: null,
      sla_warning_days: null,
      is_terminal: false,
      terminal_type: null,
      pitch_points: [],
      objection_handlers: [],
      resources: [],
      ai_suggested_pitch_points: [],
      ai_suggested_objections: [],
      ai_insights: {},
      avg_days_in_stage: null,
      conversion_rate: null,
      target_days: t.target_days,
      response_sla_hours: t.response_sla_hours,
      resolution_sla_hours: t.resolution_sla_hours,
      health_min: t.health_min,
      health_max: t.health_max,
      action: t.action,
    })) as Stage[];
    setStages(newStages);
    setSelectedStageId(newStages[0]?.id || null);
    setHasChanges(true);
  };

  // Delete stage
  const handleDeleteStage = (stageId: string) => {
    setStages(stages.filter(s => s.id !== stageId));
    if (selectedStageId === stageId) {
      setSelectedStageId(stages.find(s => s.id !== stageId)?.id || null);
    }
    setHasChanges(true);
  };

  // Update stage field
  const updateStage = (stageId: string, updates: Partial<Stage>) => {
    setStages(stages.map(s => s.id === stageId ? { ...s, ...updates } : s));
    setHasChanges(true);
  };

  // Add pitch point
  const handleAddPitchPoint = () => {
    if (!selectedStage) return;
    const newPoint = { id: generateId(), text: '', source: 'manual' };
    updateStage(selectedStage.id, {
      pitch_points: [...selectedStage.pitch_points, newPoint],
    });
  };

  // Add objection handler
  const handleAddObjection = () => {
    if (!selectedStage) return;
    const newObj = { id: generateId(), objection: '', response: '', source: 'manual' };
    updateStage(selectedStage.id, {
      objection_handlers: [...selectedStage.objection_handlers, newObj],
    });
  };

  // Add resource
  const handleAddResource = () => {
    if (!selectedStage) return;
    const newRes = { id: generateId(), title: '', url: '', type: 'link' };
    updateStage(selectedStage.id, {
      resources: [...selectedStage.resources, newRes],
    });
  };

  // Update pitch point
  const updatePitchPoint = (pointId: string, text: string) => {
    if (!selectedStage) return;
    updateStage(selectedStage.id, {
      pitch_points: selectedStage.pitch_points.map(p =>
        p.id === pointId ? { ...p, text } : p
      ),
    });
  };

  // Delete pitch point
  const deletePitchPoint = (pointId: string) => {
    if (!selectedStage) return;
    updateStage(selectedStage.id, {
      pitch_points: selectedStage.pitch_points.filter(p => p.id !== pointId),
    });
  };

  // Update objection handler
  const updateObjection = (objId: string, field: 'objection' | 'response', value: string) => {
    if (!selectedStage) return;
    updateStage(selectedStage.id, {
      objection_handlers: selectedStage.objection_handlers.map(o =>
        o.id === objId ? { ...o, [field]: value } : o
      ),
    });
  };

  // Delete objection handler
  const deleteObjection = (objId: string) => {
    if (!selectedStage) return;
    updateStage(selectedStage.id, {
      objection_handlers: selectedStage.objection_handlers.filter(o => o.id !== objId),
    });
  };

  // Update resource
  const updateResource = (resId: string, field: 'title' | 'url' | 'type', value: string) => {
    if (!selectedStage) return;
    updateStage(selectedStage.id, {
      resources: selectedStage.resources.map(r =>
        r.id === resId ? { ...r, [field]: value } : r
      ),
    });
  };

  // Delete resource
  const deleteResource = (resId: string) => {
    if (!selectedStage) return;
    updateStage(selectedStage.id, {
      resources: selectedStage.resources.filter(r => r.id !== resId),
    });
  };

  const productColor = product.color || '#3B82F6';

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-[#2a2a2a] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${productColor}20` }}
            >
              <Target className="w-5 h-5" style={{ color: productColor }} />
            </div>
            <div>
              <h1 className="text-xl font-normal text-gray-900 dark:text-gray-100">{product.name}</h1>
              <p className="text-sm text-gray-500">Process Configuration</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdvancedMode(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-200 dark:border-[#2a2a2a] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Workflow className="w-4 h-4" />
              Advanced Mode
            </button>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                style={{ backgroundColor: productColor }}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        {/* Process Type Tabs */}
        <div className="flex gap-1 mt-4">
          {PROCESS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setProcessType(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                processType === tab.id
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Stages List (Left Panel) */}
        <div className="w-80 bg-white dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-[#2a2a2a] flex flex-col">
          <div className="p-4 border-b border-gray-100 dark:border-[#2a2a2a]">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {PROCESS_TABS.find(t => t.id === processType)?.label} Stages
            </h3>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full" />
            </div>
          ) : stages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mb-4">
                {PROCESS_TABS.find(t => t.id === processType)?.icon}
              </div>
              <p className="text-sm text-gray-500 mb-4">No stages configured</p>
              <button
                onClick={handleInitializeTemplates}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                style={{ backgroundColor: productColor }}
              >
                Use Templates
              </button>
              <button
                onClick={handleAddStage}
                className="mt-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                or start from scratch
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {stages.map((stage, index) => (
                  <div
                    key={stage.id}
                    onClick={() => setSelectedStageId(stage.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedStageId === stage.id
                        ? 'bg-gray-100 dark:bg-gray-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 cursor-grab" />
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0"
                      style={{ backgroundColor: productColor }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{stage.name}</p>
                      {stage.goal && (
                        <p className="text-xs text-gray-500 truncate">{stage.goal}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-gray-100 dark:border-[#2a2a2a]">
                <button
                  onClick={handleAddStage}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Stage
                </button>
              </div>
            </>
          )}
        </div>

        {/* Stage Detail Panel (Right Panel) */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedStage ? (
            <div className="max-w-3xl">
              {/* Stage Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <input
                    type="text"
                    value={selectedStage.name}
                    onChange={(e) => {
                      updateStage(selectedStage.id, {
                        name: e.target.value,
                        slug: generateSlug(e.target.value),
                      });
                    }}
                    className="text-xl font-medium text-gray-900 dark:text-gray-100 bg-transparent border-none focus:outline-none focus:ring-0 w-full"
                    placeholder="Stage name"
                  />
                </div>
                <button
                  onClick={() => handleDeleteStage(selectedStage.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Detail Tabs (for Sales) */}
              {processType === 'sales' && (
                <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                  {[
                    { id: 'details', label: 'Details', icon: <FileText className="w-4 h-4" /> },
                    { id: 'pitch', label: 'Pitch Points', icon: <Sparkles className="w-4 h-4" /> },
                    { id: 'objections', label: 'Objections', icon: <MessageSquare className="w-4 h-4" /> },
                    { id: 'resources', label: 'Resources', icon: <Link2 className="w-4 h-4" /> },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveDetailTab(tab.id as typeof activeDetailTab)}
                      className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                        activeDetailTab === tab.id
                          ? 'bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Details Tab */}
              {(activeDetailTab === 'details' || processType !== 'sales') && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] p-6">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Stage Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Goal</label>
                        <input
                          type="text"
                          value={selectedStage.goal || ''}
                          onChange={(e) => updateStage(selectedStage.id, { goal: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="What's the goal of this stage?"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Description</label>
                        <textarea
                          value={selectedStage.description || ''}
                          onChange={(e) => updateStage(selectedStage.id, { description: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          placeholder="Describe what happens in this stage..."
                        />
                      </div>
                      {processType === 'sales' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Exit Criteria</label>
                          <textarea
                            value={selectedStage.exit_criteria || ''}
                            onChange={(e) => updateStage(selectedStage.id, { exit_criteria: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            placeholder="When should this stage be completed?"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Type-specific fields */}
                  {processType === 'onboarding' && (
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] p-6">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Onboarding Settings</h3>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Target Days</label>
                        <input
                          type="number"
                          value={selectedStage.target_days || ''}
                          onChange={(e) => updateStage(selectedStage.id, { target_days: parseInt(e.target.value) || null })}
                          className="w-32 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}

                  {processType === 'support' && (
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] p-6">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">SLA Settings</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Response SLA (hours)</label>
                          <input
                            type="number"
                            value={selectedStage.response_sla_hours || ''}
                            onChange={(e) => updateStage(selectedStage.id, { response_sla_hours: parseInt(e.target.value) || null })}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Resolution SLA (hours)</label>
                          <input
                            type="number"
                            value={selectedStage.resolution_sla_hours || ''}
                            onChange={(e) => updateStage(selectedStage.id, { resolution_sla_hours: parseInt(e.target.value) || null })}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {processType === 'engagement' && (
                    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] p-6">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Health Band Settings</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Min Health Score</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={selectedStage.health_min ?? ''}
                            onChange={(e) => updateStage(selectedStage.id, { health_min: parseInt(e.target.value) || null })}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Max Health Score</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={selectedStage.health_max ?? ''}
                            onChange={(e) => updateStage(selectedStage.id, { health_max: parseInt(e.target.value) || null })}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="100"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Recommended Action</label>
                        <select
                          value={selectedStage.action || ''}
                          onChange={(e) => updateStage(selectedStage.id, { action: e.target.value || null })}
                          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select action...</option>
                          <option value="expansion_focus">Expansion Focus</option>
                          <option value="nurture">Nurture</option>
                          <option value="engage">Engage</option>
                          <option value="intervene">Intervene</option>
                          <option value="escalate">Escalate</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pitch Points Tab */}
              {processType === 'sales' && activeDetailTab === 'pitch' && (
                <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Pitch Points</h3>
                    <button
                      onClick={handleAddPitchPoint}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Point
                    </button>
                  </div>
                  {selectedStage.pitch_points.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">No pitch points yet. Add your key talking points.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedStage.pitch_points.map(point => (
                        <div key={point.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <textarea
                            value={point.text}
                            onChange={(e) => updatePitchPoint(point.id, e.target.value)}
                            rows={2}
                            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            placeholder="Enter pitch point..."
                          />
                          <button
                            onClick={() => deletePitchPoint(point.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Objections Tab */}
              {processType === 'sales' && activeDetailTab === 'objections' && (
                <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Objection Handlers</h3>
                    <button
                      onClick={handleAddObjection}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Objection
                    </button>
                  </div>
                  {selectedStage.objection_handlers.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">No objection handlers yet. Add common objections and responses.</p>
                  ) : (
                    <div className="space-y-4">
                      {selectedStage.objection_handlers.map(obj => (
                        <div key={obj.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-start justify-between mb-3">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Objection</label>
                            <button
                              onClick={() => deleteObjection(obj.id)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={obj.objection}
                            onChange={(e) => updateObjection(obj.id, 'objection', e.target.value)}
                            className="w-full px-3 py-2 mb-3 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="What they might say..."
                          />
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">Response</label>
                          <textarea
                            value={obj.response}
                            onChange={(e) => updateObjection(obj.id, 'response', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            placeholder="How to respond..."
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Resources Tab */}
              {processType === 'sales' && activeDetailTab === 'resources' && (
                <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Resources</h3>
                    <button
                      onClick={handleAddResource}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Resource
                    </button>
                  </div>
                  {selectedStage.resources.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">No resources yet. Add links to useful documents and materials.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedStage.resources.map(res => (
                        <div key={res.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <select
                            value={res.type}
                            onChange={(e) => updateResource(res.id, 'type', e.target.value)}
                            className="w-28 px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shrink-0"
                          >
                            <option value="link">Link</option>
                            <option value="document">Document</option>
                            <option value="video">Video</option>
                          </select>
                          <input
                            type="text"
                            value={res.title}
                            onChange={(e) => updateResource(res.id, 'title', e.target.value)}
                            className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                            placeholder="Title"
                          />
                          <input
                            type="url"
                            value={res.url}
                            onChange={(e) => updateResource(res.id, 'url', e.target.value)}
                            className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                            placeholder="URL"
                          />
                          <button
                            onClick={() => deleteResource(res.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              {stages.length > 0 ? 'Select a stage to edit' : 'Add stages to get started'}
            </div>
          )}
        </div>
      </div>

      {/* Advanced Mode Modal */}
      {showAdvancedMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl max-w-2xl w-full p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Workflow Builder</h2>
            <p className="text-sm text-gray-500 mb-6">
              The visual workflow builder allows you to create complex automation flows with conditions, AI actions, and human tasks.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAdvancedMode(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <a
                href={`/process/${product.slug}/${processType}/builder`}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                style={{ backgroundColor: productColor }}
              >
                Open Workflow Builder
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
