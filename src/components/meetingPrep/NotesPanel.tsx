'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StickyNote, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PrepNotes } from '@/lib/meetingPrep/buildEnhancedPrep';

interface NotesPanelProps {
  meetingId: string;
  initialNotes: PrepNotes | null;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function NotesPanel({ meetingId, initialNotes }: NotesPanelProps) {
  const [prepNotes, setPrepNotes] = useState(initialNotes?.prep_notes || '');
  const [meetingNotes, setMeetingNotes] = useState(initialNotes?.meeting_notes || '');
  const [activeTab, setActiveTab] = useState<'prep' | 'meeting'>('prep');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save function
  const saveNotes = useCallback(async () => {
    setSaveStatus('saving');

    try {
      const response = await fetch(`/api/meetings/${meetingId}/prep/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prep_notes: prepNotes || null,
          meeting_notes: meetingNotes || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      setSaveStatus('saved');
      // Reset to idle after showing "saved" for a moment
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('[NotesPanel] Save error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [meetingId, prepNotes, meetingNotes]);

  // Debounced auto-save on content change
  useEffect(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Skip if content hasn't changed from initial
    const hasChanged =
      prepNotes !== (initialNotes?.prep_notes || '') ||
      meetingNotes !== (initialNotes?.meeting_notes || '');

    if (!hasChanged) return;

    // Set new timeout for auto-save (1.5 second debounce)
    saveTimeoutRef.current = setTimeout(() => {
      saveNotes();
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [prepNotes, meetingNotes, initialNotes, saveNotes]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-gray-400" />
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Notes
          </h2>
        </div>

        {/* Save Status */}
        <div className="flex items-center gap-1.5 text-xs">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
              <span className="text-gray-400">Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-green-600">Saved</span>
            </>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-500">Save failed</span>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4">
        <button
          onClick={() => setActiveTab('prep')}
          className={cn(
            'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            activeTab === 'prep'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          Prep Notes
        </button>
        <button
          onClick={() => setActiveTab('meeting')}
          className={cn(
            'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            activeTab === 'meeting'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          Meeting Notes
        </button>
      </div>

      {/* Notes Area */}
      {activeTab === 'prep' ? (
        <textarea
          value={prepNotes}
          onChange={(e) => setPrepNotes(e.target.value)}
          placeholder="Add your pre-meeting notes here... What do you want to remember? What's your strategy?"
          className="w-full h-40 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
        />
      ) : (
        <textarea
          value={meetingNotes}
          onChange={(e) => setMeetingNotes(e.target.value)}
          placeholder="Take notes during the meeting... Key takeaways, action items, follow-ups..."
          className="w-full h-40 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
        />
      )}

      <p className="text-xs text-gray-400 mt-2">
        Notes are auto-saved as you type
      </p>
    </div>
  );
}
