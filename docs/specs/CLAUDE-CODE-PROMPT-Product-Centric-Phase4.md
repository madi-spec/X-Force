# Product-Centric Redesign: Phase 4 - Proven Process Editor

## Context

Read these first:
- `/docs/specs/X-FORCE-CRM-Project-State.md`
- `/docs/specs/X-FORCE-Product-Centric-Redesign-Spec.md`

**Phase 1 Complete:** Database tables, products seeded
**Phase 2 Complete:** Customer data imported (1,390 company_products)
**Phase 3 Complete:** Product detail page, pipeline view, company products grid

---

## Phase 4 Deliverables

1. ✅ Proven Process Page (`/products/[slug]/process`)
2. ✅ Stage Editor (add, edit, reorder, delete)
3. ✅ Pitch Points Manager
4. ✅ Objection Handlers Manager
5. ✅ Stage Detail Modal/Panel
6. ✅ APIs for CRUD operations

---

## Task 1: Proven Process Page

Create `src/app/(dashboard)/products/[slug]/process/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProvenProcessEditor } from '@/components/products/ProvenProcessEditor';

interface Props {
  params: { slug: string };
}

export default async function ProvenProcessPage({ params }: Props) {
  const supabase = await createClient();
  
  const { data: product } = await supabase
    .from('products')
    .select(`
      *,
      stages:product_sales_stages(*)
    `)
    .eq('slug', params.slug)
    .single();
  
  if (!product) notFound();
  
  const stages = (product.stages || []).sort((a: any, b: any) => a.stage_order - b.stage_order);
  
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link 
        href={`/products/${params.slug}`}
        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {product.name}
      </Link>
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Proven Process</h1>
        <p className="text-gray-500">
          Define the sales stages, pitch points, and objection handlers for {product.name}
        </p>
      </div>
      
      <ProvenProcessEditor product={product} initialStages={stages} />
    </div>
  );
}
```

---

## Task 2: Proven Process Editor Component

Create `src/components/products/ProvenProcessEditor.tsx`:

```tsx
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
  FileText,
  Save
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
    const response = await fetch(`/api/products/${product.id}/stages`, {
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
    const response = await fetch(`/api/products/${product.id}/stages/${stageId}`, {
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
    
    const response = await fetch(`/api/products/${product.id}/stages/${stageId}`, {
      method: 'DELETE',
    });
    
    if (response.ok) {
      setStages(stages.filter(s => s.id !== stageId));
      if (selectedStage?.id === stageId) {
        setSelectedStage(null);
      }
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
    await fetch(`/api/products/${product.id}/stages/reorder`, {
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
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
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
            <div className="divide-y">
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
          <div className="mt-6 bg-white rounded-xl border p-4">
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
```

---

## Task 3: Stage Detail Panel

Create `src/components/products/StageDetailPanel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  MessageSquare, 
  AlertCircle,
  FileText,
  Sparkles
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
    { id: 'pitch', label: 'Pitch Points', icon: MessageSquare, count: editedStage.pitch_points?.length },
    { id: 'objections', label: 'Objections', icon: AlertCircle, count: editedStage.objection_handlers?.length },
    { id: 'resources', label: 'Resources', icon: FileText, count: editedStage.resources?.length },
  ];
  
  return (
    <div className="w-96 bg-white rounded-xl border shadow-lg flex flex-col max-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Edit: {stage.name}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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
      <div className="px-4 py-3 border-t flex justify-end">
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
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Goal</label>
        <input
          type="text"
          value={stage.goal || ''}
          onChange={(e) => onChange({ ...stage, goal: e.target.value })}
          placeholder="What's the objective of this stage?"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={stage.description || ''}
          onChange={(e) => onChange({ ...stage, description: e.target.value })}
          placeholder="Detailed description of this stage..."
          rows={3}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Exit Criteria</label>
        <input
          type="text"
          value={stage.exit_criteria || ''}
          onChange={(e) => onChange({ ...stage, exit_criteria: e.target.value })}
          placeholder="What must happen to move to next stage?"
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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
        <div key={handler.id} className="border rounded-lg p-3 space-y-2">
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
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <label className="text-xs font-medium text-green-600">Response</label>
          <textarea
            value={handler.response}
            onChange={(e) => updateHandler(handler.id, 'response', e.target.value)}
            placeholder="How to respond..."
            rows={2}
            className="w-full px-3 py-2 border rounded-lg text-sm"
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
        <div key={resource.id} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between">
            <select
              value={resource.type}
              onChange={(e) => updateResource(resource.id, 'type', e.target.value)}
              className="text-xs border rounded px-2 py-1"
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
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <input
            value={resource.url}
            onChange={(e) => updateResource(resource.id, 'url', e.target.value)}
            placeholder="URL"
            className="w-full px-3 py-2 border rounded-lg text-sm"
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
```

---

## Task 4: Add Stage Modal

