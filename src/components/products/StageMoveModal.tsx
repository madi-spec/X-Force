'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PipelineItem, StageDefinition } from '@/types/products';
import { cn } from '@/lib/utils';

interface StageMoveModalProps {
  item: PipelineItem;
  fromStage: StageDefinition | null;
  toStage: StageDefinition;
  onConfirm: (note: string) => Promise<void>;
  onCancel: () => void;
}

export function StageMoveModal({ item, fromStage, toStage, onConfirm, onCancel }: StageMoveModalProps) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  }, [onCancel]);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedNote = note.trim();

    if (!trimmedNote) {
      setError('Please enter a note explaining why you are moving this item.');
      return;
    }

    if (trimmedNote.length < 10) {
      setError('Please provide a more detailed note (at least 10 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(trimmedNote);
    } catch {
      setError('Failed to move stage. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#e6eaf0]">
            <h2 id="modal-title" className="text-lg font-semibold text-[#0b1220]">
              Move to New Stage
            </h2>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 space-y-4">
              {/* Info Box */}
              <div className="bg-[#f6f8fb] rounded-lg p-4">
                <div className="text-sm text-[#667085] mb-2">
                  <span className="font-medium text-[#0b1220]">{item.company_name}</span>
                  {' - '}
                  <span>{item.product_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[#667085]">{fromStage?.name || 'No Stage'}</span>
                  <svg className="w-4 h-4 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                  <span className="font-medium text-[#0b1220]">{toStage.name}</span>
                </div>
              </div>

              {/* Note Input */}
              <div>
                <label htmlFor="note" className="block text-sm font-medium text-[#0b1220] mb-1.5">
                  Note <span className="text-[#ef4444]">*</span>
                </label>
                <textarea
                  ref={textareaRef}
                  id="note"
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Explain why you're moving to this stage..."
                  className={cn(
                    'w-full px-3 py-2.5 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20',
                    error ? 'border-[#ef4444]' : 'border-[#e6eaf0] focus:border-[#3b82f6]'
                  )}
                  rows={4}
                />
                {error && (
                  <p className="mt-1.5 text-xs text-[#ef4444]">{error}</p>
                )}
                <p className="mt-1.5 text-xs text-[#9ca3af]">
                  Required. This note will be saved to the activity history.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#e6eaf0] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-[#667085] hover:text-[#0b1220] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-[#3b82f6] rounded-lg hover:bg-[#2563eb] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Moving...</span>
                  </>
                ) : (
                  'Move & Save Note'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
