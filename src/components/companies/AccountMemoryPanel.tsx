'use client';

import { useState, useEffect } from 'react';
import {
  Brain,
  Check,
  ChevronDown,
  Clock,
  Edit2,
  Heart,
  Lightbulb,
  MessageSquare,
  Plus,
  Shield,
  Target,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface AccountMemory {
  id: string;
  company_id: string;
  resonates: string[];
  effective_angles: string[];
  avoided: string[];
  failed_approaches: string[];
  preferred_channel: string | null;
  response_pattern: string | null;
  formality_level: string | null;
  best_time_to_reach: string | null;
  decision_style: string | null;
  typical_timeline: string | null;
  key_concerns: string[];
  objections_encountered: Array<{
    objection: string;
    response_that_worked: string;
    date: string;
    resolved: boolean;
  }>;
  rapport_builders: string[];
  personal_notes: Array<{ note: string; date: string }>;
  last_win_theme: string | null;
  last_loss_reason: string | null;
  updated_at: string;
}

interface MemoryUpdate {
  id: string;
  field_updated: string;
  old_value: unknown;
  new_value: unknown;
  source: string;
  created_at: string;
  user: { name: string } | null;
}

interface AccountMemoryPanelProps {
  companyId: string;
  companyName: string;
}

// ============================================
// CONFIGURATION
// ============================================

const channelOptions = [
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'video', label: 'Video Call' },
];

const responsePatternOptions = [
  { value: 'quick', label: 'Quick Responder' },
  { value: 'deliberate', label: 'Deliberate' },
  { value: 'sporadic', label: 'Sporadic' },
];

const formalityOptions = [
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'mixed', label: 'Mixed' },
];

const decisionStyleOptions = [
  { value: 'owner_led', label: 'Owner-Led' },
  { value: 'consensus', label: 'Consensus-Driven' },
  { value: 'committee', label: 'Committee' },
  { value: 'financial', label: 'Finance-Driven' },
];

const sourceLabels: Record<string, string> = {
  meeting_analysis: 'Meeting Analysis',
  email_analysis: 'Email Analysis',
  manual: 'Manual Entry',
  postmortem: 'Deal Postmortem',
};

// ============================================
// MAIN COMPONENT
// ============================================

