'use client';

import { useState } from 'react';
import {
  Plus,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit2,
  Target,
  MessageSquare,
  AlertCircle,
  FileText
} from 'lucide-react';
import { StageDetailPanel } from './StageDetailPanel';
import { AddStageModal } from './AddStageModal';

interface Stage {
  id: string;
  name: string;
  slug: string;
  stage_order: number;
  goal: string | null;
  description: string | null;
  exit_criteria: string | null;
  pitch_points: PitchPoint[];
  objection_handlers: ObjectionHandler[];
  resources: Resource[];
  avg_days_in_stage: number | null;
  conversion_rate: number | null;
}

interface PitchPoint {
  id: string;
  text: string;
  source?: 'manual' | 'ai_suggested';
  effectiveness_score?: number;
}

interface ObjectionHandler {
  id: string;
  objection: string;
  response: string;
  source?: 'manual' | 'ai_suggested';
}

interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'document' | 'video' | 'link';
}

interface ProvenProcessEditorProps {
  product: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  };
  initialStages: Stage[];
}

export function ProvenProcessEditor({ product, initialStages }: ProvenProcessEditorProps) {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAddStage = async (stageData: Partial<Stage>) => {
    const response = await fetch(`/api/products/${product.slug}/stages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...stageData,
        stage_order: stages.length + 1,
      }),
    });

    if (response.ok) {
      const { stage } = await response.json();
      setStages([...stages, stage]);
      setShowAddModal(false);
    }
  };

  const handleUpdateStage = async (stageId: string, updates: Partial<Stage>) => {
    setSaving(true);
    const response = await fetch(`/api/products/${product.slug}/stages/${stageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (response.ok) {
      const { stage } = await response.json();
      setStages(stages.map(s => s.id === stageId ? stage : s));
      if (selectedStage?.id === stageId) {
        setSelectedStage(stage);
      }
    }
    setSaving(false);
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Delete this stage? Companies in this stage will need to be reassigned.')) return;

    const response = await fetch(`/api/products/${product.slug}/stages/${stageId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      setStages(stages.filter(s => s.id !== stageId));
      if (selectedStage?.id === stageId) {
        setSelectedStage(null);
      }
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to delete stage');
    }
  };

  const handleReorderStages = async (fromIndex: number, toIndex: number) => {
    const newStages = [...stages];
    const [moved] = newStages.splice(fromIndex, 1);
    newStages.splice(toIndex, 0, moved);

    // Update order numbers
    const reordered = newStages.map((s, i) => ({ ...s, stage_order: i + 1 }));
    setStages(reordered);

    // Save to server
    await fetch(`/api/products/${product.slug}/stages/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage_ids: reordered.map(s => s.id)
      }),
    });
  };

  return (
    <div className="flex gap-6">
      {/* Stages List */}
      <div className="flex-1">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Sales Stages</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Stage
            </button>
          </div>

          {stages.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No stages defined yet.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add First Stage
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {stages.map((stage, index) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  index={index}
                  isExpanded={expandedStage === stage.id}
                  isSelected={selectedStage?.id === stage.id}
                  onToggle={() => setExpandedStage(
                    expandedStage === stage.id ? null : stage.id
                  )}
                  onSelect={() => setSelectedStage(stage)}
                  onDelete={() => handleDeleteStage(stage.id)}
                  productColor={product.color}
                />
              ))}
            </div>
          )}
        </div>

        {/* Stage Metrics Summary */}
        {stages.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-4">Funnel Metrics</h3>
            <div className="flex items-center gap-2 overflow-x-auto">
              {stages.map((stage, index) => (
                <div key={stage.id} className="flex items-center">
                  <div className="text-center px-4">
                    <div className="text-lg font-bold text-gray-900">
                      {stage.conversion_rate ? `${stage.conversion_rate}%` : '—'}
                    </div>
                    <div className="text-xs text-gray-500">{stage.name}</div>
                    <div className="text-xs text-gray-400">
                      {stage.avg_days_in_stage ? `${stage.avg_days_in_stage}d avg` : ''}
                    </div>
                  </div>
                  {index < stages.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stage Detail Panel */}
      {selectedStage && (
        <StageDetailPanel
          stage={selectedStage}
          onUpdate={(updates) => handleUpdateStage(selectedStage.id, updates)}
          onClose={() => setSelectedStage(null)}
          saving={saving}
        />
      )}

      {/* Add Stage Modal */}
      {showAddModal && (
        <AddStageModal
          onAdd={handleAddStage}
          onClose={() => setShowAddModal(false)}
          nextOrder={stages.length + 1}
        />
      )}
    </div>
  );
}

function StageRow({
  stage,
  index,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onDelete,
  productColor,
}: {
  stage: Stage;
  index: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onDelete: () => void;
  productColor: string | null;
}) {
  const pitchCount = stage.pitch_points?.length || 0;
  const objectionCount = stage.objection_handlers?.length || 0;
  const resourceCount = stage.resources?.length || 0;

  return (
    <div className={`${isSelected ? 'bg-blue-50' : ''}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button className="cursor-grab text-gray-400 hover:text-gray-600">
          <GripVertical className="w-4 h-4" />
        </button>

        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
          style={{ backgroundColor: productColor || '#3B82F6' }}
        >
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-gray-600"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            <span className="font-medium text-gray-900">{stage.name}</span>
          </div>
          {stage.goal && (
            <p className="text-sm text-gray-500 ml-8 truncate">{stage.goal}</p>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-400">
          {pitchCount > 0 && (
            <span className="flex items-center gap-1" title="Pitch points">
              <MessageSquare className="w-3 h-3" />
              {pitchCount}
            </span>
          )}
          {objectionCount > 0 && (
            <span className="flex items-center gap-1" title="Objection handlers">
              <AlertCircle className="w-3 h-3" />
              {objectionCount}
            </span>
          )}
          {resourceCount > 0 && (
            <span className="flex items-center gap-1" title="Resources">
              <FileText className="w-3 h-3" />
              {resourceCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onSelect}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Edit stage"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Delete stage"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 ml-16 space-y-2 text-sm">
          {stage.exit_criteria && (
            <div>
              <span className="font-medium text-gray-700">Exit Criteria:</span>{' '}
              <span className="text-gray-600">{stage.exit_criteria}</span>
            </div>
          )}
          {stage.description && (
            <div>
              <span className="font-medium text-gray-700">Description:</span>{' '}
              <span className="text-gray-600">{stage.description}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
