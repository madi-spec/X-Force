'use client';

import { useState } from 'react';
import { X, MessageSquarePlus, Loader2, RefreshCw, Target, AlertTriangle, Lightbulb, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type ContextType = 'strategy' | 'insight' | 'warning' | 'general';

interface AddContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  contactId?: string | null;
  companyId?: string | null;
  targetName?: string;
  companyName?: string;
  onSubmit: (params: {
    note: string;
    contextType: ContextType;
    triggerReanalysis: boolean;
  }) => Promise<void>;
}

const CONTEXT_TYPES: { value: ContextType; label: string; icon: typeof Target; description: string; color: string }[] = [
  {
    value: 'strategy',
    label: 'Strategy',
    icon: Target,
    description: 'Your approach or game plan for this deal',
    color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100',
  },
  {
    value: 'insight',
    label: 'Insight',
    icon: Lightbulb,
    description: 'Something you learned that AI should know',
    color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100',
  },
  {
    value: 'warning',
    label: 'Warning',
    icon: AlertTriangle,
    description: 'Landmines to avoid or sensitive topics',
    color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100',
  },
  {
    value: 'general',
    label: 'Note',
    icon: FileText,
    description: 'General context or background info',
    color: 'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100',
  },
];

const QUICK_NOTES = [
  'Met them at a trade show - good rapport',
  'They have budget approved for Q1',
  'Decision maker is the CFO, not them',
  'Competitor (Gong/Chorus) already in eval',
  'Previous bad experience with AI tools',
  'Very price-sensitive, focus on ROI',
  'Technical buyer - wants deep demo',
  'Fast decision maker - prefers calls over email',
];

export function AddContextModal({
  isOpen,
  onClose,
  itemId,
  contactId,
  companyId,
  targetName,
  companyName,
  onSubmit,
}: AddContextModalProps) {
  const [note, setNote] = useState('');
  const [contextType, setContextType] = useState<ContextType>('insight');
  const [triggerReanalysis, setTriggerReanalysis] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!note.trim()) {
      setError('Please add a note');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        note: note.trim(),
        contextType,
        triggerReanalysis,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add context');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickNote = (quickNote: string) => {
    setNote((prev) => prev ? `${prev}\n${quickNote}` : quickNote);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageSquarePlus className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Add Context</h2>
              <p className="text-sm text-gray-500">
                {targetName && `About ${targetName}`}
                {companyName && targetName && ` at ${companyName}`}
                {companyName && !targetName && `About ${companyName}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Context Type Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Type of Context
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CONTEXT_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = contextType === type.value;
                return (
                  <button
                    key={type.value}
                    onClick={() => setContextType(type.value)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border text-left transition-all',
                      isSelected
                        ? `${type.color} ring-2 ring-offset-1`
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', isSelected ? '' : 'text-gray-400')} />
                    <div>
                      <p className={cn('text-sm font-medium', isSelected ? '' : 'text-gray-700')}>
                        {type.label}
                      </p>
                      <p className="text-xs text-gray-500">{type.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Your Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What should the AI know about this contact/deal?"
              rows={4}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 text-sm resize-none"
            />
          </div>

          {/* Quick Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Quick Add
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_NOTES.map((quickNote, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickNote(quickNote)}
                  className="px-2.5 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                >
                  {quickNote}
                </button>
              ))}
            </div>
          </div>

          {/* Reanalysis Toggle */}
          <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg">
            <input
              type="checkbox"
              id="reanalysis"
              checked={triggerReanalysis}
              onChange={(e) => setTriggerReanalysis(e.target.checked)}
              className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="reanalysis" className="flex-1 cursor-pointer">
              <span className="flex items-center gap-2 text-sm font-medium text-purple-900">
                <RefreshCw className="h-4 w-4" />
                Reanalyze with this context
              </span>
              <p className="text-xs text-purple-700 mt-0.5">
                AI will regenerate recommendations using your new context
              </p>
            </label>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !note.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <MessageSquarePlus className="h-4 w-4" />
                Add Context
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