export function AccountMemoryPanel({ companyId, companyName }: AccountMemoryPanelProps) {
  const [memory, setMemory] = useState<AccountMemory | null>(null);
  const [recentUpdates, setRecentUpdates] = useState<MemoryUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    whatWorks: true,
    whatDoesntWork: true,
    communication: true,
    decision: true,
    objections: true,
    rapport: true,
    outcomes: true,
  });

  useEffect(() => {
    fetchMemory();
  }, [companyId]);

  const fetchMemory = async () => {
    try {
      const response = await fetch(`/api/companies/${companyId}/memory`);
      const data = await response.json();
      setMemory(data.memory);
      setRecentUpdates(data.recentUpdates || []);
    } catch (err) {
      console.error('Error fetching memory:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateField = async (field: string, value: unknown) => {
    if (!memory) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/companies/${companyId}/memory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value, source: 'manual' }),
      });
      const data = await response.json();
      if (data.memory) {
        setMemory(data.memory);
      }
      setEditingField(null);
    } catch (err) {
      console.error('Error updating memory:', err);
    } finally {
      setSaving(false);
    }
  };

  const addToArrayField = async (field: string, value: string) => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/companies/${companyId}/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value: value.trim(), source: 'manual' }),
      });
      const data = await response.json();
      if (data.memory) {
        setMemory(data.memory);
      }
    } catch (err) {
      console.error('Error adding to memory:', err);
    } finally {
      setSaving(false);
    }
  };

  const removeFromArrayField = async (field: string, index: number) => {
    if (!memory) return;
    const currentArray = (memory[field as keyof AccountMemory] as string[]) || [];
    const newArray = currentArray.filter((_, i) => i !== index);
    await updateField(field, newArray);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-50">
            <Brain className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900">What We've Learned</h2>
            <p className="text-sm text-gray-500">
              Institutional knowledge about {companyName}
            </p>
          </div>
        </div>
        {memory?.updated_at && (
          <p className="text-xs text-gray-400 mt-2">
            Last updated {formatRelativeTime(memory.updated_at)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* What Works */}
        <Section
          title="What Works"
          icon={ThumbsUp}
          iconColor="text-green-600 bg-green-50"
          expanded={expandedSections.whatWorks}
          onToggle={() => toggleSection('whatWorks')}
        >
          <TagList
            label="Messages That Resonate"
            items={memory?.resonates || []}
            field="resonates"
            onAdd={addToArrayField}
            onRemove={removeFromArrayField}
            saving={saving}
            placeholder="e.g., growth story, tech modernization"
          />
          <TagList
            label="Effective Angles"
            items={memory?.effective_angles || []}
            field="effective_angles"
            onAdd={addToArrayField}
            onRemove={removeFromArrayField}
            saving={saving}
            placeholder="e.g., competitor displacement"
          />
        </Section>

        {/* What Doesn't Work */}
        <Section
          title="What Doesn't Work"
          icon={ThumbsDown}
          iconColor="text-red-600 bg-red-50"
          expanded={expandedSections.whatDoesntWork}
          onToggle={() => toggleSection('whatDoesntWork')}
        >
          <TagList
            label="Topics to Avoid"
            items={memory?.avoided || []}
            field="avoided"
            onAdd={addToArrayField}
            onRemove={removeFromArrayField}
            saving={saving}
            placeholder="e.g., cold ROI numbers"
          />
          <TagList
            label="Failed Approaches"
            items={memory?.failed_approaches || []}
            field="failed_approaches"
            onAdd={addToArrayField}
            onRemove={removeFromArrayField}
            saving={saving}
            placeholder="e.g., aggressive discounting"
          />
        </Section>

        {/* Communication Preferences */}
        <Section
          title="Communication Style"
          icon={MessageSquare}
          iconColor="text-blue-600 bg-blue-50"
          expanded={expandedSections.communication}
          onToggle={() => toggleSection('communication')}
        >
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Preferred Channel"
              value={memory?.preferred_channel || ''}
              options={channelOptions}
              onChange={(v) => updateField('preferred_channel', v || null)}
              saving={saving}
            />
            <SelectField
              label="Response Pattern"
              value={memory?.response_pattern || ''}
              options={responsePatternOptions}
              onChange={(v) => updateField('response_pattern', v || null)}
              saving={saving}
            />
            <SelectField
              label="Formality Level"
              value={memory?.formality_level || ''}
              options={formalityOptions}
              onChange={(v) => updateField('formality_level', v || null)}
              saving={saving}
            />
            <TextField
              label="Best Time to Reach"
              value={memory?.best_time_to_reach || ''}
              onChange={(v) => updateField('best_time_to_reach', v || null)}
              saving={saving}
              placeholder="e.g., Early morning, after 4pm"
            />
          </div>
        </Section>

        {/* Decision Style */}
        <Section
          title="Decision Making"
          icon={Target}
          iconColor="text-amber-600 bg-amber-50"
          expanded={expandedSections.decision}
          onToggle={() => toggleSection('decision')}
        >
          <div className="space-y-4">
            <SelectField
              label="Decision Style"
              value={memory?.decision_style || ''}
              options={decisionStyleOptions}
              onChange={(v) => updateField('decision_style', v || null)}
              saving={saving}
            />
            <TextField
              label="Typical Timeline"
              value={memory?.typical_timeline || ''}
              onChange={(v) => updateField('typical_timeline', v || null)}
              saving={saving}
              placeholder="e.g., 60-90 days from demo"
            />
            <TagList
              label="Key Concerns"
              items={memory?.key_concerns || []}
              field="key_concerns"
              onAdd={addToArrayField}
              onRemove={removeFromArrayField}
              saving={saving}
              placeholder="e.g., implementation time"
            />
          </div>
        </Section>

        {/* Objections */}
        <Section
          title="Objections Encountered"
          icon={Shield}
          iconColor="text-orange-600 bg-orange-50"
          expanded={expandedSections.objections}
          onToggle={() => toggleSection('objections')}
        >
          <ObjectionsList
            objections={memory?.objections_encountered || []}
            onUpdate={(objections) => updateField('objections_encountered', objections)}
            saving={saving}
          />
        </Section>

        {/* Rapport Builders */}
        <Section
          title="Rapport Builders"
          icon={Heart}
          iconColor="text-pink-600 bg-pink-50"
          expanded={expandedSections.rapport}
          onToggle={() => toggleSection('rapport')}
        >
          <TagList
            label="Connection Points"
            items={memory?.rapport_builders || []}
            field="rapport_builders"
            onAdd={addToArrayField}
            onRemove={removeFromArrayField}
            saving={saving}
            placeholder="e.g., golf, same alma mater"
          />
          <NotesList
            notes={memory?.personal_notes || []}
            onUpdate={(notes) => updateField('personal_notes', notes)}
            saving={saving}
          />
        </Section>

        {/* Outcome Learnings */}
        <Section
          title="Outcome Learnings"
          icon={Lightbulb}
          iconColor="text-yellow-600 bg-yellow-50"
          expanded={expandedSections.outcomes}
          onToggle={() => toggleSection('outcomes')}
        >
          <div className="space-y-4">
            <TextField
              label="Last Win Theme"
              value={memory?.last_win_theme || ''}
              onChange={(v) => updateField('last_win_theme', v || null)}
              saving={saving}
              placeholder="What worked when we won"
            />
            <TextField
              label="Last Loss Reason"
              value={memory?.last_loss_reason || ''}
              onChange={(v) => updateField('last_loss_reason', v || null)}
              saving={saving}
              placeholder="What we learned from the loss"
            />
          </div>
        </Section>

        {/* Recent Updates (Audit Trail) */}
        <div className="col-span-2">
          <Section
            title="Recent Updates"
            icon={Clock}
            iconColor="text-gray-600 bg-gray-100"
            expanded={true}
            onToggle={() => {}}
          >
            {recentUpdates.length > 0 ? (
              <div className="space-y-3">
                {recentUpdates.map((update) => (
                  <div
                    key={update.id}
                    className="flex items-start gap-3 text-sm border-b border-gray-100 pb-3 last:border-0"
                  >
                    <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <User className="h-3 w-3 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900">
                        <span className="font-medium">{update.user?.name || 'System'}</span>
                        {' updated '}
                        <span className="font-medium">{formatFieldName(update.field_updated)}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatRelativeTime(update.created_at)} via {sourceLabels[update.source] || update.source}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No updates yet. Start adding what you've learned!
              </p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function Section({
  title,
  icon: Icon,
  iconColor,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: typeof Brain;
  iconColor: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', iconColor)}>
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="font-medium text-gray-900">{title}</h3>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-gray-400 transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>
      {expanded && <div className="p-4 pt-0 space-y-4">{children}</div>}
    </div>
  );
}

function TagList({
  label,
  items,
  field,
  onAdd,
  onRemove,
  saving,
  placeholder,
}: {
  label: string;
  items: string[];
  field: string;
  onAdd: (field: string, value: string) => void;
  onRemove: (field: string, index: number) => void;
  saving: boolean;
  placeholder: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (newValue.trim()) {
      onAdd(field, newValue);
      setNewValue('');
      setAdding(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg group"
          >
            {item}
            <button
              onClick={() => onRemove(field, i)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={saving}
            >
              <X className="h-3 w-3 text-gray-500 hover:text-red-500" />
            </button>
          </span>
        ))}
        {adding ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={placeholder}
              className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleAdd}
              disabled={saving}
              className="p-1 text-green-600 hover:text-green-700"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewValue('');
              }}
              className="p-1 text-gray-400 hover:text-gray-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  saving,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  saving: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={saving}
        className="mt-1 block w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Not set</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  saving,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  saving: boolean;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = () => {
    onChange(localValue);
    setEditing(false);
  };

  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      {editing ? (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-2 text-green-600 hover:text-green-700"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setLocalValue(value);
            }}
            className="p-2 text-gray-400 hover:text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          className="mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 flex items-center justify-between group"
        >
          <span className={value ? 'text-gray-900' : 'text-gray-400'}>
            {value || placeholder}
          </span>
          <Edit2 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
        </div>
      )}
    </div>
  );
}

function ObjectionsList({
  objections,
  onUpdate,
  saving,
}: {
  objections: Array<{
    objection: string;
    response_that_worked: string;
    date: string;
    resolved: boolean;
  }>;
  onUpdate: (objections: Array<{
    objection: string;
    response_that_worked: string;
    date: string;
    resolved: boolean;
  }>) => void;
  saving: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newObjection, setNewObjection] = useState('');
  const [newResponse, setNewResponse] = useState('');

  const handleAdd = () => {
    if (newObjection.trim()) {
      onUpdate([
        ...objections,
        {
          objection: newObjection.trim(),
          response_that_worked: newResponse.trim(),
          date: new Date().toISOString(),
          resolved: !!newResponse.trim(),
        },
      ]);
      setNewObjection('');
      setNewResponse('');
      setAdding(false);
    }
  };

  const handleRemove = (index: number) => {
    onUpdate(objections.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {objections.map((obj, i) => (
        <div key={i} className="p-3 bg-gray-50 rounded-lg group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{obj.objection}</p>
              {obj.response_that_worked && (
                <p className="text-sm text-green-600 mt-1">
                  Response: {obj.response_that_worked}
                </p>
              )}
            </div>
            <button
              onClick={() => handleRemove(i)}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500"
              disabled={saving}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                obj.resolved
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              )}
            >
              {obj.resolved ? 'Resolved' : 'Unresolved'}
            </span>
            <span className="text-xs text-gray-500">
              {formatRelativeTime(obj.date)}
            </span>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="p-3 border border-dashed border-gray-300 rounded-lg space-y-2">
          <input
            type="text"
            value={newObjection}
            onChange={(e) => setNewObjection(e.target.value)}
            placeholder="What was the objection?"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
          <input
            type="text"
            value={newResponse}
            onChange={(e) => setNewResponse(e.target.value)}
            placeholder="What response worked? (optional)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setAdding(false);
                setNewObjection('');
                setNewResponse('');
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !newObjection.trim()}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Add Objection
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-2 text-sm text-blue-600 border border-dashed border-blue-200 rounded-lg hover:bg-blue-50 flex items-center justify-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Objection
        </button>
      )}
    </div>
  );
}

function NotesList({
  notes,
  onUpdate,
  saving,
}: {
  notes: Array<{ note: string; date: string }>;
  onUpdate: (notes: Array<{ note: string; date: string }>) => void;
  saving: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [newNote, setNewNote] = useState('');

  const handleAdd = () => {
    if (newNote.trim()) {
      onUpdate([
        ...notes,
        {
          note: newNote.trim(),
          date: new Date().toISOString(),
        },
      ]);
      setNewNote('');
      setAdding(false);
    }
  };

  const handleRemove = (index: number) => {
    onUpdate(notes.filter((_, i) => i !== index));
  };

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        Personal Notes
      </p>
      <div className="space-y-2">
        {notes.map((item, i) => (
          <div
            key={i}
            className="flex items-start justify-between p-2 bg-gray-50 rounded-lg text-sm group"
          >
            <div className="flex-1">
              <p className="text-gray-900">{item.note}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatRelativeTime(item.date)}
              </p>
            </div>
            <button
              onClick={() => handleRemove(i)}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500"
              disabled={saving}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {adding ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Add a personal note..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleAdd}
              disabled={saving}
              className="p-2 text-green-600 hover:text-green-700"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewNote('');
              }}
              className="p-2 text-gray-400 hover:text-gray-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
          >
            <Plus className="h-3 w-3" />
            Add Note
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatFieldName(field: string): string {
  const mapping: Record<string, string> = {
    resonates: 'Messages That Resonate',
    effective_angles: 'Effective Angles',
    avoided: 'Topics to Avoid',
    failed_approaches: 'Failed Approaches',
    preferred_channel: 'Preferred Channel',
    response_pattern: 'Response Pattern',
    formality_level: 'Formality Level',
    best_time_to_reach: 'Best Time to Reach',
    decision_style: 'Decision Style',
    typical_timeline: 'Typical Timeline',
    key_concerns: 'Key Concerns',
    objections_encountered: 'Objections',
    rapport_builders: 'Rapport Builders',
    personal_notes: 'Personal Notes',
    last_win_theme: 'Last Win Theme',
    last_loss_reason: 'Last Loss Reason',
  };
  return mapping[field] || field;
}