Create `src/components/products/AddStageModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface AddStageModalProps {
  onAdd: (stage: { name: string; goal: string; exit_criteria: string }) => void;
  onClose: () => void;
  nextOrder: number;
}

export function AddStageModal({ onAdd, onClose, nextOrder }: AddStageModalProps) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [exitCriteria, setExitCriteria] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    onAdd({
      name: name.trim(),
      goal: goal.trim(),
      exit_criteria: exitCriteria.trim(),
    });
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Add Stage #{nextOrder}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stage Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Discovery Call"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Goal
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What's the objective of this stage?"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exit Criteria
            </label>
            <input
              type="text"
              value={exitCriteria}
              onChange={(e) => setExitCriteria(e.target.value)}
              placeholder="What must happen to advance?"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Add Stage
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## Task 5: Stages API

Create `src/app/api/products/[id]/stages/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - List stages for a product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  
  const { data: stages, error } = await supabase
    .from('product_sales_stages')
    .select('*')
    .eq('product_id', params.id)
    .order('stage_order');
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ stages });
}

// POST - Create new stage
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const body = await request.json();
  
  const { name, goal, exit_criteria, description, stage_order } = body;
  
  if (!name) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }
  
  // Generate slug from name
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  const { data: stage, error } = await supabase
    .from('product_sales_stages')
    .insert({
      product_id: params.id,
      name,
      slug,
      goal,
      description,
      exit_criteria,
      stage_order: stage_order || 1,
      pitch_points: [],
      objection_handlers: [],
      resources: [],
    })
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ stage }, { status: 201 });
}
```

---

## Task 6: Stage Detail API

Create `src/app/api/products/[id]/stages/[stageId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Get single stage
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  const supabase = await createClient();
  
  const { data: stage, error } = await supabase
    .from('product_sales_stages')
    .select('*')
    .eq('id', params.stageId)
    .eq('product_id', params.id)
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ stage });
}

// PATCH - Update stage
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  const supabase = await createClient();
  const body = await request.json();
  
  const allowedFields = [
    'name', 'goal', 'description', 'exit_criteria',
    'pitch_points', 'objection_handlers', 'resources',
    'ai_sequence_id', 'ai_actions'
  ];
  
  const updates: any = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }
  
  // Update slug if name changed
  if (updates.name) {
    updates.slug = updates.name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  const { data: stage, error } = await supabase
    .from('product_sales_stages')
    .update(updates)
    .eq('id', params.stageId)
    .eq('product_id', params.id)
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ stage });
}

// DELETE - Delete stage
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  const supabase = await createClient();
  
  // Check if any companies are in this stage
  const { count } = await supabase
    .from('company_products')
    .select('*', { count: 'exact', head: true })
    .eq('current_stage_id', params.stageId);
  
  if (count && count > 0) {
    return NextResponse.json({ 
      error: `Cannot delete: ${count} companies are in this stage` 
    }, { status: 400 });
  }
  
  const { error } = await supabase
    .from('product_sales_stages')
    .delete()
    .eq('id', params.stageId)
    .eq('product_id', params.id);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true });
}
```

---

## Task 7: Reorder Stages API

Create `src/app/api/products/[id]/stages/reorder/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const body = await request.json();
  
  const { stage_ids } = body;
  
  if (!Array.isArray(stage_ids)) {
    return NextResponse.json({ error: 'stage_ids array required' }, { status: 400 });
  }
  
  // Update each stage's order
  for (let i = 0; i < stage_ids.length; i++) {
    await supabase
      .from('product_sales_stages')
      .update({ stage_order: i + 1 })
      .eq('id', stage_ids[i])
      .eq('product_id', params.id);
  }
  
  return NextResponse.json({ success: true });
}
```

---

## Task 8: Update Component Exports

Update `src/components/products/index.ts`:

```typescript
export { ProductCard } from './ProductCard';
export { ProductHeader } from './ProductHeader';
export { ProductStats } from './ProductStats';
export { ProductPipeline } from './ProductPipeline';
export { ProductCustomers } from './ProductCustomers';
export { ProvenProcessEditor } from './ProvenProcessEditor';
export { StageDetailPanel } from './StageDetailPanel';
export { AddStageModal } from './AddStageModal';
```

---

## Verification

1. Visit `/products/xrai-2/process` - Should show stages editor
2. Click "Add Stage" - Modal should appear
3. Add a new stage - Should appear in list
4. Click edit (pencil icon) - Side panel should open
5. Add pitch points - Should save
6. Add objection handlers - Should save
7. Add resources - Should save
8. Delete a stage (with no companies) - Should work
9. TypeScript compiles clean: `npx tsc --noEmit`

---

## Success Criteria

- [ ] `/products/[slug]/process` page renders
- [ ] Can add new stages
- [ ] Can edit stage details (name, goal, exit criteria)
- [ ] Can add/edit/delete pitch points
- [ ] Can add/edit/delete objection handlers  
- [ ] Can add/edit/delete resources
- [ ] Can delete stages (if empty)
- [ ] Stage order persists
- [ ] All APIs working
- [ ] TypeScript compiles clean
