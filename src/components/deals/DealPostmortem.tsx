'use client';

import { useState, useEffect } from 'react';
import {
  Award,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  FileText,
  Lightbulb,
  Plus,
  Save,
  Swords,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface Postmortem {
  id: string;
  deal_id: string;
  outcome: 'won' | 'lost';
  primary_reason: string;
  what_worked: string[];
  what_didnt_work: string[];
  competitor_info: {
    name?: string;
    why_they_won?: string;
    price_difference?: string;
    feature_gaps?: string[];
  } | null;
  key_learnings: string[];
  recommended_changes: string[];
  created_at: string;
  updated_at: string;
}

interface DealPostmortemProps {
  dealId: string;
  dealName: string;
  outcome: 'won' | 'lost';
  onComplete?: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DealPostmortem({
  dealId,
  dealName,
  outcome,
  onComplete,
}: DealPostmortemProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingPostmortem, setExistingPostmortem] = useState<Postmortem | null>(null);

  // Form state
  const [primaryReason, setPrimaryReason] = useState('');
  const [whatWorked, setWhatWorked] = useState<string[]>([]);
  const [whatDidntWork, setWhatDidntWork] = useState<string[]>([]);
  const [competitorName, setCompetitorName] = useState('');
  const [competitorWhyWon, setCompetitorWhyWon] = useState('');
  const [keyLearnings, setKeyLearnings] = useState<string[]>([]);
  const [recommendedChanges, setRecommendedChanges] = useState<string[]>([]);

  // Input states for adding new items
  const [newWorked, setNewWorked] = useState('');
  const [newDidntWork, setNewDidntWork] = useState('');
  const [newLearning, setNewLearning] = useState('');
  const [newChange, setNewChange] = useState('');

  useEffect(() => {
    fetchPostmortem();
  }, [dealId]);

  const fetchPostmortem = async () => {
    try {
      const response = await fetch(`/api/deals/${dealId}/postmortem`);
      const data = await response.json();

      if (data.postmortem) {
        setExistingPostmortem(data.postmortem);
        setPrimaryReason(data.postmortem.primary_reason || '');
        setWhatWorked(data.postmortem.what_worked || []);
        setWhatDidntWork(data.postmortem.what_didnt_work || []);
        setKeyLearnings(data.postmortem.key_learnings || []);
        setRecommendedChanges(data.postmortem.recommended_changes || []);
        if (data.postmortem.competitor_info) {
          setCompetitorName(data.postmortem.competitor_info.name || '');
          setCompetitorWhyWon(data.postmortem.competitor_info.why_they_won || '');
        }
      }
    } catch (err) {
      console.error('Error fetching postmortem:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!primaryReason.trim()) {
      alert('Please provide the primary reason for the outcome');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/deals/${dealId}/postmortem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          primaryReason: primaryReason.trim(),
          whatWorked,
          whatDidntWork,
          competitorInfo: competitorName
            ? { name: competitorName, why_they_won: competitorWhyWon }
            : null,
          keyLearnings,
          recommendedChanges,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setExistingPostmortem(data.postmortem);
        alert('Postmortem saved! Learnings have been captured to account memory.');
        onComplete?.();
      } else {
        alert(data.error || 'Failed to save postmortem');
      }
    } catch (err) {
      console.error('Error saving postmortem:', err);
      alert('Failed to save postmortem');
    } finally {
      setSaving(false);
    }
  };

  const addItem = (
    list: string[],
    setList: (items: string[]) => void,
    value: string,
    setValue: (v: string) => void
  ) => {
    if (value.trim()) {
      setList([...list, value.trim()]);
      setValue('');
    }
  };

  const removeItem = (
    list: string[],
    setList: (items: string[]) => void,
    index: number
  ) => {
    setList(list.filter((_, i) => i !== index));
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            outcome === 'won' ? 'bg-green-50' : 'bg-red-50'
          )}>
            {outcome === 'won' ? (
              <Award className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              {outcome === 'won' ? 'Win Analysis' : 'Loss Analysis'}: {dealName}
            </h2>
            <p className="text-sm text-gray-500">
              Capture learnings to improve future deals
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Primary Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {outcome === 'won' ? 'Why did we win?' : 'Why did we lose?'} *
          </label>
          <textarea
            value={primaryReason}
            onChange={(e) => setPrimaryReason(e.target.value)}
            placeholder={
              outcome === 'won'
                ? 'What was the primary factor that led to winning this deal?'
                : 'What was the main reason we lost this opportunity?'
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
          />
        </div>

        {/* What Worked */}
        <ListSection
          title="What Worked"
          icon={ThumbsUp}
          iconColor="text-green-600 bg-green-50"
          items={whatWorked}
          onRemove={(i) => removeItem(whatWorked, setWhatWorked, i)}
          inputValue={newWorked}
          onInputChange={setNewWorked}
          onAdd={() => addItem(whatWorked, setWhatWorked, newWorked, setNewWorked)}
          placeholder="Add something that worked well..."
        />

        {/* What Didn't Work */}
        <ListSection
          title="What Didn't Work"
          icon={ThumbsDown}
          iconColor="text-red-600 bg-red-50"
          items={whatDidntWork}
          onRemove={(i) => removeItem(whatDidntWork, setWhatDidntWork, i)}
          inputValue={newDidntWork}
          onInputChange={setNewDidntWork}
          onAdd={() => addItem(whatDidntWork, setWhatDidntWork, newDidntWork, setNewDidntWork)}
          placeholder="Add something that didn't work..."
        />

        {/* Competitor Info (for losses) */}
        {outcome === 'lost' && (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded bg-orange-50">
                <Swords className="h-4 w-4 text-orange-600" />
              </div>
              <h3 className="font-medium text-gray-900">Competitor Information</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Competitor Name
                </label>
                <input
                  type="text"
                  value={competitorName}
                  onChange={(e) => setCompetitorName(e.target.value)}
                  placeholder="Who did we lose to?"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Why They Won
                </label>
                <textarea
                  value={competitorWhyWon}
                  onChange={(e) => setCompetitorWhyWon(e.target.value)}
                  placeholder="What advantages did they have? Price? Features? Relationships?"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                />
              </div>
            </div>
          </div>
        )}

        {/* Key Learnings */}
        <ListSection
          title="Key Learnings"
          icon={Lightbulb}
          iconColor="text-yellow-600 bg-yellow-50"
          items={keyLearnings}
          onRemove={(i) => removeItem(keyLearnings, setKeyLearnings, i)}
          inputValue={newLearning}
          onInputChange={setNewLearning}
          onAdd={() => addItem(keyLearnings, setKeyLearnings, newLearning, setNewLearning)}
          placeholder="What did you learn from this deal?"
        />

        {/* Recommended Changes */}
        <ListSection
          title="Recommended Process Changes"
          icon={FileText}
          iconColor="text-blue-600 bg-blue-50"
          items={recommendedChanges}
          onRemove={(i) => removeItem(recommendedChanges, setRecommendedChanges, i)}
          inputValue={newChange}
          onInputChange={setNewChange}
          onAdd={() => addItem(recommendedChanges, setRecommendedChanges, newChange, setNewChange)}
          placeholder="Suggest improvements to our process..."
        />
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {existingPostmortem
              ? `Last updated ${new Date(existingPostmortem.updated_at).toLocaleDateString()}`
              : 'Learnings will be saved to account memory'}
          </p>
          <button
            onClick={handleSave}
            disabled={saving || !primaryReason.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Postmortem
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function ListSection({
  title,
  icon: Icon,
  iconColor,
  items,
  onRemove,
  inputValue,
  onInputChange,
  onAdd,
  placeholder,
}: {
  title: string;
  icon: typeof ThumbsUp;
  iconColor: string;
  items: string[];
  onRemove: (index: number) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('p-1.5 rounded', iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="font-medium text-gray-900">{title}</h3>
      </div>

      {items.length > 0 && (
        <div className="space-y-2 mb-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-start justify-between p-2 bg-gray-50 rounded-lg text-sm group"
            >
              <span className="text-gray-700">{item}</span>
              <button
                onClick={() => onRemove(i)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={onAdd}
          disabled={!inputValue.trim()}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
