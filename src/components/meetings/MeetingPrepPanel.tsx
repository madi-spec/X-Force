'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Save, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MeetingPrepPanelProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string | null;
  meetingSubject?: string;
}

interface PrepData {
  prep_notes: string;
  meeting_notes: string;
}

export function MeetingPrepPanel({
  isOpen,
  onClose,
  meetingId,
  meetingSubject,
}: MeetingPrepPanelProps) {
  const [activeTab, setActiveTab] = useState<'prep' | 'notes'>('prep');
  const [prepNotes, setPrepNotes] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch existing notes
  const fetchNotes = useCallback(async () => {
    if (!meetingId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/prep/notes`);
      if (response.ok) {
        const data = await response.json();
        setPrepNotes(data.notes?.prep_notes || '');
        setMeetingNotes(data.notes?.meeting_notes || '');
      } else if (response.status !== 404) {
        throw new Error('Failed to load notes');
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    if (isOpen && meetingId) {
      fetchNotes();
      setHasChanges(false);
    }
  }, [isOpen, meetingId, fetchNotes]);

  // Save notes
  const handleSave = async () => {
    if (!meetingId) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prep_notes: prepNotes,
          meeting_notes: meetingNotes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save notes');
      }

      setHasChanges(false);
    } catch (err) {
      console.error('Error saving notes:', err);
      setError('Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      // Auto-save before closing
      handleSave();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gray-500" />
            <h2 className="font-medium text-gray-900 text-sm truncate max-w-[250px]">
              {meetingSubject || 'Meeting Notes'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('prep')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'prep'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Prep Notes
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'notes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Meeting Notes
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-600 text-sm">
              {error}
            </div>
          ) : (
            <textarea
              value={activeTab === 'prep' ? prepNotes : meetingNotes}
              onChange={(e) => {
                setHasChanges(true);
                if (activeTab === 'prep') {
                  setPrepNotes(e.target.value);
                } else {
                  setMeetingNotes(e.target.value);
                }
              }}
              placeholder={
                activeTab === 'prep'
                  ? 'Add your prep notes here...\n\n• Key talking points\n• Questions to ask\n• Goals for the meeting'
                  : 'Add your meeting notes here...\n\n• Key outcomes\n• Action items\n• Next steps'
              }
              className="w-full h-full p-4 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none"
            />
          )}
        </div>
      </div>
    </>
  );
}
