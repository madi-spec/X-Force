'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Upload, FileText, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Deal, Company } from '@/types';

interface TranscriptionUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId?: string;
  companyId?: string;
  deal?: Deal;
  company?: Company;
  onSuccess?: (transcriptionId: string) => void;
}

export function TranscriptionUploadModal({
  isOpen,
  onClose,
  dealId,
  companyId,
  deal,
  company,
  onSuccess,
}: TranscriptionUploadModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState(deal ? `Meeting - ${deal.name}` : '');
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [duration, setDuration] = useState('');
  const [attendees, setAttendees] = useState('');
  const [transcription, setTranscription] = useState('');
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = useCallback(async () => {
    if (!title.trim() || !transcription.trim()) {
      setError('Please provide a title and transcription');
      return;
    }

    setAnalyzing(true);
    setError('');

    try {
      const response = await fetch('/api/meetings/transcriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          meetingDate,
          durationMinutes: duration ? parseInt(duration) : null,
          attendees: attendees
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          dealId: dealId || null,
          companyId: companyId || null,
          transcriptionText: transcription,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to analyze transcription');
      }

      const data = await response.json();

      if (onSuccess) {
        onSuccess(data.transcriptionId);
      }

      // Navigate to the analysis page
      router.push(`/meetings/${data.transcriptionId}/analysis`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setAnalyzing(false);
    }
  }, [
    title,
    transcription,
    meetingDate,
    duration,
    attendees,
    dealId,
    companyId,
    onSuccess,
    router,
    onClose,
  ]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        setTranscription(text);

        // Try to extract title from filename
        if (!title) {
          const nameWithoutExt = file.name.replace(/\.(txt|vtt|srt|docx)$/, '');
          setTitle(nameWithoutExt);
        }
      } catch {
        setError('Failed to read file');
      }
    },
    [title]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        setTranscription(text);

        if (!title) {
          const nameWithoutExt = file.name.replace(/\.(txt|vtt|srt|docx)$/, '');
          setTitle(nameWithoutExt);
        }
      } catch {
        setError('Failed to read file');
      }
    },
    [title]
  );

  if (!isOpen) return null;

  const wordCount = transcription.split(/\s+/).filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Upload Meeting Transcription
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Context info */}
          {(deal || company) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-blue-700">
                {deal
                  ? `Linked to deal: ${deal.name}`
                  : company
                    ? `Linked to company: ${company.name}`
                    : ''}
              </span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Discovery Call - Acme Corp"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="45"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attendees
            </label>
            <input
              type="text"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="John Smith, Jane Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated names
            </p>
          </div>

          {/* Input Mode Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transcription <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setInputMode('paste')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  inputMode === 'paste'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                Paste Text
              </button>
              <button
                onClick={() => setInputMode('upload')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  inputMode === 'upload'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                Upload File
              </button>
            </div>

            {inputMode === 'paste' ? (
              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                placeholder={`Paste your meeting transcription here...

Supports plain text, Microsoft Teams transcript, Zoom transcript, Otter.ai export, or any text format.`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm h-64 resize-none"
              />
            ) : (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
              >
                <input
                  type="file"
                  accept=".txt,.vtt,.srt,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-400">
                    .txt, .vtt, .srt, .docx
                  </p>
                </label>
                {transcription && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-green-600">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">
                      File loaded ({transcription.length.toLocaleString()} characters)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Word count */}
          {transcription && (
            <p className="text-xs text-gray-500">
              {wordCount.toLocaleString()} words
            </p>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={analyzing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !title.trim() || !transcription.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analyze with AI
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
