'use client';

import { useState } from 'react';
import {
  X,
  Save,
  Plus,
  Trash2,
  MessageSquare,
  AlertCircle,
  FileText
} from 'lucide-react';

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
}

interface PitchPoint {
  id: string;
  text: string;
  source?: 'manual' | 'ai_suggested';
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

interface StageDetailPanelProps {
  stage: Stage;
  onUpdate: (updates: Partial<Stage>) => void;
  onClose: () => void;
  saving: boolean;
}

export function StageDetailPanel({ stage, onUpdate, onClose, saving }: StageDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'pitch' | 'objections' | 'resources'>('details');
  const [editedStage, setEditedStage] = useState(stage);

  const handleSave = () => {
    onUpdate(editedStage);
  };

  const tabs = [
    { id: 'details', label: 'Details', icon: FileText },
    { id: 'pitch', label: 'Pitch', icon: MessageSquare, count: editedStage.pitch_points?.length },
    { id: 'objections', label: 'Objections', icon: AlertCircle, count: editedStage.objection_handlers?.length },
    { id: 'resources', label: 'Resources', icon: FileText, count: editedStage.resources?.length },
  ];

  return (
    <div className="w-96 bg-white rounded-xl border border-gray-200 shadow-lg flex flex-col max-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Edit: {stage.name}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center gap-1 border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-xs bg-gray-200 rounded-full px-1.5">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'details' && (
          <DetailsTab
            stage={editedStage}
            onChange={setEditedStage}
          />
        )}
        {activeTab === 'pitch' && (
          <PitchPointsTab
            pitchPoints={editedStage.pitch_points || []}
            onChange={(points) => setEditedStage({ ...editedStage, pitch_points: points })}
          />
        )}
        {activeTab === 'objections' && (
          <ObjectionsTab
            handlers={editedStage.objection_handlers || []}
            onChange={(handlers) => setEditedStage({ ...editedStage, objection_handlers: handlers })}
          />
        )}
        {activeTab === 'resources' && (
          <ResourcesTab
            resources={editedStage.resources || []}
            onChange={(resources) => setEditedStage({ ...editedStage, resources: resources })}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function DetailsTab({ stage, onChange }: { stage: Stage; onChange: (s: Stage) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Stage Name</label>
        <input
          type="text"
          value={stage.name}
          onChange={(e) => onChange({ ...stage, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Goal</label>
        <input
          type="text"
          value={stage.goal || ''}
          onChange={(e) => onChange({ ...stage, goal: e.target.value })}
          placeholder="What's the objective of this stage?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={stage.description || ''}
          onChange={(e) => onChange({ ...stage, description: e.target.value })}
          placeholder="Detailed description of this stage..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Exit Criteria</label>
        <input
          type="text"
          value={stage.exit_criteria || ''}
          onChange={(e) => onChange({ ...stage, exit_criteria: e.target.value })}
          placeholder="What must happen to move to next stage?"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}

function PitchPointsTab({
  pitchPoints,
  onChange
}: {
  pitchPoints: PitchPoint[];
  onChange: (points: PitchPoint[]) => void;
}) {
  const addPitchPoint = () => {
    onChange([
      ...pitchPoints,
      { id: crypto.randomUUID(), text: '', source: 'manual' }
    ]);
  };

  const updatePitchPoint = (id: string, text: string) => {
    onChange(pitchPoints.map(p => p.id === id ? { ...p, text } : p));
  };

  const deletePitchPoint = (id: string) => {
    onChange(pitchPoints.filter(p => p.id !== id));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Key points to make when talking to prospects at this stage.
      </p>

      {pitchPoints.map((point, index) => (
        <div key={point.id} className="flex items-start gap-2">
          <span className="text-sm text-gray-400 mt-2">{index + 1}.</span>
          <textarea
            value={point.text}
            onChange={(e) => updatePitchPoint(point.id, e.target.value)}
            placeholder="Enter pitch point..."
            rows={2}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => deletePitchPoint(point.id)}
            className="p-2 text-gray-400 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      <button
        onClick={addPitchPoint}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
      >
        <Plus className="w-4 h-4" />
        Add Pitch Point
      </button>
    </div>
  );
}

function ObjectionsTab({
  handlers,
  onChange
}: {
  handlers: ObjectionHandler[];
  onChange: (handlers: ObjectionHandler[]) => void;
}) {
  const addHandler = () => {
    onChange([
      ...handlers,
      { id: crypto.randomUUID(), objection: '', response: '', source: 'manual' }
    ]);
  };

  const updateHandler = (id: string, field: 'objection' | 'response', value: string) => {
    onChange(handlers.map(h => h.id === id ? { ...h, [field]: value } : h));
  };

  const deleteHandler = (id: string) => {
    onChange(handlers.filter(h => h.id !== id));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Common objections and how to handle them.
      </p>

      {handlers.map((handler) => (
        <div key={handler.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between">
            <label className="text-xs font-medium text-red-600">Objection</label>
            <button
              onClick={() => deleteHandler(handler.id)}
              className="text-gray-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <input
            value={handler.objection}
            onChange={(e) => updateHandler(handler.id, 'objection', e.target.value)}
            placeholder="What they say..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <label className="text-xs font-medium text-green-600">Response</label>
          <textarea
            value={handler.response}
            onChange={(e) => updateHandler(handler.id, 'response', e.target.value)}
            placeholder="How to respond..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      ))}

      <button
        onClick={addHandler}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
      >
        <Plus className="w-4 h-4" />
        Add Objection Handler
      </button>
    </div>
  );
}

function ResourcesTab({
  resources,
  onChange
}: {
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
}) {
  const addResource = () => {
    onChange([
      ...resources,
      { id: crypto.randomUUID(), title: '', url: '', type: 'link' }
    ]);
  };

  const updateResource = (id: string, field: keyof Resource, value: string) => {
    onChange(resources.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const deleteResource = (id: string) => {
    onChange(resources.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Sales materials, documents, and links for this stage.
      </p>

      {resources.map((resource) => (
        <div key={resource.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between">
            <select
              value={resource.type}
              onChange={(e) => updateResource(resource.id, 'type', e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value="link">Link</option>
              <option value="document">Document</option>
              <option value="video">Video</option>
            </select>
            <button
              onClick={() => deleteResource(resource.id)}
              className="text-gray-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <input
            value={resource.title}
            onChange={(e) => updateResource(resource.id, 'title', e.target.value)}
            placeholder="Resource title"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            value={resource.url}
            onChange={(e) => updateResource(resource.id, 'url', e.target.value)}
            placeholder="URL"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      ))}

      <button
        onClick={addResource}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
      >
        <Plus className="w-4 h-4" />
        Add Resource
      </button>
    </div>
  );
}
